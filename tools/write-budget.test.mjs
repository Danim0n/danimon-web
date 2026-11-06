import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWriteBudget, readBoundedBody } from '../output/worker-test-build/index.js';

test('event and CV quotas are separate and reset after their minute', () => {
  const budget = createWriteBudget();
  for (let index = 0; index < 60; index++) {
    const lease = budget.reserveEvents(5, 1_000);
    assert.ok(lease);
    lease.complete(true);
  }
  assert.equal(budget.reserveEvents(1, 1_000), null);
  for (let index = 0; index < 60; index++) {
    const lease = budget.reserveCv(1_000);
    assert.ok(lease);
    lease.complete(true);
  }
  assert.equal(budget.reserveCv(1_000), null);
  const nextMinute = budget.reserveEvents(5, 61_000);
  assert.ok(nextMinute);
  nextMinute.complete(true);
  const nextMinuteCv = budget.reserveCv(61_000);
  assert.ok(nextMinuteCv);
  nextMinuteCv.complete(true);
});

test('concurrency cap releases after failed writes and lease completion is idempotent', () => {
  const budget = createWriteBudget();
  const leases = Array.from({ length: 8 }, () => budget.reserveEvents(1, 5_000));
  assert.ok(leases.every(Boolean));
  assert.equal(budget.reserveEvents(1, 5_000), null);
  leases[0].complete(false);
  const retry = budget.reserveEvents(1, 5_000);
  assert.ok(retry);
  retry.complete(true);
  retry.complete(true);
  for (const lease of leases.slice(1)) lease.complete(true);
  const afterRelease = budget.reserveEvents(1, 5_000);
  assert.ok(afterRelease);
  afterRelease.complete(true);
});

test('request parse ceiling is independent and resets after the minute', () => {
  const budget = createWriteBudget();
  for (let index = 0; index < 16; index++) budget.reserveRequest(8_000).complete(true);
  for (let index = 0; index < 1_184; index++) budget.reserveRequest(8_000).complete(true);
  assert.equal(budget.reserveRequest(8_000), null);
  const nextMinute = budget.reserveRequest(68_000);
  assert.ok(nextMinute);
  nextMinute.complete(true);
});

test('concurrent open request slots are bounded and malformed request completion frees a slot', () => {
  const budget = createWriteBudget();
  const leases = Array.from({ length: 16 }, () => budget.reserveRequest(1_000));
  assert.ok(leases.every(Boolean));
  assert.equal(budget.reserveRequest(1_000), null);
  // The caller releases this lease after any parsed or rejected request.
  leases[0].complete(true);
  const next = budget.reserveRequest(1_000);
  assert.ok(next);
  next.complete(true);
  for (const lease of leases.slice(1)) lease.complete(true);
});

test('slow chunked request body times out and cancels its reader', async () => {
  let canceled = false;
  const stream = new ReadableStream({ cancel() { canceled = true; } });
  const request = new Request('https://danimon.party/api/interactions', {
    method: 'POST', body: stream, duplex: 'half',
  });
  const started = Date.now();
  const result = await readBoundedBody(request, 2_048, 20);
  assert.deepEqual(result, { ok: false, status: 408 });
  assert.ok(Date.now() - started < 500);
  assert.equal(canceled, true);
});
