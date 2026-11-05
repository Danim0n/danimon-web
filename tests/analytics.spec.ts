import {test, expect, type Page} from '@playwright/test';
import {gunzipSync} from 'node:zlib';

const api = (page: Page, fn: string, args: unknown[] = []) => page.evaluate(({fn, args}) => {
  const a = (window as any).__analyticsTest;
  if (!a) throw new Error('Test-only analytics API is missing');
  return typeof a[fn] === 'function' ? a[fn](...args) : a[fn];
}, {fn, args});
const state = (page: Page) => api(page, 'state');
const events = (page: Page) => api(page, 'events');

for (const [lang, path] of [['en', '/'], ['es', '/es/']] as const) {
  test(`${lang}: reject, reload, configure and withdraw`, async ({page}) => {
    const outgoing: string[] = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') { outgoing.push(url.hostname); return route.abort(); }
      return route.continue();
    });
    await page.goto(path);
    await expect(page.locator('[data-consent-banner]')).toBeVisible();
    expect((await state(page)).loads).toBe(0);
    expect(await events(page)).toEqual([]);
    await page.locator('[data-consent-banner] [data-consent-reject]').click();
    await page.reload();
    await expect(page.locator('[data-consent-banner]')).toBeHidden();
    expect((await state(page)).loads).toBe(0);
    await page.locator('.privacy-access [data-privacy-open]').click();
    const dialog = page.locator('[data-privacy-dialog]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[name=web]')).not.toBeChecked();
    await expect(dialog.locator('[name=interactions]')).not.toBeChecked();
    await dialog.locator('[name=interactions]').check();
    await dialog.locator('[type=submit]').click();
    await expect.poll(async () => (await state(page)).providerReady).toBe(true);
    expect((await state(page)).cloudflareLoads).toBe(0);
    expect((await events(page)).filter((e: any) => e.name === 'page_viewed')).toHaveLength(1);
    await page.locator('.privacy-access [data-privacy-open]').click();
    await dialog.locator('[data-consent-withdraw]').click();
    expect((await state(page)).providerReady).toBe(false);
    await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
    expect((await events(page)).filter((e: any) => e.name === 'cv_download_clicked')).toHaveLength(0);
    await page.reload();
    expect((await state(page)).loads).toBe(0);
    expect(outgoing).toEqual([]);
  });
}

test('withdrawal during asynchronous loading closes the gate', async ({page}) => {
  await page.goto('/');
  await api(page, 'setDelay', [800]);
  await api(page, 'save', [false, true]);
  await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
  await api(page, 'withdraw');
  await page.waitForTimeout(1100);
  expect((await state(page)).providerReady).toBe(false);
  expect(await events(page)).toEqual([]);
});

test('withdrawal propagates between tabs and cancels a pending load', async ({context, page}) => {
  await page.goto('/');
  const second = await context.newPage();
  await second.goto('/');
  await api(second, 'setDelay', [1000]);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(second)).status).toBe('loading');
  await api(page, 'withdraw');
  await expect.poll(async () => (await state(second)).consent?.interactions).toBe(false);
  await page.waitForTimeout(1200);
  expect((await state(second)).providerReady).toBe(false);
  expect(await events(second)).toEqual([]);
});

test('rejects free-form event names, properties and values', async ({page}) => {
  await page.goto('/?private=sample#fragment');
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await api(page, 'clear');
  await api(page, 'track', ['cv_download_clicked', {source:'profile', url:'https://example.com/private'}]);
  await api(page, 'track', ['cv_download_clicked', {source:'sensitive input'}]);
  await api(page, 'track', ['arbitrary', {value:'sensitive input'}]);
  expect((await events(page)).filter((e: any) => e.name === 'cv_download_clicked' || e.name === 'arbitrary')).toEqual([]);
  await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
  const captured = (await events(page)).filter((e: any) => e.name === 'cv_download_clicked');
  expect(captured).toHaveLength(1);
  expect(captured[0].name).toBe('cv_download_clicked');
  expect(JSON.stringify(captured)).not.toContain('private');
  expect(JSON.stringify(captured)).not.toContain('fragment');
});

test('keyboard opens preferences and Escape closes it', async ({page}) => {
  await page.goto('/es/');
  const button = page.locator('[data-consent-banner] [data-privacy-open]');
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('[data-privacy-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName('Tus preferencias');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('CV is counted only on activation and scroll milestones are deduplicated', async ({page}) => {
  await page.goto('/');
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await api(page, 'clear');
  await page.locator('.profile-dock summary').click();
  expect((await events(page)).filter((e: any) => e.name === 'cv_download_clicked')).toHaveLength(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.profile-dock a[download]').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect((await events(page)).filter((e: any) => e.name === 'cv_download_clicked')).toHaveLength(1);
  const scroller = page.locator('.portfolio-scrollport');
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect.poll(async () => (await events(page)).filter((e: any) => e.name === 'scroll_depth_reached').length).toBe(4);
  await scroller.evaluate(el => { el.scrollTop = 0; });
  await scroller.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(200);
  expect((await events(page)).filter((e: any) => e.name === 'scroll_depth_reached').map((e: any) => e.properties.percent).sort((a: number,b: number)=>a-b)).toEqual([25,50,75,100]);
});

test('automatic carousel motion emits no interaction', async ({page}) => {
  await page.goto('/#projects');
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await api(page, 'clear');
  await page.waitForTimeout(1200);
  expect((await events(page)).filter((e: any) => e.name.startsWith('interactive_') || e.name.startsWith('3d_'))).toEqual([]);
  await page.locator('.wheel-item button.card-hit').first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await events(page)).some((e: any) => e.name === 'interactive_control_used' && e.properties.control === 'flip')).toBe(true);
});

