import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { securityHeaders } from '../src/lib/security-policy.ts';

const hash = source => `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
export async function generateSecurityHeaders(directory) {
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
  const lines = ['# Generated after build. Edit tools/security-headers.mjs, not dist/_headers.', '/*',
    ...Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`)];
  if (lines.some(line => line.length > 2000)) throw new Error('Cloudflare header line limit exceeded.');
  await writeFile(join(root, '_headers'), source + '\n' + lines.join('\n') + '\n');
  const manifest = { pages: pages.sort(), inlineScriptHashes: [...scripts], inlineStyleHashes: [...styles], headers };
  await mkdir('output/qa/security-audit', { recursive: true });
  await writeFile('output/qa/security-audit/csp-build.json', JSON.stringify(manifest, null, 2));
  return manifest;
}
