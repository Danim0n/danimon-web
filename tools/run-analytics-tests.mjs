import { build, preview } from 'astro';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

process.env.PUBLIC_ANALYTICS_MODE = 'test';
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const config = {
  outDir: './output/analytics-test-dist/',
  server: { host: '127.0.0.1', port: 4330 },
};
let server;
let code = 1;
try {
  await build(config);
  server = await preview(config);
  const tests = spawn(process.execPath, [
    'node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.analytics.config.ts', ...process.argv.slice(2),
  ], { stdio: 'inherit', env: process.env });
  const [exitCode] = await once(tests, 'exit');
  code = exitCode ?? 1;
} catch (error) {
  console.error(error);
} finally {
  if (server) await server.stop();
  // Astro's build worker pool can outlive preview on Windows.
  process.exit(code);
}
