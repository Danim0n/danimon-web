// Read-only production checks. HEAD avoids incrementing the PDF delivery counter.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import tls from 'node:tls';

const origin = 'https://danimon.party';
const out = 'output/qa/domain-production';
await mkdir(out, { recursive: true });
const report = { at: new Date().toISOString(), pages: [], assets: [], checks: [], limitations: [] };
const paths = ['/', '/es/', '/projects/local-events/', '/es/proyectos/eventos/',
  '/demo/facturas/', '/es/demo/facturas/', '/cookies/', '/es/cookies/'];
const assets = new Set(['/invoice-ocr/worker.min.js', '/invoice-ocr/eng.traineddata.gz',
  '/invoice-ocr/tesseract-core-lstm.wasm.js', '/invoice-ocr/tesseract-core-simd-lstm.wasm.js',
  '/invoice-ocr/tesseract-core-relaxedsimd-lstm.wasm.js']);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const headers = response => Object.fromEntries([...response.headers].filter(([key]) =>
  ['content-type', 'cache-control', 'nel', 'report-to', 'set-cookie', 'x-content-type-options',
    'strict-transport-security', 'referrer-policy', 'content-security-policy', 'x-frame-options'].includes(key)));
async function request(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}
function check(name, condition) {
  report.checks.push({ name, passed: Boolean(condition) });
}
try {
  for (const path of paths) {
    const response = await request(origin + path);
    const html = await response.text();
    const links = [...html.matchAll(/<link\b[^>]*>/g)].map(match => attrs(match[0]));
    const canonical = links.find(link => link.rel === 'canonical')?.href;
    const languages = links.filter(link => link.hreflang);
    report.pages.push({ path, status: response.status, finalUrl: response.url, canonical, languages, headers: headers(response) });
    check(`${path}: HTTPS 200 without redirect`, response.status === 200 && response.url === origin + path);
    check(`${path}: canonical`, canonical === origin + path);
    check(`${path}: hreflang`, ['en', 'es', 'x-default'].every(language => languages.some(link => link.hreflang === language && link.href.startsWith(origin + '/'))));
    check(`${path}: no unexpected beacon`, !/static\.cloudflareinsights\.com\/beacon|data-cf-beacon=|posthog/i.test(html));
    check(`${path}: no mixed content`, !/(?:src|href)="http:\/\//i.test(html));
    check(`${path}: no analytics cookie`, !response.headers.has('set-cookie'));
    for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*>/g)) {
      const attributes = attrs(match[0]);
      const value = attributes.src ?? (['stylesheet', 'preload', 'modulepreload'].includes(attributes.rel) ? attributes.href : null);
      if (!value || value.startsWith('data:')) continue;
      const url = new URL(value, origin + path);
      check(`resource origin ${url.pathname}`, url.origin === origin);
      if (url.origin === origin) assets.add(url.pathname);
    }
  }
  for (const path of assets) {
    const response = await request(origin + path);
    const bytes = await response.arrayBuffer();
    report.assets.push({ path, status: response.status, bytes: bytes.byteLength, contentType: response.headers.get('content-type') });
    check(`asset ${path}`, response.status === 200 && bytes.byteLength > 0);
  }
  for (const [path, status] of [['/robots.txt', 200], ['/sitemap.xml', 200], ['/this-page-does-not-exist/', 404]]) {
    const response = await request(origin + path);
    const body = await response.text();
    report.pages.push({ path, status: response.status, headers: headers(response) });
    check(`${path}: status`, response.status === status);
    if (path === '/robots.txt') check('robots sitemap', body.includes(origin + '/sitemap.xml'));
    if (path === '/sitemap.xml') check('sitemap routes', paths.every(route => body.includes(`<loc>${origin}${route}</loc>`)));
    if (status === 404) check('custom 404', /noindex|not found|no encontrada|404/i.test(body));
  }
  for (const url of [origin + '/cv/daniel-rosell-martin.pdf', 'https://danimon-web.pages.dev/']) {
    const response = await request(url, { method: 'HEAD' });
    report.pages.push({ path: url, method: 'HEAD', status: response.status, headers: headers(response) });
    check(`${url}: available`, response.status === 200);
  }
  const redirect = await request('http://danimon.party/', { redirect: 'manual' });
  report.httpRedirect = { status: redirect.status, location: redirect.headers.get('location') };
  check('HTTP redirects to HTTPS', [301, 302, 307, 308].includes(redirect.status) && redirect.headers.get('location') === origin + '/');
  try {
    report.certificate = await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: 'danimon.party', port: 443, servername: 'danimon.party', rejectUnauthorized: true }, () => {
        const certificate = socket.getPeerCertificate();
        resolve({ authorized: socket.authorized, protocol: socket.getProtocol(), subject: certificate.subject,
          issuer: certificate.issuer, validFrom: certificate.valid_from, validTo: certificate.valid_to, subjectAltName: certificate.subjectaltname });
        socket.destroy();
      });
      socket.setTimeout(10000, () => socket.destroy(new Error('TLS inspection timeout')));
      socket.on('error', reject);
    });
    check('TLS certificate trusted and hostname valid', report.certificate.authorized);
  } catch (error) {
    report.limitations.push(`Direct TLS metadata inspection: ${error.message}; HTTPS fetch still validates TLS normally.`);
  }
} catch (error) {
  report.error = error.message;
} finally {
  report.passed = report.checks.filter(item => item.passed).length;
  report.failed = report.checks.filter(item => !item.passed);
  await writeFile(`${out}/http.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, error: report.error, certificate: report.certificate, limitations: report.limitations }, null, 2));
}
assert.equal(report.error, undefined);
assert.equal(report.failed.length, 0);
