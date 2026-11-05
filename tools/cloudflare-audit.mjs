import { build, preview } from 'astro';
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Test-only output. Every beacon and ingestion request is fulfilled locally.
process.env.PUBLIC_ANALYTICS_MODE = 'production';
process.env.PUBLIC_POSTHOG_KEY = '';
process.env.PUBLIC_CLOUDFLARE_TOKEN = '28c9cedc75e04348b812cea84cfd7d9d';
process.env.PUBLIC_CLOUDFLARE_MANUAL_AUDITED = 'true';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const output = 'output/qa/cloudflare';
await mkdir(output, { recursive: true });
let official;
try {
  official = await readFile(output + '/official-beacon.js', 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch('https://static.cloudflareinsights.com/beacon.min.js');
  if (!response.ok) throw new Error('Official beacon download failed: ' + response.status);
  official = await response.text();
  await writeFile(output + '/official-beacon.js', official);
}
assert.ok(official.includes('data-cf-beacon') && official.includes('cdn-cgi/rum'));
const config = { outDir: './output/cloudflare-test-dist/', server: { host: '127.0.0.1', port: 4334 } };
const report = {
  timestamp: new Date().toISOString(), scriptSha256: createHash('sha256').update(official).digest('hex'),
  conditions: 'Official script cached from its public CDN. Synthetic production origin; ALL collection requests intercepted. No real statistics sent.',
  checks: [], liveAutomaticInjectionVerified: false,
};
let server, browser;
let code = 1;
try {
  await build(config);
  server = await preview(config);
  browser = await chromium.launch({ executablePath: '.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
  for (const [lang, path, width] of [['en', '/', 1440], ['es', '/es/', 390]]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    let scriptLoads = 0;
    const rum = [], unexpected = [];
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.href.startsWith('https://static.cloudflareinsights.com/beacon.min.js')) {
        scriptLoads++;
        return route.fulfill({ contentType: 'application/javascript', body: official, headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.pathname.startsWith('/cdn-cgi/rum')) {
        const body = JSON.parse(request.postData() ?? '{}');
        rum.push({ origin: url.origin, token: body.siteToken ?? body.token ?? null });
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.origin !== 'https://danimon.party') { unexpected.push(url.origin); return route.abort(); }
      const response = await route.fetch({ url: 'http://127.0.0.1:4334' + url.pathname + url.search });
      return route.fulfill({ response });
    });
    await page.goto('https://danimon.party' + path);
    await page.waitForLoadState('networkidle');
    assert.equal(scriptLoads, 0); assert.equal(rum.length, 0);
    await page.locator('[data-consent-banner] [data-consent-reject]').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(scriptLoads, 0); assert.equal(rum.length, 0);
    await page.locator('.privacy-access button').click();
    const dialog = page.locator('[data-privacy-dialog]');
    await dialog.locator('[name=web]').check();
    await dialog.locator('[type=submit]').click();
    await page.waitForFunction(() => !!document.querySelector('script[type="module"][data-cf-beacon]'));
    for (let i = 0; i < 80 && !rum.length; i++) await page.waitForTimeout(100);
    assert.equal(scriptLoads, 1);
    assert.ok(rum.length > 0, 'The official script must generate an intercepted RUM request.');
    assert.ok(rum.some(item => item.token === process.env.PUBLIC_CLOUDFLARE_TOKEN));
    await page.locator('.privacy-access button').click();
    await dialog.locator('[type=submit]').click();
    assert.equal(scriptLoads, 1);
    await page.screenshot({ path: output + '/consented-' + lang + '.png' });
    await page.locator('.privacy-access button').click();
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), dialog.locator('[data-consent-withdraw]').click()]);
    const sent = rum.length;
    await page.waitForTimeout(300);
    assert.equal(scriptLoads, 1); assert.equal(rum.length, sent);
    assert.equal(await page.locator('script[data-cf-beacon]').count(), 0);
    assert.deepEqual(unexpected, []);
    report.checks.push({ lang, width, noRequestsBeforeConsent: true, noRequestsOnReject: true,
      singleModuleLoad: true, officialRumCaptured: sent, stoppedAfterWithdrawal: true, unexpectedRequests: 0 });
    await page.close();
  }
  code = 0;
} catch (error) {
  report.failure = String(error);
  console.error(error);
} finally {
  await writeFile(output + '/results.json', JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await server?.stop();
  process.exit(code);
}
