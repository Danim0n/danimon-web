import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, writeFile, mkdir, readFile } from 'node:fs/promises';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
process.env.WRANGLER_SEND_METRICS = 'false';
process.env.WRANGLER_LOG_PATH ||= './output/build-logs';
// Pages reads runtime bindings from the root config, not from the JS bundle.
const runtime = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
for (const [name, value] of Object.entries(runtime.vars ?? {}))
  if (name.startsWith('PUBLIC_') && process.env[name] === undefined)
    process.env[name] = String(value);
const database = runtime.d1_databases?.find(binding => binding.binding === 'COUNTERS');
if (!database?.database_id || runtime.vars?.COUNTERS_ENABLED !== 'true')
  throw new Error('Pages runtime requires the configured COUNTERS database binding.');
if (process.env.PUBLIC_ANALYTICS_MODE === 'production') {
  const expected = ['https://danimon.party', 'https://danimon-web.pages.dev'];
  let frontendOrigins, workerOrigins;
  try {
    frontendOrigins = JSON.parse(process.env.PUBLIC_COUNTERS_ORIGINS ?? 'null');
    workerOrigins = JSON.parse(runtime.vars.PUBLIC_ORIGINS ?? 'null');
  } catch { throw new Error('Frontend and Pages runtime origins must be valid JSON arrays.'); }
  const normalized = value => Array.isArray(value) ? [...new Set(value)].sort() : null;
  if (JSON.stringify(normalized(frontendOrigins)) !== JSON.stringify([...expected].sort()) ||
      JSON.stringify(normalized(workerOrigins)) !== JSON.stringify([...expected].sort()) ||
      JSON.stringify(normalized(frontendOrigins)) !== JSON.stringify(normalized(workerOrigins)) ||
      runtime.vars.PUBLIC_ORIGIN !== 'https://danimon.party')
    throw new Error('Frontend and Pages runtime must allow exactly the apex domain and production Pages hostname.');
}
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
