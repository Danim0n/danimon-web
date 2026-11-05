import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, writeFile, mkdir } from 'node:fs/promises';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
process.env.WRANGLER_SEND_METRICS = 'false';
process.env.WRANGLER_LOG_PATH ||= './output/build-logs';
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
