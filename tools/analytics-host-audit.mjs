import { build, preview } from 'astro';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

process.env.PUBLIC_ANALYTICS_MODE = 'production';
process.env.PUBLIC_POSTHOG_KEY = 'phc_LOCAL_TEST_ONLY_NOT_A_REAL_PROJECT';
process.env.PUBLIC_CLOUDFLARE_TOKEN = '';
process.env.PUBLIC_CLOUDFLARE_MANUAL_AUDITED = 'false';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const config = { outDir: './output/analytics-host-test-dist/', server: { host: '127.0.0.1', port: 4332 } };
const results = [];
let server;
let browser;
let code = 1;
try {
  await build(config);
  server = await preview(config);
  browser = await chromium.launch({ executablePath: '.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
  for (const origin of ['https://danimon.party', 'https://preview.danimon.party', 'https://danimon.party.attacker.test', 'http://danimon.party']) {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'userAgentData', { get: () => ({ brands: [{ brand: 'Chromium', version: '130' }] }) });
    });
    const remote = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        remote.push(url.hostname);
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' });
      }
      const response = await route.fetch({ url: 'http://127.0.0.1:4332' + url.pathname + url.search });
      return route.fulfill({ response });
    });
    await page.goto(origin + '/es/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('[data-consent-banner]');
    const enabled = await banner.isVisible();
    assert.equal(enabled, origin === 'https://danimon.party');
    if (enabled) await banner.locator('[data-consent-accept]').click();
    else {
      await page.locator('.privacy-access button').click();
      await page.locator('[data-privacy-dialog] [data-consent-accept]').click();
    }
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => typeof window.__analyticsTest), 'undefined');
    if (enabled) {
      await page.waitForFunction(() => sessionStorage.getItem('danimon.analytics.session.v1'));
      for (let attempt = 0; attempt < 30 && !remote.length; attempt++) await page.waitForTimeout(100);
      assert.ok(remote.length > 0);
      assert.ok(remote.every(host => host === 'eu.i.posthog.com'));
      await page.locator('.privacy-access button').click();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.locator('[data-consent-withdraw]').click(),
      ]);
      const sent = remote.length;
      await page.waitForTimeout(250);
      assert.equal(remote.length, sent);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('danimon.analytics.session.v1')), null);
    } else {
      assert.deepEqual(remote, []);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('danimon.analytics.session.v1')), null);
    }
    results.push({ origin, enabled, testApi: false, interceptedIngestionRequests: remote.length,
      withdrawalReloadVerified: enabled, optionalSessionAfterWithdrawal: false });
    await page.close();
  }
  code = 0;
} catch (error) {
  results.push({ error: String(error) });
  console.error(error);
} finally {
  await mkdir('output/qa/analytics', { recursive: true });
  await writeFile('output/qa/analytics/host-audit.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    conditions: 'Production-mode build with a deliberately invalid public test token. Synthetic origins and ALL provider requests fulfilled locally; no DNS or account access. Human browser emulation disables bot detection only for this test.',
    results,
  }, null, 2) + '\n');
  await browser?.close();
  await server?.stop();
  process.exit(code);
}
