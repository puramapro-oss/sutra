import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'browser.spec.ts', workers: 1, retries: 0, timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: 'evidence/browser',
  reporter: [['list'], ['json', { outputFile: 'evidence/browser-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:19835', viewport: { width: 1365, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.T08_CHROMIUM } },
});