test('real SDK sends only after consent and stops after withdrawal, with network intercepted', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'});
    Object.defineProperty(navigator, 'webdriver', {get: () => false});
    Object.defineProperty(navigator, 'userAgentData', {get: () => ({brands: [{brand:'Chromium', version:'131'}], mobile:false, platform:'Windows'})});
  });
  const requests: {url:string, body:string}[] = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    const raw = request.postDataBuffer() ?? Buffer.alloc(0);
    const body = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    requests.push({url: request.url(), body});
    return route.fulfill({status:200, contentType:'application/json', body:'{"status":1}'});
  });
  await page.goto('/?private=secret-sample#fragment');
  await api(page, 'useRealSdk');
  expect(requests).toEqual([]);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests.every(r => new URL(r.url).hostname === 'eu.i.posthog.com')).toBe(true);
  expect(JSON.stringify(requests)).not.toContain('secret-sample');
  expect(JSON.stringify(requests)).not.toContain('fragment');
  await expect.poll(() => requests.some(r => r.body.includes('cv_download_clicked'))).toBe(true);
  for (const request of requests) {
    const payload = JSON.parse(request.body);
    expect(payload.api_key).toBe('phc_LOCAL_TEST_ONLY_NOT_A_REAL_PROJECT');
    for (const event of payload.batch) {
      const p = event.properties;
      expect(p.token).toBe('phc_LOCAL_TEST_ONLY_NOT_A_REAL_PROJECT');
      expect(p.distinct_id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      expect(p.$session_id).toBe(p.distinct_id);
      expect(p.$process_person_profile).toBe(false);
      expect(p.$geoip_disable).toBe(true);
      expect(p.$ip).toBeNull();
      expect(p.schema_version).toBe(1);
      expect(p.page_id).toBe('home');
      expect(p.language).toBe('en');
      expect(p.device_type).toBe('desktop');
      expect(p.traffic_source).toBe('direct');
      const extra = event.event === 'section_viewed' ? ['section_id'] : event.event === 'cv_download_clicked' ? ['source'] : [];
      expect(Object.keys(p).sort()).toEqual(['schema_version','page_id','language','device_type','traffic_source','token','distinct_id','$session_id','$process_person_profile','$geoip_disable','$ip',...extra].sort());
    }
  }
  await api(page, 'withdraw');
  await page.waitForTimeout(500);
  const count = requests.length;
  await api(page, 'track', ['linkedin_clicked', {source:'profile'}]);
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(count);
  expect(await page.evaluate(() => sessionStorage.getItem('danimon.analytics.session.v1'))).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /posthog|ph_/i.test(k)))).toEqual([]);
});

for (const [lang, path, width] of [['en','/',1440],['es','/es/',390]] as const) {
  test(`consent visual evidence ${lang} ${width}`, async ({page}) => {
    await page.setViewportSize({width, height: width === 390 ? 844 : 900});
    await page.goto(path);
    await expect(page.locator('[data-consent-banner]')).toBeVisible();
    await page.screenshot({path:`output/qa/analytics/consent-${lang}-${width}.png`});
    await page.locator('[data-consent-banner] [data-privacy-open]').click();
    await expect(page.locator('[data-privacy-dialog]')).toBeVisible();
    await page.screenshot({path:`output/qa/analytics/preferences-${lang}-${width}.png`});
  });
}




test('privacy signal prevents optional providers despite acceptance', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', {get: () => true}));
  await page.goto('/');
  await api(page, 'save', [true, true]);
  await page.waitForTimeout(300);
  const status = await state(page);
  expect(status.signal).toBe(true);
  expect(status.providerReady).toBe(false);
  expect(status.loads).toBe(0);
  expect(status.cloudflareLoads).toBe(0);
  await page.locator('.privacy-access [data-privacy-open]').click();
  await expect(page.locator('[data-privacy-signal]')).toBeVisible();
  await expect(page.locator('[name=interactions]')).toBeDisabled();
});

