// Independent, isolated browser QA of the built site under its real CSP headers.
// This tool deliberately runs only against a local test server and contains synthetic fixtures.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve('.cache/ms-playwright');
const {chromium} = await import('@playwright/test');
const base = new URL(process.env.SECURITY_TEST_URL || 'http://127.0.0.1:4325');
if (base.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname))
  throw new Error('SECURITY_TEST_URL must point to a local HTTP test server.');
const origin = base.origin;
const output = resolve('output/qa/security-audit');
await mkdir(output,{recursive:true});
const report = {timestamp:new Date().toISOString(),origin,scope:'Local isolated Chromium; CSP enforced by the test server. No production requests.',checks:[],errors:[]};
let browser;
const expected = {supplier:'Estudio Norte S.L.',date:'2026-11-04',total:'1452.00'};
const record = (name,data={}) => report.checks.push({name,passed:true,...data});
async function context(options={}) {
  const ctx = await browser.newContext({viewport:{width:1440,height:1000},...options});
  await ctx.addInitScript(() => {
    window.__qa = {violations:[],workers:{created:0,terminated:0},lastBlob:null,draws:0};
    document.addEventListener('securitypolicyviolation',e=>window.__qa.violations.push({directive:e.effectiveDirective,blockedURI:e.blockedURI,disposition:e.disposition}));
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) { super(...args); window.__qa.workers.created++; this.__qaTerminated = false; }
      terminate() { if (!this.__qaTerminated) window.__qa.workers.terminated++; this.__qaTerminated = true; return super.terminate(); }
    };
    const original = URL.createObjectURL;
    URL.createObjectURL = function(value) { if (value instanceof Blob) window.__qa.lastBlob=value; return original.call(this,value); };
    if (window.WebGLRenderingContext) {
      const draw=WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays=function(...args){window.__qa.draws++;return draw.apply(this,args);};
    }
  });
  return ctx;
}
async function pageFor(ctx, path, pageOrigin=origin, policyHeader='content-security-policy') {
  const page=await ctx.newPage();
  const activity={pageErrors:[],consoleErrors:[],failedRequests:[],externalRequests:[],externalRouteAttempts:[],assets:[]};
  page.on('pageerror', error=>activity.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') activity.consoleErrors.push(message.text());});
  page.on('requestfailed',request=>activity.failedRequests.push({url:request.url(),failure:request.failure()?.errorText}));
  page.on('request',request=>{
    const url=new URL(request.url());
    if (url.protocol==='http:' || url.protocol==='https:') {
      if(url.origin!==pageOrigin) activity.externalRequests.push(url.origin+url.pathname);
      else if(url.pathname.startsWith('/invoice-ocr/')) activity.assets.push(url.pathname);
    }
  });
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if (['http:','https:'].includes(url.protocol) && url.origin!==pageOrigin) {
      activity.externalRouteAttempts.push(url.origin+url.pathname);
      return route.abort();
    }
    return route.fallback();
  });
  const response=await page.goto(pageOrigin+path,{waitUntil:'load'});
  assert.equal(response.status(),200,`HTTP ${path}`);
  const policy=response.headers()[policyHeader] || '';
  assert.match(policy,/script-src,?/,'CSP appears on the document response');
  return {page,activity,policy};
}
async function fields(page) {
  return page.locator('[data-review-form] input').evaluateAll(inputs=>Object.fromEntries(inputs.map(input=>[input.name,input.value])));
}
async function readInvoice(page) {
  await page.locator('[data-start]').click();
  await page.waitForFunction(() => {
    const button=document.querySelector('[data-start]');
    const inputs=[...document.querySelectorAll('[data-review-form] input')];
    return !button.disabled && inputs.length===3 && inputs.every(input=>input.value);
  },null,{timeout:120_000});
  assert.deepEqual(await fields(page),expected);
}
async function cleanRuntime(page,activity) {
  const state=await page.evaluate(()=>window.__qa);
  assert.deepEqual(state.violations,[],'Legitimate page actions must not violate enforced CSP');
  assert.deepEqual(activity.pageErrors,[],'No unhandled application errors');
  assert.deepEqual(activity.consoleErrors,[],'No console errors');
  assert.deepEqual(activity.failedRequests,[],'No failed requests during normal interactions');
  assert.deepEqual(activity.externalRequests,[],'No requests outside the local site');
  assert.equal(state.workers.created,state.workers.terminated,'OCR workers released');
  return state;
}
try {
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});

  for (const [language,path] of [['es','/es/'],['en','/']]) for (const width of [390,1440]) {
    const ctx=await context({viewport:{width,height:width===390?844:900}});
    const home=await pageFor(ctx,path);
    assert.equal(await home.page.locator('html').getAttribute('lang'),language);
    await home.page.waitForFunction(()=>{
      const canvas=document.querySelector('canvas.fluid-background');
      return canvas && getComputedStyle(canvas).visibility==='visible' && window.__qa.draws>1;
    },null,{timeout:15_000});
    const before=await home.page.evaluate(()=>window.__qa.draws);
    await home.page.screenshot({path:resolve(output,`csp-home-${language}-${width}.png`)});
    await home.page.waitForTimeout(350);
    const graphics=await home.page.evaluate(()=>{
      const canvas=document.querySelector('canvas.fluid-background'),gl=canvas.getContext('webgl');
      return {active:!!gl&&!gl.isContextLost(),visibility:getComputedStyle(canvas).visibility,
        draws:window.__qa.draws,width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    assert.ok(graphics.active && graphics.visibility==='visible' && graphics.draws>before,'WebGL is active and drawing');
    assert.equal(graphics.width,graphics.scrollWidth,'No horizontal overflow');
    await home.page.locator('.portfolio-appbar a[href="#projects"]').click();
    const stage=home.page.locator('.wheel-stage');
    assert.equal(await stage.isVisible(),true);
    await home.page.mouse.move(0,0);
    const pose=await home.page.locator('.wheel-item').first().getAttribute('style');
    if(language==='es' && width===1440) await home.page.screenshot({path:resolve(output,'csp-carousel-motion-0.png')});
    await home.page.waitForFunction(old=>document.querySelector('.wheel-item')?.getAttribute('style')!==old,pose,{timeout:10_000});
    if(language==='es' && width===1440) await home.page.screenshot({path:resolve(output,'csp-carousel-motion-1.png')});
    const summary=home.page.locator('.profile-dock summary');
    await summary.focus(); await home.page.keyboard.press('Enter');
    const linkedin=home.page.getByRole('link',{name:'LinkedIn'});
    assert.match(await linkedin.getAttribute('href'),/^https:\/\/(?:www\.)?linkedin\.com\/in\//);
    assert.equal(await linkedin.getAttribute('target'),'_blank');
    assert.match(await linkedin.getAttribute('rel'),/noopener/);
    assert.equal(await home.page.locator('.cv-download').getAttribute('href'),'/cv/daniel-rosell-martin.pdf');
    await home.page.locator('.profile-dock .email').click();
    assert.equal(await home.page.getByRole('link',{name:'Gmail'}).isVisible(),true);
    assert.equal(await home.page.getByRole('link',{name:'Outlook.com'}).isVisible(),true);
    assert.match(await home.page.getByRole('link',{name:'Gmail'}).getAttribute('href'),/^https:\/\/mail\.google\.com\//);
    assert.match(await home.page.getByRole('link',{name:'Outlook.com'}).getAttribute('href'),/^https:\/\/outlook\.live\.com\//);
    await home.page.keyboard.press('Escape');
    await home.page.keyboard.press('Escape');
    const homeState=await cleanRuntime(home.page,home.activity);
    record(`Home ${language} ${width}px: WebGL, carousel, mail, LinkedIn and CV`,{graphics,violations:homeState.violations,pageErrors:home.activity.pageErrors});
    await ctx.close();
  }

  const es=await context();
  const {page,activity,policy}=await pageFor(es,'/es/demo/facturas/');
  assert.equal(await page.locator('html').getAttribute('lang'),'es');
  assert.equal(activity.assets.length,0,'OCR must load only after user action');
  await page.screenshot({path:resolve(output,'csp-invoice-es-before.png'),fullPage:true});
  const start=Date.now();
  await readInvoice(page);
  await page.locator('[name=total]').fill('1500.25');
  await page.locator('[data-save]').click();
  let stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('danimon.invoice-demo.review.v1')));
  assert.equal(stored.reviewed.total,1500.25);
  const downloadPromise=page.waitForEvent('download',{timeout:15_000});
  await page.locator('[data-download]').click();
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/\.json$/i);
  const exported=await page.evaluate(async()=>JSON.parse(await window.__qa.lastBlob.text()));
  assert.equal(exported.reviewed.total,1500.25);
  const beforeReload=await cleanRuntime(page,activity);
  assert.ok(beforeReload.workers.created>=1,'OCR worker must actually have run');
  await page.reload({waitUntil:'load'});
  assert.equal((await fields(page)).total,'1500.25');
  await page.locator('[data-clear]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('danimon.invoice-demo.review.v1')),null);
  const afterReload=await cleanRuntime(page,activity);
  await page.screenshot({path:resolve(output,'csp-invoice-es-desktop.png'),fullPage:true});
  record('Spanish OCR, correction, save, JSON blob/download event, restore and clear',{elapsedMs:Date.now()-start,assets:[...new Set(activity.assets)],policy,workersBeforeReload:beforeReload.workers,workersAfterReload:afterReload.workers});
  await es.close();

  const en=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const english=await pageFor(en,'/demo/facturas/');
  assert.equal(await english.page.locator('html').getAttribute('lang'),'en');
  await readInvoice(english.page);
  const enState=await cleanRuntime(english.page,english.activity);
  assert.ok(enState.workers.created>=1,'OCR worker must actually have run');
  await english.page.screenshot({path:resolve(output,'csp-invoice-en-mobile.png'),fullPage:true});
  record('English OCR on emulated mobile under enforced CSP',{workers:enState.workers,assets:[...new Set(english.activity.assets)]});
  await en.close();

  const failed=await context();
  await failed.route('**/invoice-ocr/eng.traineddata.gz',route=>route.abort('failed'));
  const failurePage=await pageFor(failed,'/es/demo/facturas/');
  await failurePage.page.locator('[data-start]').click();
  await failurePage.page.locator('[data-status][data-error]').waitFor({timeout:120_000});
  await failurePage.page.waitForFunction(()=>!document.querySelector('[data-start]').disabled);
  let workerState=await failurePage.page.evaluate(()=>window.__qa.workers);
  assert.equal(workerState.created,workerState.terminated,'Worker terminates after failed model load');
  await failed.unroute('**/invoice-ocr/eng.traineddata.gz');
  await readInvoice(failurePage.page);
  workerState=await failurePage.page.evaluate(()=>window.__qa.workers);
  assert.equal(workerState.created,workerState.terminated,'Worker terminates after retry');
  assert.deepEqual(await failurePage.page.evaluate(()=>window.__qa.violations),[]);
  record('Model failure, worker cleanup and successful retry',{workers:workerState,expectedNetworkFailure:true});
  await failed.close();

  const cancelled=await context();
  await cancelled.route('**/invoice-ocr/eng.traineddata.gz',async route=>{
    await new Promise(resolve=>setTimeout(resolve,1500));
    await route.continue().catch(()=>{});
  });
  const cancelPage=await pageFor(cancelled,'/es/demo/facturas/');
  const modelRequest=cancelPage.page.waitForRequest(request=>request.url().includes('/invoice-ocr/eng.traineddata.gz'),{timeout:90_000});
  await cancelPage.page.locator('[data-start]').click();
  await modelRequest;
  await cancelPage.page.locator('[data-cancel]').click();
  await cancelPage.page.waitForFunction(()=>!document.querySelector('[data-start]').disabled);
  workerState=await cancelPage.page.evaluate(()=>window.__qa.workers);
  assert.equal(workerState.created,workerState.terminated,'Worker terminates after cancellation');
  await cancelled.unroute('**/invoice-ocr/eng.traineddata.gz');
  await readInvoice(cancelPage.page);
  workerState=await cancelPage.page.evaluate(()=>window.__qa.workers);
  assert.equal(workerState.created,workerState.terminated,'Worker terminates after cancellation retry');
  assert.deepEqual(await cancelPage.page.evaluate(()=>window.__qa.violations),[]);
  record('Cancellation, worker cleanup and successful retry',{workers:workerState});
  await cancelled.close();

  const xss=await context();
  const fixture=await pageFor(xss,'/es/demo/facturas/');
  const payload='<img src="https://qa-security.invalid/collect" onerror="window.__qaXss=1">';
  const evidence={text:payload,value:payload,confidence:90,bbox:{x0:5,y0:5,x1:100,y1:50}};
  await fixture.page.evaluate(({payload,evidence})=>localStorage.setItem('danimon.invoice-demo.review.v1',JSON.stringify({
    schema:'invoice-demo/v1',document:'fictional-invoice-fn-2026-042',savedAt:'2026-11-06T00:00:00.000Z',
    reviewed:{supplier:payload,date:'2026-11-04',total:1452,currency:'EUR'},
    ocr:{text:payload,confidence:90,currency:'EUR',fields:{supplier:evidence,date:null,total:null}},corrections:[],
  })),{payload,evidence});
  await fixture.page.reload({waitUntil:'load'});
  assert.equal(await fixture.page.locator('[name=supplier]').inputValue(),payload);
  assert.equal(await fixture.page.locator('[data-raw-ocr]').textContent(),payload);
  await fixture.page.locator('[data-source=supplier]').click();
  assert.ok((await fixture.page.locator('[data-source-excerpt]').textContent()).includes(payload));
  assert.equal(await fixture.page.locator('[data-raw-ocr] img,[data-source-excerpt] img').count(),0);
  assert.equal(await fixture.page.evaluate(()=>window.__qaXss),undefined);
  assert.deepEqual(fixture.activity.externalRequests,[]);
  record('Synthetic hostile text in local storage remains literal; no external request',{fixture:'Injected by test in isolated localStorage, not a demonstrated external input channel.'});
  await xss.close();

  const probe=await context();
  await probe.route('**/__qa_csp_eval.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"try { eval('window.__qaEvalRan=1'); } catch (error) { window.__qaEvalBlocked=error.name; }"}));
  const p=await pageFor(probe,'/es/');
  await p.page.evaluate(()=>{
    const inline=document.createElement('script');inline.textContent='window.__qaInlineRan=1';document.head.append(inline);
    const image=document.createElement('img');image.setAttribute('onload','window.__qaAttributeRan=1');
    image.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';document.body.append(image);
    const foreign=document.createElement('script');foreign.src='https://qa-security.invalid/blocked.js';document.head.append(foreign);
    const own=document.createElement('script');own.src='/__qa_csp_eval.js';document.head.append(own);
    fetch('https://qa-security.invalid/connect').catch(()=>{});
  });
  await p.page.waitForFunction(()=>window.__qaEvalBlocked && window.__qa.violations.length>=5,null,{timeout:15_000});
  const probeState=await p.page.evaluate(()=>({inline:window.__qaInlineRan,attribute:window.__qaAttributeRan,evalRan:window.__qaEvalRan,evalBlocked:window.__qaEvalBlocked,violations:window.__qa.violations}));
  assert.equal(probeState.inline,undefined);
  assert.equal(probeState.attribute,undefined);
  assert.equal(probeState.evalRan,undefined);
  assert.equal(probeState.evalBlocked,'EvalError');
  assert.ok(probeState.violations.some(v=>v.directive.startsWith('script-src') && v.blockedURI==='inline'));
  assert.ok(probeState.violations.some(v=>v.directive==='script-src-attr' && v.blockedURI==='inline'));
  assert.ok(probeState.violations.some(v=>v.directive.startsWith('script-src') && v.blockedURI==='eval'));
  assert.ok(probeState.violations.some(v=>v.directive==='connect-src' && v.blockedURI.startsWith('https://qa-security.invalid')));
  assert.ok(probeState.violations.some(v=>v.directive.startsWith('script-src') && v.blockedURI.startsWith('https://qa-security.invalid')));
  assert.deepEqual(p.activity.externalRouteAttempts,[],'CSP blocks probes before the network interception layer');
  record('Enforced CSP blocks inline script, inline handler, eval, external script and connect probes',{violations:probeState.violations});
  await probe.close();

  if (process.env.SECURITY_REPORT_ONLY_URL) {
    const reportOnly = new URL(process.env.SECURITY_REPORT_ONLY_URL);
    if (reportOnly.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(reportOnly.hostname))
      throw new Error('SECURITY_REPORT_ONLY_URL must point to a local HTTP test server.');
    const ro=await context({viewport:{width:390,height:844}});
    const reportPage=await pageFor(ro,'/es/demo/facturas/',reportOnly.origin,'content-security-policy-report-only');
    await readInvoice(reportPage.page);
    const roState=await cleanRuntime(reportPage.page,reportPage.activity);
    assert.ok(roState.workers.created>=1);
    await reportPage.page.screenshot({path:resolve(output,'csp-report-only-mobile.png'),fullPage:true});
    record('Report-Only CSP: legitimate OCR without violations or external requests',{origin:reportOnly.origin,workers:roState.workers});
    await ro.close();
  }
} catch(error) {
  report.errors.push({message:error.message,stack:error.stack});
  process.exitCode=1;
} finally {
  await browser?.close();
  await writeFile(resolve(output,'security-browser-qa.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
