import { test, expect } from '@playwright/test'

test.describe('Navigation — Public routes', () => {
  test('logo links to home', async ({ page }) => {
    await page.goto('/pricing')
    const logo = page.locator('a[href="/"]').first()
    if (await logo.count() > 0) {
      await logo.click()
      await page.waitForLoadState('networkidle')
      const url = page.url()
      expect(url.endsWith('/') || url.endsWith('.dev')).toBe(true)
    }
  })

  test('pricing link works from landing', async ({ page }) => {
    await page.goto('/')
    const pricingLink = page.locator('a[href="/pricing"]').first()
    if (await pricingLink.count() > 0) {
      await pricingLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('pricing')
    }
  })

  test('login link works from landing', async ({ page }) => {
    await page.goto('/')
    const loginLink = page.locator('a[href="/login"]').first()
    if (await loginLink.count() > 0) {
      await loginLink.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('login')
    }
  })
})

test.describe('Navigation — Protected redirect', () => {
  const protectedPages = [
    '/dashboard',
    '/create',
    '/library',
    '/wallet',
    '/referral',
    '/settings',
    '/profile',
    '/achievements',
    '/boutique',
    '/community',
    '/lottery',
    '/contest',
    '/analytics',
    '/templates',
    '/autopilot',
    '/voices',
  ]

  for (const path of protectedPages) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path)
      await page.waitForURL(/login/, { timeout: 10000 })
      expect(page.url()).toContain('login')
    })
  }
})

test.describe('Navigation — No 500 errors', () => {
  const allPages = [
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
    '/forgot-password',
  ]

  for (const path of allPages) {
    test(`${path} does not return 500`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(500)
    })
  }
})
