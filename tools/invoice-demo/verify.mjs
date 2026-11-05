// @ts-nocheck — executable browser QA for this isolated demo.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import sharp from 'sharp';

const base = process.env.INVOICE_DEMO_URL || 'http://127.0.0.1:4321';
const output = 'output/qa/invoice-demo';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({executablePath:'.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe',headless:true});
const report = {timestamp:new Date().toISOString(),base,browser:browser.version(),conditions:'Headless Chromium on Windows; desktop and viewport emulation, not a physical mobile device.',checks:[],errors:[]};
async function context(options={}) {
  const context = await browser.newContext({viewport:{width:1440,height:1100},...options});
  await context.addInitScript(()=>{
    window.__invoiceWorkerAudit = {created:0,terminated:0};
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {super(...args);window.__invoiceWorkerAudit.created++;this._terminated=false;}
      terminate() {if (!this._terminated) window.__invoiceWorkerAudit.terminated++;this._terminated=true;return super.terminate();}
    };
  });
  return context;
}
async function open(ctx,language='es') {
  const page = await ctx.newPage();
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(`${base}${language==='es'?'/es':''}/demo/facturas/`);
  await page.addStyleTag({content:'astro-dev-toolbar{display:none!important}'});
  return page;
}
async function read(page) {
  await page.locator('[data-start]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-start]').disabled && document.querySelector('[name=supplier]').value!== '',null,{timeout:90_000});
}
async function values(page) {return page.locator('[data-review-form] input').evaluateAll(inputs=>Object.fromEntries(inputs.map(input=>[input.name,input.value])));}
async function audit(page) {
  const value = await page.evaluate(()=>window.__invoiceWorkerAudit);
  assert.equal(value.created,value.terminated,'Every OCR worker must be terminated');
  return value;
}

