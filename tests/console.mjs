import {chromium} from '@playwright/test';
import path from 'node:path'; import fs from 'node:fs/promises';
const base='http://127.0.0.1:4325',out='output/qa/materia'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),headless:true,args:['--enable-unsafe-swiftshader']});
const reports=[];
try{for(const lang of ['en','es'])for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[],failed=[];
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('pageerror',e=>errors.push(e.message)); page.on('requestfailed',r=>failed.push(`${r.url()}: ${r.failure()?.errorText}`));
 await page.goto(`${base}/${lang==='es'?'es/':''}`); await page.waitForTimeout(1500);
 const pulse=page.locator('[data-pulse]'); if(await pulse.isVisible()) await pulse.click();
 await page.locator('#projects').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
 reports.push({lang,width,errors,failed}); await page.close();
} await fs.writeFile(`${out}/console.json`,JSON.stringify(reports,null,2)); if(reports.some(r=>r.errors.length||r.failed.length))throw Error(JSON.stringify(reports)); console.log('4 páginas sin errores de consola, excepciones ni peticiones fallidas');}finally{await browser.close()}
