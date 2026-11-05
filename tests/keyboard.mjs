import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe')});
const evidence=[];
try {
 for(const locale of ['','es/']){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:4325/'+locale);
  await page.locator('[data-stage][data-mode=webgl]').waitFor();
  await page.keyboard.press('Tab');
  if(!await page.locator('.skip').evaluate(e=>e===document.activeElement))throw Error('Skip link not first');
  await page.keyboard.press('Enter');
  if(!page.url().endsWith('#main'))throw Error('Skip link destination');
  for(const selector of ['[data-pulse]','[data-motion]','details summary','#contact a']){
   let reached=false;
   for(let tab=0;tab<30;tab++){
    if(await page.evaluate(s=>document.activeElement?.matches(s),selector)){reached=true;break;}
    await page.keyboard.press('Tab');
   }
   if(!reached)throw Error('Keyboard could not reach '+selector);
   if(selector!=='#contact a')await page.keyboard.press('Enter');
   if(selector==='[data-motion]'&&await page.locator(selector).getAttribute('aria-pressed')!=='true')throw Error('Pause did not toggle');
   if(selector==='details summary'&&!await page.locator('details').first().evaluate(e=>e.open))throw Error('Context did not open');
  }
  evidence.push({locale:locale||'en',skip:true,pulseReachable:true,paused:true,detailsExpanded:true,linkedInReachable:true});await page.close();
 }
 await writeFile('output/qa/materia/keyboard.json',JSON.stringify(evidence,null,2));console.log(evidence);
}finally{await browser.close();}
