import {chromium} from '@playwright/test';
import path from 'node:path';
import sharp from 'sharp';
const site=process.argv[2]||'http://127.0.0.1:4325';
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe')});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto(site+'/es/');await page.evaluate(()=>document.fonts.ready);
 await page.locator('[data-mode=webgl]').waitFor();await page.screenshot({path:'output/materia/integrated-hero.png'});
 const panels=[];
 for(const [i,sel] of ['.project-0','.project-1','.project-2','#about','#contact'].entries()){
   await page.locator(sel).scrollIntoViewIfNeeded();await page.waitForTimeout(150);
   const image=await page.screenshot();panels.push({input:await sharp(image).resize(560,350).png().toBuffer(),left:(i%2)*560,top:Math.floor(i/2)*350});
 }
 await sharp({create:{width:1120,height:1050,channels:3,background:'#111'}}).composite(panels).png().toFile('output/materia/gallery.png');
 await page.evaluate(()=>scrollTo(0,310));await page.waitForTimeout(500);await page.screenshot({path:'output/materia/integrated-opening.png'});
}finally{await browser.close();}
