import { purgeExpiredCounters, type RetentionEnv } from './retention-policy';
// Separate portfolio-only scheduled Worker; no public statistics endpoint.
export default {
  async scheduled(_event: unknown, env: RetentionEnv): Promise<void> {
    await purgeExpiredCounters(env);
  },
  fetch() { return new Response(null, { status: 404 }); },
};
