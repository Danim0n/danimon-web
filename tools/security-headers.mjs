import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { securityHeaders } from '../src/lib/security-policy.ts';

const hash = source => `'sha256-${createHash('sha256').update(source).digest('base64')}'`;

function mergeGeneratedHeaders(source, generatedHeaders) {
  const lines = source.split(/\r?\n/);
  const retained = [];
  const globalEntries = [];
  const rulePaths = new Set();
  let globalRules = 0;
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      retained.push(line);
      index++;
      continue;
    }
    if (/^\s/.test(line)) throw new Error('Header entries must follow a URL rule.');
    const path = line.trim();
    if (rulePaths.has(path)) throw new Error(`Duplicate _headers rule: ${path}`);
    rulePaths.add(path);
    const block = [line];
    index++;
    while (index < lines.length && /^\s/.test(lines[index])) block.push(lines[index++]);
    if (path !== '/*') {
      retained.push(...block);
      continue;
    }
    globalRules++;
    for (const entry of block.slice(1)) {
      const text = entry.trim();
      if (text.startsWith('! ')) globalEntries.push([text.slice(2), null]);
      else {
        const colon = text.indexOf(':');
        if (colon < 1) throw new Error(`Unsupported _headers entry: ${text}`);
        globalEntries.push([text.slice(0, colon).trim(), text.slice(colon + 1).trim()]);
      }
    }
  }
  if (globalRules > 1) throw new Error('Duplicate global /* rules in source _headers.');

  const names = new Set();
  for (const [name] of globalEntries) {
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error(`Duplicate global header entry: ${name}`);
    names.add(key);
  }
  for (const [name, value] of Object.entries(generatedHeaders)) {
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error(`Generated header duplicates source global entry: ${name}`);
    names.add(key);
    globalEntries.push([name, value]);
  }
  const globalBlock = ['/*', ...globalEntries.map(([name, value]) => value === null
    ? `  ! ${name}` : `  ${name}: ${value}`)];
  const prefix = retained.join('\n').replace(/\n+$/, '');
  return `${prefix ? `${prefix}\n` : ''}${globalBlock.join('\n')}\n`;
}

export async function generateSecurityHeaders(directory, { manifestPath } = {}) {
  const root = resolve(directory), scripts = new Set(), styles = new Set(), pages = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        const html = await readFile(file, 'utf8');
        // Only our own generated HTML is parsed here, never visitor input.
        for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
          if (!/\bsrc\s*=/i.test(attributes) && source) scripts.add(hash(source));
        for (const [, source] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) styles.add(hash(source));
        pages.push(relative(root, file).replaceAll('\\', '/'));
      }
    }
  }
  await visit(root);
  if (!pages.length) throw new Error('Cannot generate CSP without built HTML.');
  const policy = [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'none'",
    // Tesseract compiles WASM in its same-origin Worker. This does not allow JS eval.
    `script-src 'self' 'wasm-unsafe-eval' ${[...scripts].sort().join(' ')}`,
    "script-src-attr 'none'",
    `style-src 'self' ${[...styles].sort().join(' ')}`,
    // The carousel/shader layout writes CSS variables; there are no inline JS handlers.
    "style-src-attr 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'self'", "worker-src 'self'", "frame-src 'none'", "media-src 'none'",
  ].join('; ');
  const headers = { ...securityHeaders, 'Content-Security-Policy': policy };
  const source = await readFile(join(root, '_headers'), 'utf8');
  const output = mergeGeneratedHeaders(source, headers);
  if (output.split(/\r?\n/).some(line => line.length > 2000)) throw new Error('Cloudflare header line limit exceeded.');
  await writeFile(join(root, '_headers'), output);
  const manifest = { pages: pages.sort(), inlineScriptHashes: [...scripts], inlineStyleHashes: [...styles], headers };
  const manifestFile = manifestPath ?? 'output/qa/security-audit/csp-build.json';
  await mkdir(dirname(manifestFile), { recursive: true });
  await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
  return manifest;
}
