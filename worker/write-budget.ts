const WINDOW_MS = 60_000;

interface Bucket { startedAt: number; used: number }
export interface WriteLease { complete(success: boolean): void }

export interface WriteBudgetOptions {
  requestLimit?: number;
  concurrentRequests?: number;
  eventLimit?: number;
  cvLimit?: number;
  concurrentWrites?: number;
}

/** Per-isolate burst guard. It is deliberately not a visitor or account-wide quota. */
export function createWriteBudget({
  requestLimit = 1_200,
  concurrentRequests = 16,
  eventLimit = 300,
  cvLimit = 60,
  concurrentWrites = 8,
}: WriteBudgetOptions = {}) {
  let requests: Bucket | undefined;
  let events: Bucket | undefined;
  let cv: Bucket | undefined;
  let activeRequests = 0;
  let activeWrites = 0;

  function current(bucket: Bucket | undefined, now: number): Bucket {
    if (!bucket || now < bucket.startedAt || now - bucket.startedAt >= WINDOW_MS)
      return { startedAt: now, used: 0 };
    return bucket;
  }

  function reserveRequest(now = Date.now()): WriteLease | null {
    requests = current(requests, now);
    if (requests.used >= requestLimit || activeRequests >= concurrentRequests) return null;
    requests.used += 1;
    activeRequests += 1;
    let completed = false;
    return {
      complete() {
        if (completed) return;
        completed = true;
        activeRequests -= 1;
      },
    };
  }

  function reserve(kind: 'events' | 'cv', amount: number, now = Date.now()): WriteLease | null {
    if (!Number.isInteger(amount) || amount < 1 || activeWrites >= concurrentWrites) return null;
    const bucket = kind === 'events' ? current(events, now) : current(cv, now);
    if (bucket.used + amount > (kind === 'events' ? eventLimit : cvLimit)) return null;
    if (kind === 'events') events = bucket;
    else cv = bucket;
    bucket.used += amount;
    activeWrites += 1;
    let completed = false;
    return {
      complete(success: boolean) {
        if (completed) return;
        completed = true;
        activeWrites -= 1;
        // Do not refund a lease into a newer one-minute period.
        if (!success && (kind === 'events' ? events : cv) === bucket) bucket.used -= amount;
      },
    };
  }

  return {
    reserveRequest,
    reserveEvents: (count: number, now?: number) => reserve('events', count, now),
    reserveCv: (now?: number) => reserve('cv', 1, now),
  };
}
