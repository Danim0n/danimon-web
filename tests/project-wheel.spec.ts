import {test,expect} from '@playwright/test';

test('Orbit, individual flip and drag', async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/es/#projects');
  const stage=page.locator('.wheel-stage'), item=page.locator('.wheel-item').first();
  const pose=()=>item.evaluate(e=>e.style.transform);
  const start=await pose();
  await expect.poll(pose).not.toBe(start);
  const hit=await item.boundingBox();
  if(!hit)throw Error('Card missing');
  await page.mouse.move(hit.x+hit.width/2,hit.y+hit.height/2);
  await expect(item).toHaveAttribute('data-open','');
  await expect(page.locator('.wheel-item[data-open]')).toHaveCount(1);
  await page.waitForTimeout(450);
  await stage.screenshot({path:'output/qa/text/project-flip.png'});
  const rect=await stage.boundingBox();
  if(!rect)throw Error('Stage missing');
  await page.mouse.down();
  const cardStart=await pose();
  await page.mouse.move(hit.x+hit.width/2+18,hit.y+hit.height/2,{steps:6});
  expect(await pose()).not.toBe(cardStart);
  await expect(item).toHaveAttribute('data-open','');
  await page.mouse.up();
  await expect(item).not.toHaveAttribute('data-open','');
  const afterCardDrag=await pose();
  await expect.poll(pose).not.toBe(afterCardDrag);
  await page.mouse.move(rect.x+12,rect.y+20);
  await page.mouse.down();
  await expect(page.locator('.wheel-item[data-open]')).toHaveCount(0);
  const before=await pose();
  await page.mouse.move(rect.x+200,rect.y+20,{steps:8});
  expect(await pose()).not.toBe(before);
  await expect(page.locator('.wheel-item[data-open]')).toHaveCount(0);
  await page.mouse.up();await page.mouse.move(1,1);
  const released=await pose();await expect.poll(pose).not.toBe(released);
  await expect(page.locator('.wheel-controls')).toHaveCount(0);
  await stage.screenshot({path:'output/qa/text/project-orbit.png'});
});

test('Touch flip and reduced-motion controls',async({browser,baseURL})=>{
 const ctx=await browser.newContext({baseURL,hasTouch:true,isMobile:true,reducedMotion:'reduce',viewport:{width:390,height:844}});
 try{
 const p=await ctx.newPage();await p.goto('/#projects');const item=p.locator('.wheel-item').first();
 await item.locator('button').tap();await expect(item).toHaveAttribute('data-open','');
 await item.locator('button').tap();await expect(item).not.toHaveAttribute('data-open','');
 const before=await item.getAttribute('style');
 await p.waitForTimeout(180);expect(await item.getAttribute('style')).toBe(before);
 await p.keyboard.press('Tab');
 await expect(p.locator('.wheel-item button').nth(1)).toBeFocused();
 expect(await item.getAttribute('style')).not.toBe(before);
 expect(await p.locator('.wheel-stage').evaluate(e=>getComputedStyle(e).touchAction)).toContain('pan-y');
 }finally{await ctx.close();}
});


