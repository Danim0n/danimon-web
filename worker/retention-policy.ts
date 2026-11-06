import type { D1Database } from '@cloudflare/workers-types';

export interface RetentionEnv {
  COUNTERS?: D1Database;
  COUNTERS_ENABLED?: string;
}

export async function purgeExpiredCounters(env: RetentionEnv): Promise<void> {
  if (env.COUNTERS_ENABLED === 'true' && env.COUNTERS)
    await env.COUNTERS.prepare("DELETE FROM daily_counts WHERE day <= date('now', '-365 days')").run();
}
