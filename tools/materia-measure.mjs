import { chromium } from '@playwright/test';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out='output/qa/materia';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:path.resolve('.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe'),args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const url=process.argv[2]||'http://127.0.0.1:4325/';
 await page.goto(url);await page.locator('[data-mode=webgl]').waitFor();await page.evaluate(()=>document.fonts.ready);
 const cap=()=>page.locator('.metal canvas').screenshot();
 const baseline=await cap();
 const bounds=await page.locator('.metal').boundingBox();
 const images=[baseline],changes=[];
 for(const [name,rx,ry] of [['left',.31,.42],['right',.77,.49]]){
   await page.mouse.move(bounds.x+rx*bounds.width,bounds.y+ry*bounds.height);await page.waitForTimeout(650);
   const pic=await cap();images.push(pic);
   const {data,info}=await sharp(baseline).removeAlpha().raw().toBuffer({resolveWithObject:true});
   const active=await sharp(pic).removeAlpha().raw().toBuffer();let count=0,xsum=0,ysum=0;
   for(let i=0;i<data.length;i+=3){if(Math.abs(active[i]-data[i])+Math.abs(active[i+1]-data[i+1])+Math.abs(active[i+2]-data[i+2])>75){count++;xsum+=(i/3)%info.width;ysum+=Math.floor(i/3/info.width);}}
   changes.push({name,changedPixels:count,centroid:[Math.round(xsum/count),Math.round(ysum/count)]});
   await page.mouse.move(10,10);await page.waitForTimeout(1600);
 }
 await page.locator('[data-pulse]').focus();
 const resting=await sharp(await cap()).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pulseFrames=[];
 await page.keyboard.press('Enter');
 const start=Date.now();
 for(const target of [120,360,700,2800]){
   await page.waitForTimeout(Math.max(1,target-(Date.now()-start)));
   const newFrame=await cap();
   const sampled=Date.now()-start;
   const active=await sharp(newFrame).removeAlpha().raw().toBuffer();
   let changed=0,energy=0;
   for(let i=0;i<active.length;i+=3){
     const d=Math.abs(active[i]-resting.data[i])+Math.abs(active[i+1]-resting.data[i+1])+Math.abs(active[i+2]-resting.data[i+2]);
     if(d>45)changed++;energy+=d;
   }
   pulseFrames.push({sampledMs:sampled,changedPixels:changed,meanChannelDelta:energy/active.length});
 }
 const bench=await page.evaluate(async()=>{const host=document.querySelector('.metal');const r=host.getBoundingClientRect();const intervals=[];let previous;
   for(let i=0;i<100;i++){const time=await new Promise(requestAnimationFrame);if(previous!==undefined)intervals.push(time-previous);previous=time;host.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*(.5+.2*Math.sin(i*.09)),clientY:r.y+r.height*.47,pointerType:'mouse',movementX:8}));}
   intervals.sort((a,b)=>a-b);return {samples:intervals.length,median:intervals[49],p95:intervals[94],over32ms:intervals.filter(t=>t>32).length,dpr:document.querySelector('[data-stage]').dataset.dpr};});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await new Promise(r=>setTimeout(r,350));await cdp.send('Page.setWebLifecycleState',{state:'active'});
 await page.locator('[data-pulse]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(250);
 const afterResume=await page.locator('[data-stage]').getAttribute('data-mode');
 const stats={url,viewport:'1440x900',renderer:await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)}),changes,pulseFrames,rafDuringPointer:bench,afterResume};
 await writeFile(out+'/measured-motion.json',JSON.stringify(stats,null,2));console.log(stats);
 const tiles=await Promise.all(images.map(img=>sharp(img).resize(520,234,{fit:'contain',background:'#151514'}).png().toBuffer()));
 await sharp({create:{width:520,height:702,channels:3,background:'#151514'}}).composite(tiles.map((input,i)=>({input,left:0,top:234*i}))).png().toFile(out+'/deformation-strip.png');
}finally{await browser.close();}

