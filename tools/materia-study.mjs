import {chromium} from '@playwright/test';
import sharp from 'sharp';
import path from 'node:path';
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),args:['--enable-unsafe-swiftshader']});
try {
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 for(const shape of ['fold','open']){
 await p.goto('http://127.0.0.1:4324/?shape='+shape);
 await p.locator('[data-mode="webgl"]').waitFor();await p.evaluate(()=>document.fonts.ready);
 await p.screenshot({path:'output/materia/'+shape+'.png'});
 }
 // Capture the exact rendered frame through the browser compositor.
 await p.addStyleTag({content:'.stage>*:not(.metal),.mast,astro-dev-toolbar{visibility:hidden!important}.metal{inset:0!important;position:relative;width:1440px;height:660px}.stage{height:660px;border:0!important;background:transparent}body,html{background:transparent}'});
 await p.waitForTimeout(300);
 const buffer=await p.locator('.metal canvas').screenshot({omitBackground:true});
 await sharp(buffer).webp({quality:94}).toFile('public/media/materia.webp');
 await p.goto('http://127.0.0.1:4324/');await p.locator('[data-mode="webgl"]').waitFor();
 for(const [name,x,y] of [['touch-a',440,325],['touch-b',1040,355]]){await p.mouse.move(x,y);await p.waitForTimeout(170);await p.screenshot({path:'output/materia/'+name+'.png'});}
 await p.locator('[data-pulse]').click();await p.waitForTimeout(200);await p.screenshot({path:'output/materia/pulse.png'});
 await p.evaluate(()=>scrollTo(0,330));await p.waitForTimeout(260);await p.screenshot({path:'output/materia/opening.png'});
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(220);await p.screenshot({path:'output/materia/mobile.png'});
 const tiles=[];for(const [i,name] of ['fold','open','touch-a','touch-b','pulse','opening','mobile'].entries()){tiles.push({input:await sharp('output/materia/'+name+'.png').resize(450,280,{fit:'contain',background:'#111'}).png().toBuffer(),left:i%2*450,top:Math.floor(i/2)*280});}
 await sharp({create:{width:900,height:1120,channels:3,background:'#111'}}).composite(tiles).png().toFile('output/materia/study.png');
}finally{await browser.close();}

