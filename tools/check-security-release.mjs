import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect as tlsConnect } from 'node:tls';
import { mkdir, writeFile } from 'node:fs/promises';

const hosts = ['https://danimon.party', 'https://danimon-web.pages.dev'];
const inertResponseCsp = "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const pagePaths = [
  '/', '/es/', '/projects/local-events/', '/es/proyectos/eventos/',
  '/demo/facturas/', '/es/demo/facturas/', '/privacy/', '/es/privacidad/',
  '/cookies/', '/es/cookies/',
];
const report = {
  checkedAt: new Date().toISOString(),
  scope: 'Read-only release checks: 10 HTML pages + 404 per host, limited same-host assets, HEAD only for CV/API/admin, three invalid POSTs per host. No valid analytics event or CV GET.',
  hosts: [],
  totalHttpRequests: 0,
  limits: { maxHttpRequests: 40, maxSameHostAssetsPerHost: 3 },
  warnings: [],
  failures: [],
};

function fail(host, path, reason) { report.failures.push({ host, path, reason }); }
function header(response, name) { return response.headers.get(name) ?? ''; }
function fullHeaders(response) { return Object.fromEntries([...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b))); }
function hashInline(source) { return `'sha256-${createHash('sha256').update(source).digest('base64')}'`; }
function attr(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}
function directivesFor(policy) {
  return policy.split(';').map(part => part.trim().split(/\s+/)).filter(parts => parts[0]);
}
function requireSecurityHeaders(response, host, path) {
  const got = Object.fromEntries(['content-security-policy', 'x-frame-options', 'x-content-type-options',
    'referrer-policy', 'permissions-policy', 'strict-transport-security'].map(name => [name, header(response, name)]));
  if (!got['content-security-policy']) fail(host, path, 'missing Content-Security-Policy');
  if (got['x-frame-options'].toLowerCase() !== 'deny') fail(host, path, 'X-Frame-Options is not DENY');
  if (got['x-content-type-options'].toLowerCase() !== 'nosniff') fail(host, path, 'X-Content-Type-Options is not nosniff');
  if (!['strict-origin-when-cross-origin', 'no-referrer'].includes(got['referrer-policy'].toLowerCase()))
    fail(host, path, 'unexpected or missing Referrer-Policy');
  for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb'])
    if (!new RegExp(`(?:^|[,;\\s])${feature}=\\(\\)`, 'i').test(got['permissions-policy']))
      fail(host, path, `Permissions-Policy does not disable ${feature}`);
  const hsts = got['strict-transport-security'];
  if (!/max-age=\d+/i.test(hsts) || /includesubdomains|preload/i.test(hsts))
    fail(host, path, 'HSTS missing or unexpectedly includes subdomains/preload');
  requireNetworkReportingOff(response, host, path);
  return got['content-security-policy'];
}
function requireNetworkReportingOff(response, host, path) {
  let disabled = false;
  try { disabled = JSON.parse(header(response, 'nel')).max_age === 0; } catch { /* missing or malformed policy */ }
  if (!disabled) fail(host, path, 'NEL is missing or max_age is not 0');
  if (header(response, 'report-to')) fail(host, path, 'Report-To header is present');
  if (header(response, 'set-cookie')) fail(host, path, 'response sets a cookie');
}
function checkCspHashes(policy, html, host, path) {
  const policies = policy.split(',').map(directivesFor);
  const snippets = [];
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    if (!/\bsrc\s*=/i.test(attributes) && source) snippets.push(['script-src', hashInline(source)]);
  for (const [, source] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) snippets.push(['style-src', hashInline(source)]);
  for (const [directive, digest] of snippets) {
    for (const policyDirectives of policies) {
      const specified = policyDirectives.find(parts => parts[0].toLowerCase() === directive);
      const fallback = policyDirectives.find(parts => parts[0].toLowerCase() === 'default-src');
      const values = specified?.slice(1) ?? fallback?.slice(1) ?? [];
      if (!values.includes(digest)) fail(host, path, `inline ${directive} hash missing from effective CSP`);
    }
  }
  for (const policyDirectives of policies) {
    const scripts = policyDirectives.find(parts => parts[0].toLowerCase() === 'script-src')?.slice(1) ?? [];
    if (scripts.some(value => ['\'unsafe-inline\'', '\'unsafe-eval\''].includes(value)))
      fail(host, path, 'CSP permits unsafe inline/eval JavaScript');
  }
  return snippets.length;
}
function checkNoExternalResourceTags(html, host, pagePath) {
  const resources = [];
  for (const [, tag, attributes] of html.matchAll(/<(script|img|source|iframe|link)\b([^>]*)>/gi)) {
    const rel = attr(attributes, 'rel').toLowerCase();
    const value = tag.toLowerCase() === 'link'
      ? (rel === 'stylesheet' || rel === 'preload' || rel === 'modulepreload' ? attr(attributes, 'href') : '')
      : attr(attributes, 'src');
    if (!value) continue;
    const url = new URL(value, host + pagePath);
    if (url.protocol === 'data:' || url.protocol === 'blob:') continue;
    if (url.origin !== host) fail(host, pagePath, `external resource tag ${tag} ${url.origin}`);
    else if (['script', 'link'].includes(tag.toLowerCase()) && (tag.toLowerCase() !== 'link' || rel === 'stylesheet')) resources.push(url);
  }
  return [...new Map(resources.map(url => [url.href, url])).values()];
}
function checkNoBeaconOrPosthog(html, host, path) {
  if (/cloudflareinsights|posthog|phc_[a-z0-9]{20,}/i.test(html))
    fail(host, path, 'analytics beacon/SDK marker found in HTML');
}
async function request(url, init, host, path) {
  report.totalHttpRequests++;
  if (report.totalHttpRequests > report.limits.maxHttpRequests) throw new Error('HTTP request limit exceeded');
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(7_000) });
  } catch (error) {
    fail(host, path, `request failed: ${error?.name ?? 'Error'}`);
    return null;
  }
}
async function inspectTls(host) {
  const hostname = new URL(host).hostname;
  return await new Promise(resolve => {
    let settled = false;
    const done = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const socket = tlsConnect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true });
    const timer = setTimeout(() => { socket.destroy(); done({ status: 'unavailable', reason: 'TLS handshake timeout' }); }, 5_000);
    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate();
      done({ status: socket.authorized ? 'valid' : 'invalid', authorized: socket.authorized,
        expiresAt: certificate.valid_to ?? null, subjectAltNamePresent: Boolean(certificate.subjectaltname) });
      socket.destroy();
    });
    socket.once('error', error => {
      const networkUnavailable = ['ENETUNREACH', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(error.code);
      done({ status: networkUnavailable ? 'unavailable' : 'invalid', reason: networkUnavailable ? error.code : 'TLS certificate/handshake error' });
      socket.destroy();
    });
  });
}

