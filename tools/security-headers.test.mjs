import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateSecurityHeaders } from './security-headers.mjs';
import { builtAssets } from './serve-built-assets.mjs';

test('generated global rule merges NEL and Report-To removal with CSP and shared security headers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pages-headers-'));
  try {
    await mkdir(join(directory, 'nested'), { recursive: true });
    await writeFile(join(directory, '_headers'), [
      '# Existing Pages headers',
      '/*',
      '  NEL: {"max_age":0}',
      '  ! Report-To',
      '',
      '/nested/',
      '  Cache-Control: public, max-age=0, must-revalidate, no-transform',
      '',
    ].join('\n'));
    const script = 'window.releaseCheck = true;';
    const style = 'body { color: red; }';
    await writeFile(join(directory, 'index.html'), `<script>${script}</script><style>${style}</style>`);

    const manifest = await generateSecurityHeaders(directory, { manifestPath: join(directory, 'csp-build.json') });
    const headerFile = await readFile(join(directory, '_headers'), 'utf8');
    assert.equal(headerFile.split(/^\/\*$/m).length - 1, 1, 'must output exactly one global route');
    assert.match(headerFile, /^  NEL: \{"max_age":0\}$/m);
    assert.match(headerFile, /^  ! Report-To$/m);
    assert.match(headerFile, /^  Content-Security-Policy: /m);
    assert.match(headerFile, /^  X-Content-Type-Options: nosniff$/m);
    assert.match(headerFile, /^\/nested\/$/m);
    const expectedScriptHash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
    const expectedStyleHash = `'sha256-${createHash('sha256').update(style).digest('base64')}'`;
    assert.ok(manifest.headers['Content-Security-Policy'].includes(expectedScriptHash));
    assert.ok(manifest.headers['Content-Security-Policy'].includes(expectedStyleHash));

    const fetchAsset = await builtAssets(directory);
    const response = await fetchAsset(new Request('https://portfolio.test/'));
    assert.equal(response.headers.get('NEL'), '{"max_age":0}');
    assert.equal(response.headers.get('Report-To'), null);
    assert.ok(response.headers.get('Content-Security-Policy').includes(expectedScriptHash));
    assert.ok(response.headers.get('Content-Security-Policy').includes(expectedStyleHash));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local Pages adapter rejects duplicate URL rules instead of masking edge merge behavior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pages-duplicate-headers-'));
  try {
    await writeFile(join(directory, '_headers'), '/*\n  NEL: {"max_age":0}\n\n/*\n  ! Report-To\n');
    await assert.rejects(() => builtAssets(directory), /Duplicate _headers rule: \/\*/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local Pages adapter rejects repeated matching header names rather than last-write-wins', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pages-duplicate-header-values-'));
  try {
    await writeFile(join(directory, '_headers'), '/*\n  X-Test: global\n\n/\n  X-Test: page\n');
    const fetchAsset = await builtAssets(directory);
    await assert.rejects(() => fetchAsset(new Request('https://portfolio.test/')), /Header X-Test is applied more than once/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
