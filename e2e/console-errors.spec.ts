import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

const PAGES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/pricing',
  '/how-it-works',
  '/ecosystem',
  '/help',
  '/aide',
  '/status',
  '/changelog',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/legal',
  '/partenariat',
]

// Errors expected/ignored (analytics, third-party, etc.)
const IGNORE = [
  /favicon/i,
  /posthog/i,
  /sentry/i,
  /vercel/i,
  /Failed to load resource.*4\d\d/i, // 4xx assets are tracked separately
  /ResizeObserver/i,
  /chrome-extension/i,
]

test.describe('Zero console errors on public pages', () => {
  for (const path of PAGES) {
    test(`${path} has 0 console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (!IGNORE.some((re) => re.test(text))) {
            errors.push(text)
          }
        }
      })
      page.on('pageerror', (err) => {
        const text = err.message
        if (!IGNORE.some((re) => re.test(text))) {
          errors.push(`pageerror: ${text}`)
        }
      })
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 })
      expect(res?.status()).toBeLessThan(400)
      // Give time for hydration
      await page.waitForTimeout(800)
      expect(errors, `Errors on ${path}:\n${errors.join('\n')}`).toEqual([])
    })
  }
})
