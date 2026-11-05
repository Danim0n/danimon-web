import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= process.cwd()+'/.cache/ms-playwright';
const {chromium} = await import('@playwright/test');
const site=resolve('output/analytics-test-dist'), persist=await mkdtemp(resolve('output/qa/cloudflare-only/d1-e2e-'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.pdf':'application/pdf'};
const server = new Miniflare({...convertV4MiniflareOptions({modules:true,scriptPath:'output/worker-test-build/index.js',compatibilityDate:'2026-08-06',host:'127.0.0.1',port:4334,d1Databases:['COUNTERS'],d1Persist:persist,
  bindings:{PUBLIC_ORIGIN:'http://127.0.0.1:4334',COUNTERS_ENABLED:'true'},
  serviceBindings:{ASSETS:async request=>{
    const pathname=decodeURIComponent(new URL(request.url).pathname);
    const path=resolve(site,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!path.startsWith(site+sep)) return new Response(null,{status:403});
    try { return new Response(await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream'}}); }
    catch { return new Response('Not found',{status:404}); }
  }}
}), resourcePersistencePath:persist});
let browser;
try {
  const db=await server.getD1Database('COUNTERS');
  await db.prepare(await readFile('migrations/0001_counters.sql','utf8')).run();
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const external=[], failures=[];
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://127.0.0.1:4334') { external.push(url.origin); return route.abort(); }
    return route.continue();
  });
  page.on('pageerror',e=>failures.push(e.message));
  await page.addInitScript(()=>document.addEventListener('click',event=>{
    const a=(event.target)?.closest?.('a[href]');
    if(a && (a.origin!==location.origin || a.protocol==='mailto:'))event.preventDefault();
  },true));
  await page.goto('http://127.0.0.1:4334/es/');
  await page.locator('.profile-dock summary').focus(); await page.keyboard.press('Enter');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.cv-download').click()]);
  assert.match(download.suggestedFilename(),/\.pdf$/i);
  await page.locator('.email').click();
  for(let i=0;i<3;i++) await page.locator('.mail-options a').nth(i).click();
  await page.locator('.mail-options button[data-copy]').click();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.locator('.portfolio-appbar a[href="#projects"]').click();
  const buttons=page.locator('.wheel-item button.card-hit');
  for(let i=0;i<4;i++){await buttons.nth(i).focus();await page.keyboard.press('Enter');}
  await page.locator('.case-shortcut a').click();
  await page.waitForURL('**/es/proyectos/eventos/');
  await page.goto('http://127.0.0.1:4334/es/');
  await page.locator('#invoice-feature a').click();
  await page.waitForURL('**/es/demo/facturas/');
  await page.goto('http://127.0.0.1:4334/es/');
  await page.locator('.language-bar a[lang="en"]').click();
  await page.waitForURL('http://127.0.0.1:4334/');
  await page.waitForTimeout(600);
  const rows=(await db.prepare('SELECT page,language,counter,project,total FROM daily_counts ORDER BY counter,project').all()).results;
  const has=(name,project='none')=>rows.some(r=>r.counter===name&&r.project===project&&r.total>=1);
  for(const name of ['cv_download_clicked','cv_response_served','contact_chooser_opened','email_gmail_clicked','email_outlook_clicked','email_app_clicked','language_en_selected','project_opened','project_demo_clicked','project_detail_viewed'])
    assert.ok(rows.some(r=>r.counter===name),`Missing ${name}`);
  assert.ok(rows.some(r=>['email_copy_succeeded','email_copy_selected'].includes(r.counter)),'Missing copy');
  for(const project of ['local-events','automation-backend','portfolio','invoice-reader']) assert.ok(has('project_details_revealed',project),`Missing ${project}`);
  assert.deepEqual(external,[]); assert.deepEqual(failures,[]);
  const output={condition:'Chromium headless localhost, test-mode static assets, local Miniflare Worker+D1, external requests blocked',download:download.suggestedFilename(),external,failures,rows};
  await writeFile('output/qa/cloudflare-only/e2e-worker-d1.json',JSON.stringify(output,null,2)); console.log(JSON.stringify(output,null,2));
} finally {await browser?.close();await server.dispose();}
