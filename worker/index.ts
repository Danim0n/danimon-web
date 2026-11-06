import type { D1Database } from '@cloudflare/workers-types';
import { validCounter, type CounterEvent } from '../src/lib/analytics/catalog';
import { purgeExpiredCounters } from './retention-policy';
import { createWriteBudget } from './write-budget';
import { readBoundedBody } from './request-body';
import { securityHeaders, inertResponseCsp } from '../src/lib/security-policy';
export { createWriteBudget } from './write-budget';
export { readBoundedBody } from './request-body';

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  COUNTERS?: D1Database;
  PUBLIC_ORIGIN: string;
  PUBLIC_ORIGINS?: string;
  COUNTERS_ENABLED?: string;
}
interface Context { waitUntil(promise: Promise<unknown>): void }
// A shared isolate budget, not a map of visitors or addresses.
const writeBudget = createWriteBudget();
function isAllowedOrigin(origin: string, env: Env): boolean {
  // Production supplies an exact JSON list. Keep the singleton fallback for local tests/dev.
  let allowed = [env.PUBLIC_ORIGIN];
  if (env.PUBLIC_ORIGINS) {
    try {
      const parsed: unknown = JSON.parse(env.PUBLIC_ORIGINS);
      if (!Array.isArray(parsed) || !parsed.every(value => typeof value === 'string')) return false;
      allowed = parsed;
    } catch { return false; }
  }
  return allowed.includes(origin);
}
const increment = `INSERT INTO daily_counts (day,page,language,counter,project,total)
VALUES (?,?,?,?,?,1) ON CONFLICT(day,page,language,counter,project)
DO UPDATE SET total = daily_counts.total + 1`;
function response(status: number, additions?: Record<string, string>): Response {
  const headers = new Headers({
    ...securityHeaders,
    'Content-Security-Policy': inertResponseCsp,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'NEL': '{"max_age":0}',
  });
  if (status === 429) headers.set('Retry-After', '60');
  if (status === 405) headers.set('Allow', 'POST');
  for (const [name, value] of Object.entries(additions ?? {})) headers.set(name, value);
  return new Response(null, { status, headers });
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
  if (!isAllowedOrigin(origin, env) || request.headers.get('Origin') !== origin) return response(403);
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return response(403);
  if (request.headers.get('DNT') === '1' || request.headers.get('Sec-GPC') === '1') return response(204);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return response(415);
  if (Number(request.headers.get('Content-Length') ?? 0) > 2048) return response(413);
  // Bound parsing work and concurrent open bodies, including malformed/chunked payloads.
  const requestLease = writeBudget.reserveRequest();
  if (!requestLease) return response(429);
  try {
    const body = await readBoundedBody(request);
    if (!body.ok) return response(body.status);
    let data: unknown;
    try {
      data = JSON.parse(new TextDecoder().decode(body.bytes));
    } catch { return response(400); }
    if (!Array.isArray(data) || data.length < 1 || data.length > 5 || !data.every(event => validCounter(event))) return response(400);
    const signatures = data.map(event => JSON.stringify([event.page, event.language, event.counter, event.project]));
    if (new Set(signatures).size !== data.length) return response(400);
    const lease = writeBudget.reserveEvents(data.length);
    if (!lease) return response(429);
    try { await add(env, data); lease.complete(true); return response(204); }
    catch { lease.complete(false); return response(503); }
  } finally { requestLease.complete(true); }
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
          env.COUNTERS && isAllowedOrigin(new URL(request.url).origin, env) &&
          request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1') {
        // HTTP 200 response prepared, not a completed transfer or document reading.
        const lease = writeBudget.reserveCv();
        if (lease) context.waitUntil(add(env, [{ page: 'cv-document', language: 'es', counter: 'cv_response_served', project: 'none' }])
          .then(() => lease.complete(true), () => lease.complete(false)));
      }
      const headers = new Headers(asset.headers);
      for (const [name, value] of Object.entries(securityHeaders))
        if (!headers.has(name)) headers.set(name, value);
      if (url.pathname.startsWith('/cv/')) headers.set('Content-Security-Policy', inertResponseCsp);
      headers.set('NEL', '{"max_age":0}');
      headers.delete('Report-To');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    } catch { return response(503); }
  },
};