try {
  const ctx = await context();
  const page = await ctx.newPage();
  const requests = [];
  page.on('request',request=>requests.push(request.url()));
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(`${base}/es/demo/facturas/`);
  await page.addStyleTag({content:'astro-dev-toolbar{display:none!important}'});
  await page.waitForTimeout(300);
  assert.equal(requests.filter(url=>url.includes('/invoice-ocr/')).length,0);
  await page.screenshot({path:`${output}/es-ready-desktop.png`,fullPage:true});
  const started = Date.now();
  await read(page);
  const elapsed = Date.now()-started;
  assert.deepEqual(await values(page),{supplier:'Estudio Norte S.L.',date:'2026-11-04',total:'1452.00'});
  const raw = await page.locator('[data-raw-ocr]').textContent();
  assert.ok(raw.includes('Estudio Norte S.L.') && raw.includes('1.452,00'));
  const boxes = {};
  for (const field of ['supplier','date','total']) {
    await page.locator(`[data-source=${field}]`).focus();
    await page.keyboard.press('Enter');
    boxes[field] = await page.locator('[data-highlight]').evaluate(element=>({left:element.style.left,top:element.style.top,width:element.style.width,height:element.style.height,hidden:element.hidden}));
    assert.equal(boxes[field].hidden,false);
  }
  assert.equal(new Set(Object.values(boxes).map(box=>box.top)).size,3);
  await page.screenshot({path:`${output}/es-total-source-desktop.png`,fullPage:true});
  await page.locator('[name=total]').fill('1500.25');
  await page.locator('[data-save]').click();
  assert.ok((await page.locator('[data-status]').textContent()).includes('guardada'));
  const stored = JSON.parse(await page.evaluate(()=>localStorage.getItem('danimon.invoice-demo.review.v1')));
  assert.equal(stored.reviewed.total,1500.25);
  assert.equal(stored.ocr.fields.total.value,'1452.00');
  assert.deepEqual(stored.corrections,[{field:'total',original:'1452.00',reviewed:'1500.25'}]);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-download]').click();
  const download = await downloadPromise;
  const blobText = await page.evaluate(async url=>await (await fetch(url)).text(),download.url());
  let browserDownloadFailure = null;
  try {await download.saveAs(`${output}/reviewed-result.json`);} catch {
    browserDownloadFailure = await download.failure();
    await writeFile(`${output}/reviewed-result.json`,blobText);
  }
  const downloaded = JSON.parse(await readFile(`${output}/reviewed-result.json`,'utf8'));
  assert.equal(downloaded.reviewed.total,1500.25);
  const workerAudit = await audit(page);
  const axe = await new AxeBuilder({page}).include('.invoice-demo').analyze();
  assert.equal(axe.violations.length,0,JSON.stringify(axe.violations.map(item=>({id:item.id,impact:item.impact}))));
  await page.getByRole('link',{name:'English'}).click();
  await page.waitForURL('**/demo/facturas/');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.deepEqual(await values(page),{supplier:'Estudio Norte S.L.',date:'2026-11-04',total:'1500.25'});
  assert.ok((await page.locator('[data-status]').textContent()).includes('saved review'));
  await page.locator('[data-clear]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('danimon.invoice-demo.review.v1')),null);
  const overflow = [];
  for (const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    overflow.push({width,...await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}))});
  }
  assert.ok(overflow.every(item=>item.content<=item.viewport),JSON.stringify(overflow));
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'astro-dev-toolbar{display:none!important}'});
  await page.screenshot({path:`${output}/en-mobile-review.png`,fullPage:true});
  await page.locator('[data-source=date]').click();
  await page.screenshot({path:`${output}/en-mobile-date-source.png`});
  assert.equal(await page.locator('[data-source=date]').getAttribute('aria-pressed'),'true');
  assert.ok(requests.filter(url=>url.startsWith('http')).every(url=>new URL(url).origin===new URL(base).origin));
  report.checks.push({name:'real OCR, lazy local resources, source boxes, keyboard, correction/save/JSON Blob/download event/restore/clear, bilingual, five widths, axe',passed:true,elapsedMs:elapsed,workerAudit,boxes,overflow,ocrRequests:requests.filter(url=>url.includes('/invoice-ocr/')),axeViolations:axe.violations.length,browserDownloadFailure});
  await ctx.close();

  // Supply a different raster image to both the figure and the OCR fetch.
  // There are no alternative expected values in any production module.
  const alternativeSource = (await readFile('public/invoice-demo/factura-ficticia.svg','utf8')).replace('Estudio Norte S.L.','Taller Sur S.L.').replace('04/11/2026','19/02/2027').replace('1.452,00','2.178,00');
  const alternativeImage = await sharp(Buffer.from(alternativeSource)).png().toBuffer();
  const altCtx = await context();
  await altCtx.route('**/invoice-demo/factura-ficticia.png',route=>route.fulfill({body:alternativeImage,contentType:'image/png'}));
  const altPage = await open(altCtx);
  await read(altPage);
  assert.deepEqual(await values(altPage),{supplier:'Taller Sur S.L.',date:'2027-02-19',total:'2178.00'});
  report.checks.push({name:'changed raster produces different genuine OCR values',passed:true,values:await values(altPage),workerAudit:await audit(altPage)});
  await altPage.screenshot({path:`${output}/different-image-proof.png`,fullPage:true});
  await altCtx.close();

  const errorCtx = await context();
  await errorCtx.route('**/eng.traineddata.gz',route=>route.abort('failed'));
  const errorPage = await open(errorCtx);
  await errorPage.locator('[data-start]').click();
  await errorPage.locator('[data-status][data-error]').waitFor({timeout:90_000});
  const failureText = await errorPage.locator('[data-status]').textContent();
  assert.ok(failureText.includes('No se ha podido'));
  await audit(errorPage);
  await errorCtx.unroute('**/eng.traineddata.gz');
  await read(errorPage);
  assert.equal((await values(errorPage)).total,'1452.00');
  report.checks.push({name:'model failure, worker release and successful retry',passed:true,failureText,workerAudit:await audit(errorPage)});
  await errorCtx.close();

  const cancelCtx = await context();
  const cancelPage = await open(cancelCtx);
  const workerStarted = cancelPage.waitForEvent('worker');
  await cancelPage.locator('[data-start]').click();
  await workerStarted;
  await cancelPage.locator('[data-cancel]').click();
  await cancelPage.waitForFunction(()=>!document.querySelector('[data-start]').disabled);
  assert.ok((await cancelPage.locator('[data-status]').textContent()).includes('cancelada'));
  await audit(cancelPage);
  await read(cancelPage);
  report.checks.push({name:'active worker cancellation and restart',passed:true,workerAudit:await audit(cancelPage)});
  await cancelCtx.close();

  const deniedCtx = await context();
  await deniedCtx.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError');};});
  const deniedPage = await open(deniedCtx);
  await read(deniedPage);
  await deniedPage.locator('[data-save]').click();
  assert.ok((await deniedPage.locator('[data-status]').textContent()).includes('no está disponible'));
  const deniedDownload = deniedPage.waitForEvent('download');
  await deniedPage.locator('[data-download]').click();
  await deniedDownload;
  report.checks.push({name:'blocked browser storage still permits JSON download',passed:true});
  await deniedCtx.close();

  const noJs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const noJsPage = await noJs.newPage();
  await noJsPage.goto(`${base}/es/demo/facturas/`);
  assert.equal(await noJsPage.locator('[data-start]').isDisabled(),true);
  assert.equal(await noJsPage.locator('.invoice-paper img').isVisible(),true);
  await noJsPage.locator('.transcript summary').click();
  assert.ok((await noJsPage.locator('.transcript p').textContent()).includes('1.452,00'));
  await noJsPage.screenshot({path:`${output}/no-js-mobile.png`,fullPage:true});
  report.checks.push({name:'no-JavaScript invoice and selectable transcript',passed:true});
  await noJs.close();
  assert.deepEqual(report.errors,[]);
} catch(error) {
  report.failure = {message:error.message,stack:error.stack};
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
