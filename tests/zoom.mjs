import {chromium} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.cache/ms-playwright');
const extension=path.resolve('tests/zoom-extension');
const context=await chromium.launchPersistentContext(path.resolve('output/qa/materia/zoom-profile'),{executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const page=await context.newPage();
 const results=[];
 for(const lang of ['en','es']){
  await page.goto(`http://127.0.0.1:4325/${lang==='es'?'es/':''}`);
  const zoom=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith('http://127.0.0.1:4325/'));if(!tab?.id)throw Error('No QA tab');await chrome.tabs.setZoom(tab.id,2);return chrome.tabs.getZoom(tab.id);});
  await page.waitForTimeout(700);
  const metrics=await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,viewport:visualViewport.width}));
  if(metrics.scrollWidth>metrics.innerWidth)throw Error(`Overflow at actual Chrome zoom: ${lang}`);
  await page.screenshot({path:`output/qa/materia/${lang}-chrome-zoom-200.png`});results.push({lang,zoom,...metrics});
 }
 await fs.writeFile('output/qa/materia/chrome-zoom.json',JSON.stringify(results,null,2));console.log(results);
}finally{await context.close();}


