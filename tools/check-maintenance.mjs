import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { AxeBuilder } from '@axe-core/playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${process.cwd()}/.cache/ms-playwright`;
const { chromium } = await import('@playwright/test');
const origin = 'http://127.0.0.1:4373';
const persistence = 'output/maintenance-local/state';
const evidence = 'output/qa/maintenance';
const wrangler = fileURLToPath(new URL('./bin/wrangler.js', import.meta.resolve('wrangler/package.json')));
await mkdir(evidence, { recursive: true });

function setMode(value) {
  const result = spawnSync(process.execPath, [wrangler, 'kv', 'key', 'put', 'mode', value,
    '--binding', 'SITE_CONFIG', '--local', '--persist-to', persistence], {
    encoding: 'utf8', env: { ...process.env, WRANGLER_LOG_PATH: 'output/maintenance-local/logs', WRANGLER_SEND_METRICS: 'false' },
  });
  assert.equal(result.status, 0, result.stderr);
}

const styles = (await readdir('dist/_astro')).find(file => file.endsWith('.css'));
assert.ok(styles);
const asset = `/_astro/${styles}`;
const cv = '/cv/daniel-rosell-martin.pdf';
const paths = ['/', '/index.html', '/es/', '/es/index.html', '/projects/local-events/', '/es/proyectos/eventos/',
  '/demo/facturas/', '/es/demo/facturas/', '/privacy/', '/es/privacidad/', '/cookies/', '/sitemap.xml', '/robots.txt',
  '/api/interactions', cv, asset, '/not-a-route', '/es/?mode=normal&maintenance=false'];
const report = { normal: [], maintenance: [], accessibility: [], restored: [] };
const config = JSON.parse(await readFile('dist/_routes.json', 'utf8'));
assert.deepEqual(config, { version: 1, include: ['/*'], exclude: [] });

async function fetchPath(path, options) {
  return fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(6000), ...options });
}

async function normal(results) {
  for (const [path, status] of [['/', 200], ['/es/', 200], ['/projects/local-events/', 200], ['/es/proyectos/eventos/', 200],
    ['/demo/facturas/', 200], ['/es/demo/facturas/', 200], ['/privacy/', 301], ['/es/privacidad/', 301],
    ['/robots.txt', 200], [asset, 200], [cv, 200], ['/api/interactions', 405], ['/not-a-route', 404]]) {
    const response = await fetchPath(path, { method: 'HEAD' });
    assert.equal(response.status, status, path);
    if (path === '/') {
      assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
      assert.match(response.headers.get('cache-control'), /must-revalidate/);
    }
    if (path === cv) assert.match(response.headers.get('content-type'), /application\/pdf/);
    if (path === '/api/interactions') assert.equal(response.headers.get('allow'), 'POST');
    if (path === '/privacy/') assert.equal(response.headers.get('location'), '/');
    if (path === '/es/privacidad/') assert.equal(response.headers.get('location'), '/es/');
    results.push({ path, status });
  }
}

let browser;
try {
  setMode('normal');
  await normal(report.normal);
  const before = await fetchPath('/');
  const html = await before.text();
  assert.match(html, /Daniel/);
  const etag = before.headers.get('etag');
  assert.ok(etag);

  setMode('maintenance');
  for (const path of paths) {
    const response = await fetchPath(path, { headers: { 'If-None-Match': etag, 'Accept-Language': 'en' } });
    assert.equal(response.status, 503, path);
    assert.equal(response.headers.get('retry-after'), '300');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('location'), null);
    const body = await response.text();
    assert.match(body, /temporarily under maintenance|temporalmente en mantenimiento/);
    assert.doesNotMatch(body, /<script|<form|Daniel|\.pdf|_astro/);
    report.maintenance.push({ path, status: response.status });
  }
  const head = await fetchPath(cv, { method: 'HEAD', headers: { Range: 'bytes=0-99' } });
  assert.equal(head.status, 503);
  assert.equal(await head.text(), '');
  const post = await fetchPath('/api/interactions', { method: 'POST', body: '[]' });
  assert.equal(post.status, 503);

  browser = await chromium.launch();
  for (const [name, locale, viewport] of [
    ['desktop-es', 'es-ES', { width: 1360, height: 900 }],
    ['mobile-en', 'en-GB', { width: 320, height: 720 }],
  ]) {
    const context = await browser.newContext({ locale, viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    assert.equal((await page.goto(origin)).status(), 503);
    const lang = locale.slice(0, 2);
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
    assert.ok(await page.getByRole('heading', { level: 1 }).isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('.line').evaluate(line => getComputedStyle(line, '::after').animationName), 'none');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(results.violations.map(issue => issue.id), []);
    assert.deepEqual(pageErrors, []);
    await page.screenshot({ path: `${evidence}/${name}.png` });
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('a:focus').count(), 1);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\?lang=(?:es|en)$/);
    assert.notEqual(await page.locator('html').getAttribute('lang'), lang);
    await context.close();
    report.accessibility.push({ name, locale, viewport, violations: results.violations.length });
  }
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  assert.equal((await noJs.goto(`${origin}/es/demo/facturas/`)).status(), 503);
  assert.ok(await noJs.getByRole('heading', { name: 'Web temporalmente en mantenimiento' }).isVisible());
  report.noJavaScript = true;

  setMode('normal');
  await normal(report.restored);
  assert.equal(await (await fetchPath('/')).text(), html);
  report.identicalHomeAfterRestore = true;
  await writeFile(`${evidence}/local-results.json`, JSON.stringify(report, null, 2));
  console.log(`Normal → 503 → normal: ${report.normal.length} normal / ${paths.length} blocked / ${report.restored.length} restored. HEAD, POST, languages, keyboard and reduced motion passed.`);
} finally {
  try { setMode('normal'); }
  finally { await browser?.close(); }
}
