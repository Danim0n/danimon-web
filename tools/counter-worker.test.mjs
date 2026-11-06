import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

let runtime, database, worker;
const origin = 'https://danimon.party';
const pagesOrigin = 'https://danimon-web.pages.dev';
const allowedOrigins = [origin, pagesOrigin];
const event = { page: 'home', language: 'es', counter: 'cv_download_clicked', project: 'none' };
before(async () => {
  const testRoot = resolve('output/qa/cloudflare-only');
  await mkdir(testRoot, {recursive:true});
  const d1Path = await mkdtemp(join(testRoot, 'd1-test-'));
  runtime = new Miniflare({...convertV4MiniflareOptions({
    modules: true, scriptPath: 'output/worker-test-build/index.js', compatibilityDate: '2026-08-06',
    bindings: { PUBLIC_ORIGIN: origin, PUBLIC_ORIGINS: JSON.stringify(allowedOrigins), COUNTERS_ENABLED: 'true' }, d1Databases: ['COUNTERS'], d1Persist: d1Path,
    serviceBindings: { ASSETS: request => new Response('PDF or page', { status: request.headers.has('Range') ? 206 : 200 }) },
  }), resourcePersistencePath:d1Path});
  database = await runtime.getD1Database('COUNTERS');
  await database.prepare(await readFile('migrations/0001_counters.sql', 'utf8')).run();
  // dispatchFetch preserves the incoming URL and Origin for same-origin checks.
  worker = { fetch: (...args) => runtime.dispatchFetch(...args) };
});
beforeEach(async () => { await database.prepare('DELETE FROM daily_counts').run(); });
after(async () => { await runtime?.dispose(); });
const send = (body, headers = {}, requestOrigin = origin) => worker.fetch(requestOrigin + '/api/interactions', {
  method: 'POST', headers: { Origin: requestOrigin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const rows = () => database.prepare('SELECT * FROM daily_counts ORDER BY counter').all();

test('valid action increments only aggregate columns', async () => {
  assert.equal((await send([event])).status, 204);
  const { results } = await rows();
  assert.equal(results.length, 1);
  assert.deepEqual(Object.keys(results[0]).sort(), ['counter', 'day', 'language', 'page', 'project', 'total']);
  assert.equal(results[0].day, new Date().toISOString().slice(0, 10));
  assert.equal(results[0].total, 1);
});
test('validated write budget counts event units and malformed payloads do not spend it', async () => {
  const isolated = await createIsolatedWorker();
  try {
    const { fetch, database: isolatedDb } = isolated;
    const sendIsolated = body => fetch(origin + '/api/interactions', {
      method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal((await sendIsolated([{ ...event, counter: 'unknown' }])).status, 400);
    const fiveEvents = [
      'cv_download_clicked', 'linkedin_clicked', 'github_clicked',
      'professional_link_clicked', 'contact_chooser_opened',
    ].map(counter => ({ ...event, counter }));
    for (let i = 0; i < 60; i++) assert.equal((await sendIsolated(fiveEvents)).status, 204);
    const limited = await sendIsolated([event]);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('Retry-After'), '60');
    assert.equal((await isolatedDb.prepare('SELECT SUM(total) AS total FROM daily_counts').first()).total, 300);
  } finally { await isolated.runtime.dispose(); }
});
test('both exact production hosts are admitted; previews, subdomains and crossed Origins are rejected', async () => {
  for (const host of allowedOrigins) assert.equal((await send([event], {}, host)).status, 204);
  for (const host of ['https://preview.danimon-web.pages.dev', 'https://other.pages.dev', 'https://www.danimon.party'])
    assert.equal((await send([event], {}, host)).status, 403);
  assert.equal((await send([event], { Origin: pagesOrigin }, origin)).status, 403);
  assert.equal((await send([event], { Origin: origin }, pagesOrigin)).status, 403);
  const { results } = await rows();
  assert.equal(results.length, 1);
  assert.equal(results[0].total, 2);
});
test('100 increments in concurrent batches remain atomic', async () => {
  const responses = [];
  for (let start = 0; start < 100; start += 8)
    responses.push(...await Promise.all(Array.from({ length: Math.min(8, 100 - start) }, () => send([event]))));
  assert.ok(responses.every(response => response.status === 204));
  assert.equal((await rows()).results[0].total, 100);
});
test('projects and contact actions remain separate', async () => {
  const actions = [
    { ...event, counter: 'project_opened', project: 'local-events' },
    { ...event, counter: 'project_opened', project: 'automation-backend' },
    { ...event, counter: 'email_gmail_clicked' }, { ...event, counter: 'email_outlook_clicked' },
    { ...event, counter: 'email_app_clicked' },
  ];
  assert.equal((await send(actions)).status, 204);
  assert.equal((await rows()).results.length, 5);
});
test('untrusted payloads cannot persist arbitrary or personal fields', async () => {
  for (const payload of [
    [{ ...event, email: 'private@example.test' }], [{ ...event, counter: 'unknown' }],
    [{ ...event, project: 'private-project' }], [{ ...event, counter: 'cv_response_served' }],
    [{ ...event, page: 'cv-document' }], [event, event], [], Array(6).fill(event),
  ]) assert.equal((await send(payload)).status, 400);
  assert.equal((await rows()).results.length, 0);
});
test('malformed JSON, unknown fields, SQL/XSS strings and oversized chunked bodies are rejected safely', async () => {
  const raw = body => worker.fetch(origin + '/api/interactions', {
    method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body,
  });
  assert.equal((await raw('{"page":')).status, 400);
  assert.equal((await send([{ ...event, unexpected: '<script>alert(1)</script>' }])).status, 400);
  assert.equal((await send([{ ...event, page: '<script>alert(1)</script>' }])).status, 400);
  assert.equal((await send([{ ...event, project: "' OR 1=1; DROP TABLE daily_counts; --" }])).status, 400);
  const chunkedBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_500).fill(0x20));
      controller.enqueue(new Uint8Array(600).fill(0x20));
      controller.close();
    },
  });
  const oversized = await worker.fetch(origin + '/api/interactions', {
    method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
    body: chunkedBody, duplex: 'half',
  });
  assert.equal(oversized.status, 413);
  assert.equal((await rows()).results.length, 0);
  assert.equal((await database.prepare('SELECT COUNT(*) AS count FROM daily_counts').first()).count, 0);
});
test('JSON media type accepts case and optional whitespace/parameters', async () => {
  assert.equal((await send([event], { 'Content-Type': ' Application/JSON ; charset=utf-8' })).status, 204);
});
test('cross-site, methods, excessive bodies and query strings are rejected', async () => {
  assert.equal((await send([event], { Origin: 'https://other.test' })).status, 403);
  assert.equal((await send([event], { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await send([event], { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await send([{ ...event, text: 'x'.repeat(2200) }])).status, 413);
  const method = await worker.fetch(origin + '/api/interactions');
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('Allow'), 'POST');
  assert.equal((await worker.fetch(origin + '/api/interactions?private=value')).status, 400);
  assert.equal((await rows()).results.length, 0);
});
test('privacy signals produce no row or cookie', async () => {
  for (const headers of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) {
    const result = await send([event], headers);
    assert.equal(result.status, 204);
    assert.equal(result.headers.get('Set-Cookie'), null);
    assert.equal(result.headers.get('NEL'), '{"max_age":0}');
    assert.equal(result.headers.get('Report-To'), null);
  }
  assert.equal((await rows()).results.length, 0);
});
test('PDF response counter records GET 200, not HEAD or partial responses', async () => {
  const url = origin + '/cv/daniel-rosell-martin.pdf';
  assert.equal((await worker.fetch(url, { method: 'HEAD' })).status, 200);
  assert.equal((await worker.fetch(url, { headers: { Range: 'bytes=0-5' } })).status, 206);
  assert.equal((await rows()).results.length, 0);
  assert.equal((await worker.fetch(url)).status, 200);
  for (let i = 0; i < 30 && !(await rows()).results.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await rows()).results[0].counter, 'cv_response_served');
  assert.equal((await rows()).results[0].page, 'cv-document');
  assert.equal((await rows()).results[0].total, 1);
});
test('PDF response counter works on both exact production hosts only', async () => {
  for (const host of allowedOrigins) {
    await worker.fetch(host + '/cv/daniel-rosell-martin.pdf');
    for (let i = 0; i < 30 && (await rows()).results.length < allowedOrigins.indexOf(host) + 1; i++) await new Promise(resolve => setTimeout(resolve, 10));
  }
  await worker.fetch('https://preview.danimon-web.pages.dev/cv/daniel-rosell-martin.pdf');
  for (let i = 0; i < 30 && (await rows()).results.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await rows()).results.length, 1); // Rows are grouped by UTC day and event.
  assert.equal((await rows()).results[0].counter, 'cv_response_served');
  assert.equal((await rows()).results[0].total, 2);
});
test('CV continues serving after its counter budget is exhausted', async () => {
  const isolated = await createIsolatedWorker();
  try {
    for (let index = 0; index < 65; index++)
      assert.equal((await isolated.fetch(origin + '/cv/daniel-rosell-martin.pdf')).status, 200);
    for (let i = 0; i < 30 && ((await isolated.database.prepare('SELECT total FROM daily_counts').first())?.total ?? 0) < 60; i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal((await isolated.database.prepare('SELECT total FROM daily_counts').first()).total, 60);
  } finally { await isolated.runtime.dispose(); }
});
test('D1 write failures release event allowance and batch concurrency', async () => {
  const { default: implementation } = await import('../output/worker-test-build/index.js');
  const database = {
    prepare: () => ({ bind: () => ({}) }),
    batch: async () => { throw new Error('simulated D1 failure'); },
  };
  for (let index = 0; index < 9; index++) {
    const result = await implementation.fetch(new Request(origin + '/api/interactions', {
      method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
      body: JSON.stringify([event]),
    }), { PUBLIC_ORIGIN: origin, COUNTERS_ENABLED: 'true', COUNTERS: database }, { waitUntil: () => {} });
    assert.equal(result.status, 503);
  }
});
test('there is no public administrative or reporting endpoint', async () => {
  for (const path of ['/api/stats', '/api/admin', '/api/portfolio/analytics'])
    assert.equal((await worker.fetch(origin + path)).status, 404);
});

test('Functions protect API errors, success and PDF responses independently of static _headers', async () => {
  const responses = [
    await worker.fetch(origin+'/api/interactions'),
    await worker.fetch(origin+'/api/stats'),
    await send([event],{Origin:'https://other.test'}),
    await send([event],{'Content-Type':'text/plain'}),
    await send([{...event,extra:'x'.repeat(2200)}]),
    await send([event]),
    await worker.fetch(origin+'/cv/daniel-rosell-martin.pdf',{method:'HEAD'}),
    await worker.fetch(origin+'/cv/daniel-rosell-martin.pdf',{headers:{Range:'bytes=0-5'}}),
  ];
  for (const result of responses) {
    assert.equal(result.headers.get('X-Content-Type-Options'),'nosniff');
    assert.equal(result.headers.get('X-Frame-Options'),'DENY');
    assert.equal(result.headers.get('Strict-Transport-Security'),'max-age=2592000');
    assert.ok(result.headers.get('Permissions-Policy').includes('camera=()'));
    assert.ok(result.headers.get('Content-Security-Policy').includes("default-src 'none'"));
    assert.ok(result.headers.get('Content-Security-Policy').includes("frame-ancestors 'none'"));
    assert.equal(result.headers.get('Set-Cookie'),null);
  }
});
test('scheduled retention removes only aggregates older than one year', async () => {
  await database.prepare('INSERT INTO daily_counts VALUES (?,?,?,?,?,?)').bind('2020-01-01', 'home', 'es', 'cv_download_clicked', 'none', 1).run();
  await send([event]);
  const { default: implementation } = await import('../output/worker-test-build/index.js');
  await implementation.scheduled(null, { COUNTERS: database, COUNTERS_ENABLED: 'true' });
  assert.equal((await rows()).results.length, 1);
  assert.equal((await rows()).results[0].day, new Date().toISOString().slice(0, 10));
});

test('standalone retention has no public API and respects the UTC retention boundary', async () => {
  const { default: retention } = await import('../output/retention-worker/retention.js');
  assert.equal(retention.fetch().status, 404);
  const day = days => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  for (const age of [366, 365, 364, 0])
    await database.prepare('INSERT INTO daily_counts VALUES (?,?,?,?,?,?)')
      .bind(day(age), 'home', 'es', 'cv_download_clicked', 'none', 1).run();
  await retention.scheduled(null, { COUNTERS: database, COUNTERS_ENABLED: 'false' });
  assert.equal((await rows()).results.length, 4);
  await retention.scheduled(null, { COUNTERS_ENABLED: 'true' });
  await retention.scheduled(null, { COUNTERS: database, COUNTERS_ENABLED: 'true' });
  assert.deepEqual((await rows()).results.map(row => row.day).sort(), [day(364), day(0)].sort());
});



test('disabled counters and missing D1 never prevent assets from loading', async () => {
  for (const bindings of [
    { PUBLIC_ORIGIN: origin, COUNTERS_ENABLED: 'false' },
    { PUBLIC_ORIGIN: origin, COUNTERS_ENABLED: 'true' },
  ]) {
    const isolated = new Miniflare(convertV4MiniflareOptions({
      modules:true, scriptPath:'output/worker-test-build/index.js', compatibilityDate:'2026-08-06',
      bindings,
      serviceBindings:{ ASSETS: () => new Response('asset', {status:200}) },
    }));
    try {
      assert.equal((await isolated.dispatchFetch(origin + '/')).status,200);
      const result = await isolated.dispatchFetch(origin + '/api/interactions', {
        method:'POST', headers:{Origin:origin,'Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},body:JSON.stringify([event]),
      });
      assert.equal(result.status,503);
    } finally { await isolated.dispose(); }
  }
});

test('all read-only report queries run against local D1 with aggregate fixtures', async () => {
  const today = new Date().toISOString().slice(0,10);
  const fixtures = [
    [today,'home','es','cv_download_clicked','none',2],
    [today,'cv-document','es','cv_response_served','none',1],
    [today,'home','en','project_opened','local-events',3],
    ['2020-01-01','home','es','cv_download_clicked','none',7],
  ];
  for (const values of fixtures)
    await database.prepare('INSERT INTO daily_counts VALUES (?,?,?,?,?,?)').bind(...values).run();
  const source = (await readFile('queries/counters.sql','utf8')).replace(/^\s*--.*$/gm,'');
  const statements = source.split(';').map(s => s.trim()).filter(Boolean);
  assert.equal(statements.length,7);
  const result = [];
  for (const sql of statements) result.push((await database.prepare(sql).all()).results);
  assert.ok(result[0].some(row => row.counter === 'cv_download_clicked' && row.actions === 2));
  assert.ok(result[1].some(row => row.project === 'local-events' && row.actions === 3));
  assert.ok(result[2].some(row => row.day === today && row.counter === 'project_opened' && row.actions === 3));
  assert.ok(result[3].some(row => row.counter === 'project_opened' && row.actions === 3));
  assert.ok(result[4].some(row => row.month === today.slice(0,7) && row.actions === 3));
  assert.ok(result[5].some(row => row.counter === 'cv_response_served' && row.actions === 1));
  assert.ok(result[6].some(row => row.page === 'home' && row.language === 'en' && row.actions === 3));
  assert.ok(!result[0].some(row => row.counter === 'cv_download_clicked' && row.actions === 9));
});

async function createIsolatedWorker() {
  const d1Path = await mkdtemp(join(resolve('output/qa/cloudflare-only'), 'd1-budget-'));
  const isolatedRuntime = new Miniflare({...convertV4MiniflareOptions({
    modules: true, scriptPath: 'output/worker-test-build/index.js', compatibilityDate: '2026-08-06',
    bindings: { PUBLIC_ORIGIN: origin, PUBLIC_ORIGINS: JSON.stringify(allowedOrigins), COUNTERS_ENABLED: 'true' },
    d1Databases: ['COUNTERS'], d1Persist: d1Path,
    serviceBindings: { ASSETS: request => new Response('PDF or page', { status: request.headers.has('Range') ? 206 : 200 }) },
  }), resourcePersistencePath: d1Path});
  const database = await isolatedRuntime.getD1Database('COUNTERS');
  await database.prepare(await readFile('migrations/0001_counters.sql', 'utf8')).run();
  return { runtime: isolatedRuntime, database, fetch: (...args) => isolatedRuntime.dispatchFetch(...args) };
}
