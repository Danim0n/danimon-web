import {test, expect, type Page} from '@playwright/test';
import {counters, pages, projects} from '../src/lib/analytics/catalog';

type Payload = {page:string; language:string; counter:string; project:string};
async function watch(page: Page, fail = false) {
  const events: Payload[] = [], external: string[] = [], headers: Record<string,string>[] = [];
  await page.addInitScript(() => {
    const original = window.fetch;
    (window as any).__requestOptions = [];
    window.fetch = function(input, init) {
      if (typeof input === 'string' && input === '/api/interactions')
        (window as any).__requestOptions.push({credentials:init?.credentials, keepalive:init?.keepalive, referrerPolicy:init?.referrerPolicy});
      return original.call(this,input,init);
    };
    document.addEventListener('click', event => {
      const a = (event.target as Element)?.closest?.('a[href]');
      if (a && ((a as HTMLAnchorElement).origin !== location.origin || (a as HTMLAnchorElement).protocol === 'mailto:')) event.preventDefault();
    }, true);
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4330') {external.push(url.hostname); return route.abort();}
    if (url.pathname === '/api/interactions') {
      expect(request.method()).toBe('POST');
      headers.push(request.headers());
      const body = JSON.parse(request.postData() || 'null');
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.length).toBeLessThanOrEqual(5);
      for (const e of body) {
        expect(Object.keys(e).sort()).toEqual(['counter','language','page','project']);
        expect(counters).toContain(e.counter);
        expect(pages).toContain(e.page);
        expect(projects).toContain(e.project);
        expect(['en','es']).toContain(e.language);
        events.push(e);
      }
      return route.fulfill({status:fail ? 503 : 204, body:''});
    }
    return route.continue();
  });
  return {events, external, headers};
}

for (const [lang,path] of [['en','/'],['es','/es/']] as const) {
  test(`${lang} real POST body, no storage and CV click`, async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('danimon.analytics.consent.v1','old');
      sessionStorage.setItem('danimon.analytics.session.v1','old');
      localStorage.setItem('other-app-key','preserve');
    });
    const {events,external,headers} = await watch(page);
    await page.goto(`${path}?private=sample#fragment`);
    await expect.poll(() => events.some(e => e.counter === 'section_main_viewed')).toBe(true);
    await page.locator('.profile-dock summary').focus();
    await page.keyboard.press('Enter');
    expect(events.filter(e => e.counter === 'cv_download_clicked')).toHaveLength(0);
    const [download] = await Promise.all([page.waitForEvent('download'),page.locator('.cv-download').click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    await expect.poll(() => events.filter(e => e.counter === 'cv_download_clicked').length).toBe(1);
    expect(events.every(e => e.language === lang && e.page === 'home')).toBe(true);
    expect(JSON.stringify(events)).not.toContain('sample');
    expect(JSON.stringify(events)).not.toContain('fragment');
    expect(headers.every(h => !h.referer && !h.cookie)).toBe(true);
    const options = await page.evaluate(() => (window as any).__requestOptions);
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o:any) => o.credentials === 'omit' && o.keepalive === true && o.referrerPolicy === 'no-referrer')).toBe(true);
    expect(await page.evaluate(() => ({local:Object.keys(localStorage), session:Object.keys(sessionStorage), value:localStorage.getItem('other-app-key')}))).toEqual({local:['other-app-key'],session:[],value:'preserve'});
    expect(await page.context().cookies()).toEqual([]);
    expect(external).toEqual([]);
    await expect(page.locator('[data-consent-banner], [data-privacy-dialog]')).toHaveCount(0);
  });
}

for (const signal of ['gpc','dnt'] as const) {
  test(`${signal} blocks counters and third party requests`, async ({page}) => {
    await page.addInitScript(signal => {
      if (signal === 'gpc') Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true});
      else Object.defineProperty(navigator,'doNotTrack',{get:()=> '1'});
    }, signal);
    const {events,external} = await watch(page);
    await page.goto('/');
    await page.locator('.portfolio-appbar a[href="#projects"]').click();
    await page.waitForTimeout(300);
    expect(events).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('scroll milestones deduplicate and autonomous carousel does not count', async ({page}) => {
  const {events,external} = await watch(page);
  await page.goto('/#projects');
  await page.waitForTimeout(1200);
  expect(events.filter(e => e.counter === 'carousel_dragged' || e.counter === 'project_details_revealed')).toEqual([]);
  await page.locator('.wheel-item button.card-hit').first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => events.some(e => e.counter === 'project_details_revealed' && e.project === 'local-events')).toBe(true);
  const scroller = page.locator('.portfolio-scrollport');
  await scroller.evaluate(el => {el.scrollTop = el.scrollHeight;});
  await expect.poll(() => events.filter(e => e.counter.startsWith('scroll_')).length).toBe(4);
  await scroller.evaluate(el => {el.scrollTop = 0;});
  await scroller.evaluate(el => {el.scrollTop = el.scrollHeight;});
  await page.waitForTimeout(250);
  expect(events.filter(e => e.counter.startsWith('scroll_')).map(e => e.counter).sort()).toEqual(['scroll_100_reached','scroll_25_reached','scroll_50_reached','scroll_75_reached']);
  expect(external).toEqual([]);
});

