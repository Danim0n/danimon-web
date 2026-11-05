import {chromium} from '@playwright/test';
import path from 'node:path'; import fs from 'node:fs/promises';
const base='http://127.0.0.1:4325',out='output/qa/materia'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),headless:true,args:['--enable-unsafe-swiftshader']});
const result={conditions:'Chromium headless, SwiftShader permitido; no representa un móvil físico ni mide tiempo GPU',viewport:{width:1440,height:1000}};
try{
 const context=await browser.newContext({viewport:result.viewport,recordVideo:{dir:out,size:{width:1440,height:1000}}}); const page=await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>{window.qaDraws=0;for(const klass of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!klass)continue;for(const name of ['drawArrays','drawElements']){const original=klass.prototype[name]; klass.prototype[name]=function(...args){window.qaDraws++;return original.apply(this,args)}}}});
 await page.goto(base); await page.waitForTimeout(1800);
 result.canvas=await page.locator('canvas').count(); result.stage=await page.locator('[data-stage]').count();
 result.graphics=await page.evaluate(()=>{const c=document.querySelector('canvas'); if(!c)return null; const gl=c.getContext('webgl2')||c.getContext('webgl'); if(!gl)return null; const ext=gl.getExtension('WEBGL_debug_renderer_info');return {width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight,dpr:devicePixelRatio,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION)}});
 let before=await page.evaluate(()=>window.qaDraws);await page.waitForTimeout(500);result.idleDraws=(await page.evaluate(()=>window.qaDraws))-before;
 await page.screenshot({path:`${out}/motion-rest.png`}); await page.waitForTimeout(350); await page.screenshot({path:`${out}/motion-rest-350.png`});
 const box=await page.locator('[data-stage]').boundingBox(); if(!box)throw Error('No hay escena visible');
 for(const [name,x,y] of [['left',.3,.48],['right',.7,.48]]){await page.mouse.move(box.x+box.width*x,box.y+box.height*y,{steps:15});await page.waitForTimeout(350);await page.screenshot({path:`${out}/motion-${name}.png`});}
 const pulse=page.locator('[data-pulse]'); before=await page.evaluate(()=>window.qaDraws); await pulse.click(); await page.waitForTimeout(100); result.activeDraws=(await page.evaluate(()=>window.qaDraws))-before; for(const t of [100,250,500,1000,2000]){await page.waitForTimeout(t===100?100:t===250?150:t===500?250:t===1000?500:1000);await page.screenshot({path:`${out}/pulse-${t}.png`});}
 const rafPromise=page.evaluate(()=>new Promise(resolve=>{const samples=[];let prev;function tick(t){if(prev!==undefined)samples.push(t-prev);prev=t;if(samples.length<180)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);resolve({count:samples.length,medianMs:samples[90],p95Ms:samples[171],maxMs:samples[179],over32ms:samples.filter(x=>x>32).length})}}requestAnimationFrame(tick)}));
 for(let i=0;i<100;i++){await page.mouse.move(box.x+box.width*(.25+.5*(i%20)/19),box.y+box.height*(.4+.1*Math.sin(i/4))); await page.waitForTimeout(25);} result.raf=await rafPromise;
 await page.evaluate(()=>scrollTo({top:innerHeight*.65,behavior:'smooth'}));await page.waitForTimeout(600);await page.screenshot({path:`${out}/transition.png`});
 await page.locator('#contact').scrollIntoViewIfNeeded();await page.waitForTimeout(600);before=await page.evaluate(()=>window.qaDraws);await page.waitForTimeout(500);result.offscreenDraws=(await page.evaluate(()=>window.qaDraws))-before;
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(700); const motion=page.locator('[data-motion]'); result.motionVisible=await motion.isVisible(); if(result.motionVisible){await motion.click();await page.waitForTimeout(400);before=await page.evaluate(()=>window.qaDraws);await page.waitForTimeout(500);result.pausedDraws=(await page.evaluate(()=>window.qaDraws))-before; result.pausedAttribute=await motion.getAttribute('aria-pressed');await motion.click();}
 await page.setViewportSize({width:1000,height:800});await page.waitForTimeout(500); result.afterResize=await page.locator('canvas').count();
 // Emulación de visibilidad: no equivale a cambiar realmente de pestaña en un navegador visible.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(400);before=await page.evaluate(()=>window.qaDraws);await page.waitForTimeout(500);result.hiddenDraws=(await page.evaluate(()=>window.qaDraws))-before;
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(500);before=await page.evaluate(()=>window.qaDraws);await page.waitForTimeout(500);result.returnDraws=(await page.evaluate(()=>window.qaDraws))-before;
 result.contextLoss=await page.evaluate(()=>{const c=document.querySelector('canvas');const gl=c&&(c.getContext('webgl2')||c.getContext('webgl'));const ext=gl?.getExtension('WEBGL_lose_context');if(!ext)return 'extension unavailable';ext.loseContext();return 'requested'});await page.waitForTimeout(700);result.posterAfterLoss=await page.locator('.poster').isVisible();await page.screenshot({path:`${out}/context-loss.png`});
 result.errors=errors; await context.close();
 await fs.writeFile(`${out}/lifecycle.json`,JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
 if(result.canvas!==1 || !result.graphics || !result.activeDraws)throw Error('WebGL no quedó demostrado activo');
 if(errors.length)throw Error('Errores: '+errors.join('; '));
} finally{await browser.close()}



