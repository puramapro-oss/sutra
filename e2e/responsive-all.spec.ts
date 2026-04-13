import { test, expect } from '@playwright/test'

const publicPages = [
  '/',
  '/pricing',
  '/aide',
  '/status',
  '/how-it-works',
  '/ecosystem',
  '/login',
  '/signup',
  '/mentions-legales',
  '/politique-confidentialite',
  '/cgv',
  '/cgu',
  '/contact',
  '/partenariat',
]

test.describe('Responsive — All public pages return 200', () => {
  for (const path of publicPages) {
    test(`${path} returns 200`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
    })
  }
})

test.describe('Responsive — No horizontal overflow at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  for (const path of ['/', '/pricing', '/aide', '/login', '/signup', '/contact']) {
    test(`${path} has no overflow`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)
    })
  }
})

test.describe('Responsive — No horizontal overflow at 1920px', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  for (const path of ['/', '/pricing', '/aide', '/login']) {
    test(`${path} has no overflow`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)
    })
  }
})
