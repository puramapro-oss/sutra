import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html'], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://sutra.purama.dev',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [
    { name: 'Desktop 1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'Tablet 768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'Mobile 375', use: { ...devices['iPhone 14'] } },
  ],
})