test('counter endpoint failure never blocks navigation', async ({page}) => {
  const {events, external} = await watch(page, true);
  await page.goto('/');
  await page.locator('.portfolio-appbar a[href="#projects"]').click();
  await expect.poll(() => events.some(e => e.counter === 'navigation_projects_clicked')).toBe(true);
  await expect(page.locator('#projects')).toBeVisible();
  await page.goto('/es/proyectos/eventos/');
  await expect(page.locator('h1')).toBeVisible();
  await expect.poll(() => events.some(e => e.counter === 'project_detail_viewed' && e.page === 'local-events' && e.project === 'local-events')).toBe(true);
  expect(external).toEqual([]);
});

test('contact actions emit only fixed counters and never addresses', async ({page}) => {
  const {events,external} = await watch(page);
  await page.goto('/');
  await page.locator('.profile-dock summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('.profile-dock .email').click();
  await expect.poll(() => events.some(e => e.counter === 'contact_chooser_opened')).toBe(true);
  const links = page.locator('.mail-options a');
  for (const [index, name] of [[0,'email_gmail_clicked'],[1,'email_outlook_clicked'],[2,'email_app_clicked']] as const) {
    await links.nth(index).click();
    await expect.poll(() => events.some(e => e.counter === name)).toBe(true);
  }
  await page.locator('.mail-options button[data-copy]').click();
  await expect.poll(() => events.some(e => ['email_copy_succeeded','email_copy_selected'].includes(e.counter))).toBe(true);
  expect(JSON.stringify(events)).not.toContain('@');
  expect(external).toEqual([]);
});

test('language and project navigation use fixed context', async ({page}) => {
  const {events,external} = await watch(page);
  await page.goto('/es/');
  await page.locator('.case-shortcut a').click();
  await expect(page).toHaveURL(/\/es\/proyectos\/eventos\/$/);
  await expect.poll(() => events.some(e => e.counter === 'project_opened' && e.project === 'local-events' && e.language === 'es')).toBe(true);
  await expect.poll(() => events.some(e => e.counter === 'project_detail_viewed' && e.page === 'local-events')).toBe(true);
  await page.goto('/es/');
  await page.locator('.language-bar a[lang="en"]').click();
  await expect.poll(() => events.some(e => e.counter === 'language_en_selected' && e.language === 'es')).toBe(true);
  expect(external).toEqual([]);
});

test('project details and drag are counted by fixed project without motion telemetry', async ({page}) => {
  const {events, external} = await watch(page);
  await page.goto('/#projects');
  await page.emulateMedia({reducedMotion:'reduce'});
  const buttons = page.locator('.wheel-item button.card-hit');
  for (let i=0; i<4; i++) {
    await buttons.nth(i).focus();
    await page.keyboard.press('Enter');
  }
  await expect.poll(() => events.filter(e => e.counter === 'project_details_revealed').length).toBe(4);
  expect(events.filter(e => e.counter === 'project_details_revealed').map(e => e.project).sort()).toEqual(['automation-backend','invoice-reader','local-events','portfolio']);
  const stage = page.locator('.wheel-stage'), rect = await stage.boundingBox();
  if (!rect) throw new Error('Missing carousel stage');
  await page.mouse.move(rect.x+15, rect.y+15);
  await page.mouse.down();
  await page.mouse.move(rect.x+180, rect.y+15,{steps:8});
  await page.mouse.up();
  await expect.poll(() => events.some(e => e.counter === 'carousel_dragged' && e.project === 'none')).toBe(true);
  expect(external).toEqual([]);
});

test('detail page scrolls naturally and emits each milestone once', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const {events} = await watch(page);
  await page.goto('/projects/local-events/');
  const scroller = page.locator('.portfolio-scrollport');
  await scroller.evaluate(el => {el.scrollTop = el.scrollHeight;});
  await expect.poll(() => events.filter(e => e.counter.startsWith('scroll_')).length).toBe(4);
  await scroller.evaluate(el => {el.scrollTop = 0;});
  await scroller.evaluate(el => {el.scrollTop = el.scrollHeight;});
  await page.waitForTimeout(250);
  expect(events.filter(e => e.counter.startsWith('scroll_')).map(e => e.counter).sort()).toEqual(['scroll_100_reached','scroll_25_reached','scroll_50_reached','scroll_75_reached']);
});


test('hover reveals a project without emitting a details counter', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const {events,external} = await watch(page);
  await page.goto('/#projects');
  const card = page.locator('.wheel-item').first();
  await card.hover();
  await expect(card).toHaveAttribute('data-open','');
  await page.waitForTimeout(300);
  expect(events.filter(e => e.counter === 'project_details_revealed')).toEqual([]);
  expect(external).toEqual([]);
});
