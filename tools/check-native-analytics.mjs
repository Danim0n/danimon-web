import { build, preview } from 'astro';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

process.env.ASTRO_TELEMETRY_DISABLED = '1';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${process.cwd()}/.cache/ms-playwright`;
const { chromium } = await import('@playwright/test');
process.env.PUBLIC_ANALYTICS_MODE = 'production';
process.env.PUBLIC_COUNTERS_ORIGIN = 'https://danimon.party';
process.env.PUBLIC_CLOUDFLARE_TOKEN = '00000000000000000000000000000000';
process.env.PUBLIC_CLOUDFLARE_MANUAL_AUDITED = 'true';
const output = 'output/qa/cloudflare-only';
await mkdir(output, {recursive:true});
const official = await readFile('output/qa/cloudflare/official-beacon.js', 'utf8').catch(async () => {
  // Download only the public script; measurement requests below are intercepted.
  const response = await fetch('https://static.cloudflareinsights.com/beacon.min.js');
  if (!response.ok) throw new Error('Official script unavailable');
  return response.text();
});
const results = [];
let browser, server;
try {
  browser = await chromium.launch();
  for (const reviewed of [false, true]) {
    process.env.PUBLIC_CLOUDFLARE_EXEMPTION_REVIEWED = String(reviewed);
    const config = {outDir:`./output/native-check-${reviewed}/`, server:{host:'127.0.0.1',port:4332}};
    await build(config);
    server = await preview(config);
    const cases = reviewed ? ['allowed','dnt','gpc','query','fragment','duplicate','unsafe-referrer'] : ['legal-gate'];
    for (const scenario of cases) {
      const context = await browser.newContext({extraHTTPHeaders: scenario === 'dnt' ? {DNT:'1'} : {}});
      const page = await context.newPage();
      const network = {beacons:0, rum:0, counters:0, unexpected:[]};
      await page.addInitScript(({scenario}) => {
        if (scenario === 'dnt') Object.defineProperty(navigator,'doNotTrack',{value:'1'});
        if (scenario === 'gpc') Object.defineProperty(navigator,'globalPrivacyControl',{value:true});
      }, {scenario});
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'static.cloudflareinsights.com') {
          network.beacons++;
          return route.fulfill({contentType:'application/javascript',body:official});
        }
        if (url.hostname === 'cloudflareinsights.com' || url.pathname === '/cdn-cgi/rum') {
          network.rum++; return route.fulfill({status:204,body:''});
        }
        if (url.origin === 'https://danimon.party') {
          if (url.pathname === '/api/interactions') {network.counters++; return route.fulfill({status:204,body:''});}
          const response = await route.fetch({url:'http://127.0.0.1:4332'+url.pathname+url.search});
          if (scenario === 'duplicate' && url.pathname === '/') {
            const html = (await response.text()).replace('<head>','<head><script data-cf-beacon="{}"></script>');
            return route.fulfill({response,body:html});
          }
          return route.fulfill({response});
        }
        network.unexpected.push(url.hostname); return route.abort();
      });
      const suffix = scenario === 'query' ? '?private=fixture' : scenario === 'fragment' ? '#fixture' : '';
      await page.goto('https://danimon.party/'+suffix, scenario === 'unsafe-referrer' ? {referer:'https://example.org/private?fixture=1'} : {});
      await page.waitForTimeout(1300);
      const scripts = await page.locator('script[src*="static.cloudflareinsights.com"]').count();
      const storage = await page.evaluate(() => ({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));
      assert.equal(network.beacons, scenario === 'allowed' ? 1 : 0);
      assert.equal(scripts, scenario === 'allowed' ? 1 : 0);
      if (scenario === 'allowed' && official) assert.ok(network.rum >= 1, 'official beacon must generate intercepted RUM');
      assert.deepEqual(network.unexpected, []);
      assert.deepEqual(storage,{local:[],session:[]});
      assert.deepEqual(await context.cookies(),[]);
      if (['dnt','gpc'].includes(scenario)) assert.equal(network.counters,0);
      results.push({scenario,...network,scripts,storage,officialScript:!!official});
      await context.close();
    }
    await server.stop(); server = null;
  }
  await writeFile(output+'/native-beacon.json',JSON.stringify({remoteDeliveryVerified:false,results},null,2));
  console.log(`${results.length} native beacon scenarios passed; all external requests intercepted.`);
} catch (error) {
  console.error(error);
} finally {
  await server?.stop(); await browser?.close();
  // Astro may retain its build pool on Windows.
  process.exit(results.length === 8 ? 0 : 1);
}
