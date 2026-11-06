import {expect, test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const lang of ['en','es']) for (const width of [360,1440]) {
  test(`Plain portfolio in ${lang}, ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto(lang==='es'?'/es/':'/');
    await expect(page.locator('html')).toHaveAttribute('lang',lang);
    await expect(page.getByRole('heading',{level:1})).toHaveText('Daniel Rosell Martín');
    await expect(page.locator('#projects h3')).toHaveCount(4);
    await expect(page.locator('#about')).toContainText('2026');
    await expect(page.locator('#stack')).toContainText('MySQL');
    const toggle=page.locator('.profile-dock summary');
    await toggle.hover();
    await expect(page.locator('.profile-dock details')).toHaveAttribute('open','');
    await page.getByRole('link',{name:'LinkedIn'}).hover();
    await page.mouse.move(2,2);
    await expect(page.locator('.profile-dock details')).not.toHaveAttribute('open','');
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('link',{name:'LinkedIn'})).toHaveAttribute('href',/linkedin\.com\/in\/daniel/);
    await expect(page.locator('.profile-dock .email')).toHaveAttribute('href','mailto:danirosellmartin@gmail.com');
    await page.locator('.email').click();
    await expect(page.locator('#mail-options')).toBeVisible();
    await expect(page.getByRole('link',{name:'Gmail'})).toHaveAttribute('href',/to=danirosellmartin%40gmail.com/);
    await expect(page.getByRole('link',{name:'Outlook.com'})).toHaveAttribute('href',/to=danirosellmartin%40gmail.com/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#mail-options')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(page.locator('#stack img')).toHaveCount(11);
    await page.locator('#stack').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('#stack img').evaluateAll(logos =>
      logos.every(logo => (logo as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(page.locator('img:not(#stack img,.profile-dock img,#invoice-feature img),canvas:not(.fluid-background),svg:not(.email svg),video')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    // A visitor can return to the selector while an old section anchor remains in the URL.
    await page.goto((lang==='es'?'/es/':'/')+'#projects');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.getByRole('link',{name:lang==='es'?'English':'Español'}).click();
    await expect(page.locator('html')).toHaveAttribute('lang',lang==='es'?'en':'es');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(()=>[location.hash,scrollY])).toEqual(['',0]);
  });
}

test.describe('Mobile profile gestures', () => {
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  test('small trigger, long press suppressed and normal tap opens', async ({page}) => {
    await page.goto('/es/');
    const dock=page.locator('.profile-dock details');
    const trigger=dock.locator('summary');
    expect(await page.locator('.radio-inputs a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))))
      .toEqual(['#main','#projects','#about','#stack']);
    const bounds=await trigger.boundingBox();
    if (!bounds) throw new Error('Profile trigger missing');
    expect(bounds.width).toBeLessThan(150);
    expect(bounds.height).toBeLessThan(150);
    const preview=await dock.locator('.actions').evaluate(actions=>{
      const sheet=actions.closest('.sheet')!;
      const panel=sheet.getBoundingClientRect();
      return getComputedStyle(sheet).opacity==='1' && [...actions.querySelectorAll('a')].every(link=>{
        const box=link.getBoundingClientRect();
        return box.top>=panel.top && box.bottom<=panel.bottom && box.left>=panel.left && box.right<=panel.right;
      });
    });
    expect(preview).toBe(true);
    const contextMenuAllowed=await trigger.evaluate(element=>element.dispatchEvent(
      new MouseEvent('contextmenu',{bubbles:true,cancelable:true}),
    ));
    expect(contextMenuAllowed).toBe(false);
    const session=await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{
      x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,
    }]});
    await page.waitForTimeout(750);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(dock).not.toHaveAttribute('open','');
    await trigger.tap();
    await expect(dock).toHaveAttribute('open','');
    await page.locator('.email').tap();
    await expect(page.locator('#mail-options')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:844,height:390});
    await expect.poll(async()=> (await trigger.boundingBox())?.width ?? Infinity).toBeLessThan(150);
  });
});





