import { defineConfig } from '@playwright/test';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= `${process.cwd()}/.cache/ms-playwright`;
export default defineConfig({
  testDir: './tests',
  testMatch: 'analytics.spec.ts',
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4330', browserName: 'chromium' },
  reporter: [['list'], ['json', { outputFile: 'output/qa/analytics/results.json' }]],
});
