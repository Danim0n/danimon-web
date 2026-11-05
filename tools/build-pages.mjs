import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, writeFile, mkdir, readFile } from 'node:fs/promises';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
process.env.WRANGLER_SEND_METRICS = 'false';
process.env.WRANGLER_LOG_PATH ||= './output/build-logs';
// Pages reads runtime bindings from the root config, not from the JS bundle.
const runtime = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const database = runtime.d1_databases?.find(binding => binding.binding === 'COUNTERS');
if (!database?.database_id || runtime.vars?.COUNTERS_ENABLED !== 'true')
  throw new Error('Pages runtime requires the configured COUNTERS database binding.');
if (process.env.PUBLIC_ANALYTICS_MODE === 'production' &&
    process.env.PUBLIC_COUNTERS_ORIGIN !== runtime.vars.PUBLIC_ORIGIN)
  throw new Error('Frontend and Pages runtime must use the same production origin.');
console.log(`Pages runtime configuration: COUNTERS -> ${database.database_name} (${database.database_id}); enabled=true`);
// Preview branches do not contribute to production statistics.
if (process.env.CF_PAGES && process.env.CF_PAGES_BRANCH !== 'main')
  process.env.PUBLIC_ANALYTICS_MODE = 'off';
const { build } = await import('astro');
await build({});
await mkdir('output/pages-worker', { recursive: true });
const bundle = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js',
  'deploy', '--dry-run', '--config', 'wrangler.bundle.jsonc', '--outdir', 'output/pages-worker'],
  { stdio: 'inherit', env: process.env });
const [code] = await once(bundle, 'exit');
if (code !== 0) process.exit(code ?? 1);
await copyFile('output/pages-worker/index.js', 'dist/_worker.js');
await writeFile('dist/_routes.json', JSON.stringify({
  version: 1, include: ['/api/*', '/cv/*'], exclude: [],
}, null, 2));
// Astro can retain its build pool on Windows.
process.exit(0);
