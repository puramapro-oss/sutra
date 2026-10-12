import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL
if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('Local fixture server required')
if (process.env.E2E_BASE_URL !== baseURL) throw new Error('Both legacy base URLs must match the local fixture')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/legacy/results.json' }]],
  outputDir: 'test-results/legacy/artifacts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    // Block browser egress too; the Node preload independently blocks server egress.
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' },
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    { name: 'Desktop 1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'Tablet 768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'Mobile 375', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
  ],
})