for (const host of hosts) {
  const hostReport = { host, tls: await inspectTls(host), htmlPages: [], headChecks: [], invalidPosts: [], sameHostAssets: [] };
  report.hosts.push(hostReport);
  if (hostReport.tls.status === 'unavailable') report.warnings.push(`${host}: TLS could not be checked from this runner (${hostReport.tls.reason}); HTTP checks still determine reachability.`);
  if (hostReport.tls.status === 'invalid') fail(host, 'TLS', hostReport.tls.reason ?? 'certificate not authorized');

  const pageResources = new Map();
  const paths = [...pagePaths, '/__security_release_not_found_20261106/'];
  for (const path of paths) {
    const response = await request(host + path, { method: 'GET' }, host, path);
    const result = { path, status: response?.status ?? null, contentType: response ? header(response, 'content-type') : '', fullHeaders: response ? fullHeaders(response) : {}, inlineHashesChecked: 0 };
    hostReport.htmlPages.push(result);
    if (!response) continue;
    const expectedStatus = path.startsWith('/__security_release_not_found_') ? 404 : 200;
    if (response.status !== expectedStatus) fail(host, path, `expected ${expectedStatus}, received ${response.status}`);
    const policy = requireSecurityHeaders(response, host, path);
    if (path.startsWith('/cv/') && policy !== inertResponseCsp)
      fail(host, path, 'CV response did not use the Pages Function inert CSP');
    if (path === '/') hostReport.rootCsp = policy;
    const html = response.headers.get('content-type')?.toLowerCase().includes('text/html') ? await response.text() : '';
    if (!html) { fail(host, path, 'response is not HTML'); continue; }
    result.inlineHashesChecked = checkCspHashes(policy, html, host, path);
    checkNoBeaconOrPosthog(html, host, path);
    const resources = checkNoExternalResourceTags(html, host, path);
    if (path === '/') for (const url of resources) pageResources.set(url.href, url);
  }

  const resourcesToCheck = [...pageResources.values()].slice(0, report.limits.maxSameHostAssetsPerHost);
  for (const url of resourcesToCheck) {
    const response = await request(url, { method: 'GET' }, host, url.pathname);
    const item = { path: url.pathname, status: response?.status ?? null, contentType: response ? header(response, 'content-type') : '', fullHeaders: response ? fullHeaders(response) : {} };
    hostReport.sameHostAssets.push(item);
    if (response?.status !== 200) fail(host, url.pathname, `same-host resource expected 200, received ${response?.status ?? 'no response'}`);
    if (response) {
      requireNetworkReportingOff(response, host, url.pathname);
      if (/set-cookie/i.test(response.headers.get('set-cookie') ?? '')) fail(host, url.pathname, 'resource sets a cookie');
      if (['text/css', 'application/javascript', 'text/javascript'].some(type => item.contentType.toLowerCase().includes(type))) {
        const body = await response.text();
        if (/cloudflareinsights|posthog|phc_[a-z0-9]{20,}/i.test(body)) fail(host, url.pathname, 'analytics beacon/SDK marker found in sampled resource');
        for (const [, value] of body.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
          const ref = value.trim();
          if (!ref || ref.startsWith('data:') || ref.startsWith('#')) continue;
          const urlRef = new URL(ref, url);
          if (urlRef.origin !== host) fail(host, url.pathname, `external CSS asset reference ${urlRef.origin}`);
        }
      }
    }
  }

  for (const path of ['/cv/daniel-rosell-martin.pdf', '/api/interactions', '/api/admin']) {
    const response = await request(host + path, { method: 'HEAD' }, host, path);
    const item = { path, status: response?.status ?? null, allow: response ? header(response, 'allow') : '', fullHeaders: response ? fullHeaders(response) : {} };
    hostReport.headChecks.push(item);
    if (!response) continue;
    const expectedStatus = path.startsWith('/cv/') ? 200 : path === '/api/interactions' ? 405 : 404;
    if (response.status !== expectedStatus) fail(host, path, `HEAD expected ${expectedStatus}, received ${response.status}`);
    if (path === '/api/interactions' && item.allow !== 'POST') fail(host, path, '405 response is missing Allow: POST');
    const policy = requireSecurityHeaders(response, host, path);
    if (path.startsWith('/cv/')) {
      if (policy !== inertResponseCsp) fail(host, path, 'CV did not use Pages Function inert CSP');
      if (header(response, 'cache-control') !== 'no-store') fail(host, path, 'CV must bypass outer caches with no-store');
    }
  }

  const otherOrigin = hosts.find(candidate => candidate !== host);
  const invalidPosts = [
    { label: 'malformed-json', headers: { Origin: host, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: '{"broken":' , expected: 400 },
    { label: 'cross-origin', headers: { Origin: otherOrigin, 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'application/json' }, body: '{}', expected: 403 },
    { label: 'wrong-content-type', headers: { Origin: host, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'text/plain' }, body: '', expected: 415 },
  ];
  for (const item of invalidPosts) {
    const response = await request(host + '/api/interactions', { method: 'POST', headers: item.headers, body: item.body }, host, `/api/interactions (${item.label})`);
    const result = { scenario: item.label, status: response?.status ?? null, fullHeaders: response ? fullHeaders(response) : {}, emptyBody: false };
    hostReport.invalidPosts.push(result);
    if (!response) continue;
    if (response.status !== item.expected) fail(host, `/api/interactions (${item.label})`, `expected ${item.expected}, received ${response.status}`);
    requireSecurityHeaders(response, host, `/api/interactions (${item.label})`);
    result.emptyBody = (await response.text()) === '';
    if (!result.emptyBody) fail(host, `/api/interactions (${item.label})`, 'invalid request response body should be empty');
  }
}

if (report.totalHttpRequests > report.limits.maxHttpRequests) fail('all', 'request-budget', 'request cap exceeded');
report.status = report.failures.length === 0 ? 'passed' : 'failed';
report.requestCountWithinLimit = report.totalHttpRequests <= report.limits.maxHttpRequests;
await mkdir('output/qa/security-deployment', { recursive: true });
await writeFile('output/qa/security-deployment/release-http-followup.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, totalHttpRequests: report.totalHttpRequests, hosts: report.hosts.map(({ host, tls, htmlPages, headChecks, invalidPosts, sameHostAssets }) => ({ host, tls, htmlPages: htmlPages.length, headChecks, invalidPosts, sameHostAssets })), warnings: report.warnings, failures: report.failures }, null, 2));
process.exitCode = report.status === 'passed' ? 0 : 1;
