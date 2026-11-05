import { chromium } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const directory = 'output/qa/analytics';
await mkdir(directory, { recursive: true });
const report = { timestamp: new Date().toISOString(), base: 'http://127.0.0.1:4325', environment: 'Chromium headless, desktop emulation; no CPU/network throttling', requests: [], loadedJavaScript: [], bundles: [], findings: [], checks: [] };
async function scan(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const file = join(path, item.name);
    if (item.isDirectory()) { await scan(file); continue; }
    if (!/\.(js|html|json|css)$/.test(file)) continue;
    const body = await readFile(file);
    if (file.endsWith('.js')) report.bundles.push({ file, bytes: body.length, gzipBytes: gzipSync(body).length });
    const source = body.toString();
    for (const [label, pattern] of Object.entries({
      openai: /sk-(?:proj-)?[A-Za-z0-9_-]{30,}/,
      github: /gh[pousr]_[A-Za-z0-9_]{30,}/,
      aws: /(?<![A-Za-z0-9+/])AKIA[A-Z0-9]{16}(?![A-Za-z0-9+/])/,
      posthogPrivate: /phx_[A-Za-z0-9_-]{20,}/,
      privateKey: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    })) if (pattern.test(source)) report.findings.push({ file, label });
  }
}
await scan('dist');
const browser = await chromium.launch({ executablePath: '.cache/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const responses = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    report.requests.push({ origin: url.origin, path: url.pathname });
    if (url.origin !== report.base) return route.abort();
    return route.continue();
  });
  page.on('response', response => {
    if (/javascript/.test(response.headers()['content-type'] ?? '')) responses.push(response);
  });
  const document = await page.goto(report.base + '/es/?private=not-an-event');
  const html = await document.text();
  const inline = Array.from(html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g), match => match[1]).join('\n');
  report.inlineModuleJavaScript = { bytes: Buffer.byteLength(inline), gzipBytes: gzipSync(inline).length };
  await page.waitForLoadState('networkidle');
  for (const response of responses) {
    const body = await response.body();
    report.loadedJavaScript.push({ file: new URL(response.url()).pathname, bytes: body.length, gzipBytes: gzipSync(body).length });
  }
  assert.equal(await page.evaluate(() => typeof window.__analyticsTest), 'undefined');
  assert.equal(await page.locator('[data-consent-banner]').isVisible(), false);
  await page.locator('.privacy-access button').click();
  await page.locator('[data-privacy-dialog] [data-consent-accept]').click();
  await page.waitForTimeout(300);
  assert.equal(report.requests.filter(r => r.origin !== report.base).length, 0);
  assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.includes('analytics') || k.startsWith('ph_'))), []);
  report.checks.push('Default off, including after accept: no provider request or optional identity; no test API.');
  report.checks.push('Generated HTML/CSS/JS/JSON scanned for selected private-key patterns; no private environment files read.');
  assert.deepEqual(report.findings, []);
  report.totalLoadedJavaScriptGzipBytes = report.loadedJavaScript.reduce((total, item) => total + item.gzipBytes, 0);
  report.note = 'gzip sizes are local estimates, not negotiated server compression. No before/after Lighthouse comparison is claimed. SDK chunks are present on disk but must not be requested before consent.';
} finally {
  await browser.close();
  await writeFile(join(directory, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ checks: report.checks.length, privateKeyPatterns: report.findings.length, loadedJavaScriptGzipBytes: report.totalLoadedJavaScriptGzipBytes }));