test('provider failure does not break navigation or leak events', async ({page}) => {
  await page.goto('/');
  await api(page, 'setFailure', [true]);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).status).toBe('blocked');
  expect((await state(page)).providerReady).toBe(false);
  await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
  expect(await events(page)).toEqual([]);
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('.privacy-access [data-privacy-open]').click();
  await expect(page.locator('[data-privacy-dialog]')).toBeVisible();
});

test('a stale load cannot replace a later re-acceptance', async ({page}) => {
  await page.goto('/');
  await api(page, 'setDelay', [800]);
  await api(page, 'save', [false, true]);
  await api(page, 'withdraw');
  await api(page, 'setDelay', [0]);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await page.waitForTimeout(1000);
  expect((await state(page)).providerReady).toBe(true);
  expect((await events(page)).filter((e: any) => e.name === 'page_viewed')).toHaveLength(1);
});




for (const [lang, path] of [['en','/'], ['es','/es/']] as const) {
  test(`${lang} mobile consent accessibility with keyboard`, async ({page}) => {
    await page.setViewportSize({width:390, height:844});
    await page.goto(path);
    const banner = page.locator('[data-consent-banner]');
    await expect(banner).toBeVisible();
    const {default:AxeBuilder} = await import('@axe-core/playwright');
    expect((await new AxeBuilder({page}).include('[data-consent-banner]').analyze()).violations).toEqual([]);
    const open = banner.locator('[data-privacy-open]');
    await open.focus();
    await page.keyboard.press('Enter');
    const dialog = page.locator('[data-privacy-dialog]');
    await expect(dialog).toBeVisible();
    expect((await new AxeBuilder({page}).include('[data-privacy-dialog]').analyze()).violations).toEqual([]);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(open).toBeFocused();
  });
}

test('Cloudflare fake detects existing beacon and requires reload after withdrawal', async ({page}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.dataset.cfBeacon = '{}';
    document.head.appendChild(script);
  });
  await api(page, 'save', [true, false]);
  expect((await state(page)).cloudflareDuplicate).toBe(true);
  expect((await state(page)).cloudflareLoads).toBe(0);
  await api(page, 'withdraw');
  await page.reload();
  await page.evaluate(() => document.querySelector('script[data-cf-beacon]')?.remove());
  await api(page, 'save', [true, false]);
  expect((await state(page)).cloudflareLoads).toBe(1);
  await api(page, 'withdraw');
  expect((await state(page)).reloadRequired).toBe(true);
});

test('active time milestone fires once only with consent and activity', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install();
  await page.goto('/');
  expect((await state(page)).loads).toBe(0);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await page.clock.runFor(31000);
  await expect.poll(async () => (await events(page)).filter((e: any) => e.name === 'active_time_milestone' && e.properties.seconds === 30).length).toBe(1);
  await page.clock.runFor(1000);
  expect((await events(page)).filter((e: any) => e.name === 'active_time_milestone' && e.properties.seconds === 30)).toHaveLength(1);
});



test('real SDK works with sessionStorage denied using a stable in-memory session', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'});
    Object.defineProperty(navigator, 'webdriver', {get: () => false});
    Object.defineProperty(navigator, 'userAgentData', {get: () => ({brands:[{brand:'Chromium',version:'131'}],mobile:false,platform:'Windows'})});
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.getItem = function(key) { if (this === sessionStorage) throw new DOMException('Denied', 'SecurityError'); return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (this === sessionStorage) throw new DOMException('Denied', 'SecurityError'); return set.call(this, key, value); };
    Storage.prototype.removeItem = function(key) { if (this === sessionStorage) throw new DOMException('Denied', 'SecurityError'); return remove.call(this, key); };
  });
  const payloads: any[] = [];
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    const raw = request.postDataBuffer() ?? Buffer.alloc(0);
    const body = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    payloads.push({host:url.hostname, body:JSON.parse(body)});
    return route.fulfill({status:200, contentType:'application/json', body:'{"status":1}'});
  });
  await page.goto('/');
  await api(page, 'useRealSdk');
  expect(payloads).toEqual([]);
  await api(page, 'save', [false, true]);
  await expect.poll(async () => (await state(page)).providerReady).toBe(true);
  await api(page, 'track', ['cv_download_clicked', {source:'profile'}]);
  await expect.poll(() => payloads.flatMap(p => p.body.batch).some((e:any) => e.event === 'cv_download_clicked')).toBe(true);
  const sent = payloads.flatMap(p => p.body.batch);
  expect(sent.some((e:any) => e.event === 'page_viewed')).toBe(true);
  expect(payloads.every(p => p.host === 'eu.i.posthog.com')).toBe(true);
  const ids = new Set(sent.map((e:any) => e.properties.$session_id));
  expect(ids.size).toBe(1);
  expect([...ids][0]).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  await api(page, 'withdraw');
  await page.waitForTimeout(300);
  const count = payloads.length;
  await api(page, 'track', ['linkedin_clicked', {source:'profile'}]);
  await page.waitForTimeout(300);
  expect(payloads).toHaveLength(count);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /posthog|ph_/i.test(k)))).toEqual([]);
});
