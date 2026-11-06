// Controlled local QA adapter for Pages' static assets and the generated _headers.
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2',
  '.pdf':'application/pdf', '.wasm':'application/wasm', '.gz':'application/gzip', '.json':'application/json', '.txt':'text/plain' };

export async function builtAssets(directory, { reportOnly = false } = {}) {
  const root = resolve(directory);
  const rules = [];
  for (const line of (await readFile(resolve(root, '_headers'), 'utf8')).split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ path:line.trim(), entries:[] });
    else {
      const text = line.trim();
      const colon = text.indexOf(':');
      if (!rules.length || (colon < 0 && !text.startsWith('! '))) throw new Error('Unsupported local header rule');
      rules.at(-1).entries.push(text.startsWith('! ') ? [text.slice(2), null] : [text.slice(0,colon),text.slice(colon+1).trim()]);
    }
  }
  return async request => {
    const url = new URL(request.url);
    const headers = new Headers();
    for (const rule of rules) {
      if (rule.path !== '/*' && rule.path !== url.pathname) continue;
      for (let [name,value] of rule.entries) {
        if (reportOnly && name.toLowerCase() === 'content-security-policy') name = 'Content-Security-Policy-Report-Only';
        if (value === null) headers.delete(name); else headers.set(name,value);
      }
    }
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers});
    let path;
    try {
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.split('/').some(segment=>segment.startsWith('.')) || decoded.includes('\\'))
        return new Response(null,{status:404,headers});
      path = resolve(root,'.'+(decoded.endsWith('/') ? decoded+'index.html' : decoded));
      if (!path.startsWith(root+sep)) return new Response(null,{status:404,headers});
    } catch { return new Response(null,{status:400,headers}); }
    let bytes, status = 200;
    try { bytes = await readFile(path); }
    catch { path=resolve(root,'404.html'); bytes=await readFile(path); status=404; }
    headers.set('Content-Type', types[extname(path)] ?? 'application/octet-stream');
    return new Response(request.method === 'HEAD' ? null : bytes,{status,headers});
  };
}
