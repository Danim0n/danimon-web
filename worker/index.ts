import type { D1Database } from '@cloudflare/workers-types';
import { validCounter, type CounterEvent } from '../src/lib/analytics/catalog';
import { purgeExpiredCounters } from './retention-policy';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  COUNTERS?: D1Database;
  PUBLIC_ORIGIN: string;
  COUNTERS_ENABLED?: string;
}
interface Context { waitUntil(promise: Promise<unknown>): void }
// A shared isolate budget, not a map of visitors or addresses.
let windowStart = 0;
let requests = 0;
const increment = `INSERT INTO daily_counts (day,page,language,counter,project,total)
VALUES (?,?,?,?,?,1) ON CONFLICT(day,page,language,counter,project)
DO UPDATE SET total = daily_counts.total + 1`;
function response(status: number): Response {
  return new Response(null, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'NEL': '{"max_age":0}',
  } });
}
function budgetAvailable(): boolean {
  const now = Date.now();
  if (now - windowStart >= 60000) { windowStart = now; requests = 0; }
  return ++requests <= 1200;
}
async function add(env: Env, events: CounterEvent[]) {
  const day = new Date().toISOString().slice(0, 10);
  const statements = events.map(event => env.COUNTERS!.prepare(increment).bind(
    day, event.page, event.language, event.counter, event.project,
  ));
  await env.COUNTERS!.batch(statements);
}
async function collect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return response(405);
  if (env.COUNTERS_ENABLED !== 'true' || !env.COUNTERS) return response(503);
  const origin = new URL(request.url).origin;
  if (origin !== env.PUBLIC_ORIGIN || request.headers.get('Origin') !== origin) return response(403);
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return response(403);
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return response(204);
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return response(415);
  if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return response(413);
  if (!budgetAvailable()) return response(429);
  // Bound the bytes read even for a chunked/malformed body.
  const reader = request.body?.getReader();
  if (!reader) return response(400);
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) { await reader.cancel(); return response(413); }
    chunks.push(value);
  }
  let data: unknown;
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch { return response(400); }
  if (!Array.isArray(data) || data.length < 1 || data.length > 5 || !data.every(event => validCounter(event))) return response(400);
  const signatures = data.map(event => JSON.stringify([event.page, event.language, event.counter, event.project]));
  if (new Set(signatures).size !== data.length) return response(400);
  try { await add(env, data); return response(204); }
  catch { return response(503); }
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await purgeExpiredCounters(env);
  },
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/api/interactions' && url.search) return response(400);
      if (url.pathname === '/api/interactions') return await collect(request, env);
      // No public reporting or administrative API.
      if (url.pathname.startsWith('/api/')) return response(404);
      const asset = await env.ASSETS.fetch(request);
      if (url.pathname === '/cv/daniel-rosell-martin.pdf' && !url.search && request.method === 'GET' &&
          !request.headers.has('Range') && asset.status === 200 && env.COUNTERS_ENABLED === 'true' &&
          env.COUNTERS && new URL(request.url).origin === env.PUBLIC_ORIGIN &&
          request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1' && budgetAvailable()) {
        // HTTP 200 response prepared, not a completed transfer or document reading.
        context.waitUntil(add(env, [{ page: 'cv-document', language: 'es', counter: 'cv_response_served', project: 'none' }]).catch(() => {}));
      }
      const headers = new Headers(asset.headers);
      headers.set('NEL', '{"max_age":0}');
      headers.delete('Report-To');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    } catch { return response(503); }
  },
};
