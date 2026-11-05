import {chromium} from '@playwright/test';
import sharp from 'sharp';
import path from 'node:path';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('output/qa/materia',{recursive:true});
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('http://127.0.0.1:4325/');await page.locator('[data-mode=webgl]').waitFor();await page.evaluate(()=>document.fonts.ready);
 const bounds=await page.locator('.stage').boundingBox();
 const hero=await page.screenshot({clip:{x:0,y:0,width:1440,height:Math.ceil(bounds.y+bounds.height)}});
 await sharp(hero).png().toFile('output/qa/materia/integrated-hero.png');
 await sharp(hero).webp({quality:91}).toFile('public/media/materia-portfolio.webp');
 await sharp(hero).resize(1200,630,{fit:'cover',position:'top'}).png().toFile('public/og.png');
 await page.locator('#projects').scrollIntoViewIfNeeded();await page.waitForTimeout(150);await page.screenshot({path:'output/qa/materia/integrated-projects.png'});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(200);await page.screenshot({path:'output/qa/materia/integrated-mobile.png'});
 // Refresh static preview assets after capturing the exact build.
 await copyFile('public/media/materia-portfolio.webp','dist/media/materia-portfolio.webp');
 await copyFile('public/og.png','dist/og.png');
 await sharp('public/media/relief.svg').resize(1100).png().toFile('output/qa/materia/relief-inspect.png');
 await sharp('public/media/channels.svg').resize(800).png().toFile('output/qa/materia/channels-inspect.png');
}finally{await browser.close();}
