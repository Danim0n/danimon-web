import {test, expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const delivered = 'public/cv/daniel-rosell-martin.pdf';
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');

for (const [lang, home, detail, demo] of [
  ['es', '/es/', '/es/proyectos/eventos/', '/es/demo/facturas/'],
  ['en', '/', '/projects/local-events/', '/demo/facturas/'],
] as const) for (const width of [390, 1440]) {
  test(`${lang} delivery at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 900});
    await page.goto(home);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await page.screenshot({path:`output/qa/delivery/home-${lang}-${width}.png`, fullPage:true});
    const summary = page.locator('.profile-dock summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const cv = page.locator('.profile-dock a[download]');
    await expect(cv).toHaveAttribute('href', '/cv/daniel-rosell-martin.pdf');
    const response = await page.request.get('/cv/daniel-rosell-martin.pdf');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect(hash(await response.body())).toBe(hash(await readFile(delivered)));
    const [download] = await Promise.all([page.waitForEvent('download'), cv.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    await page.keyboard.press('Escape');
    const link = page.locator(`.project-link[href="${detail}"]`);
    await expect(link).toHaveCount(1);
    const card = link.locator('xpath=ancestor::article[contains(@class,"wheel-item")]');
    await card.locator('button.card-hit').focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('data-open', '');
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${detail}$`));
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`output/qa/delivery/detail-${lang}-${width}.png`, fullPage:true});
    await page.goto(demo);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
