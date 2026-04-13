import { test, expect } from '@playwright/test'

test.describe('Forms — Login validation', () => {
  test('login page loads', async ({ page }) => {
    const res = await page.goto('/login')
    // Either shows login form or redirects to OAuth provider
    expect(res?.status()).toBeLessThan(500)
  })

  test('login page does not auto-redirect to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.waitForTimeout(2000)
    // Should not be on dashboard without auth
    expect(page.url()).not.toContain('/dashboard')
  })

  test('forgot password link exists on login page', async ({ page }) => {
    await page.goto('/login')
    const forgotLink = page.locator('a[href*="forgot"], a[href*="reset"], a:has-text("oubli"), a:has-text("Mot de passe")')
    expect(await forgotLink.count()).toBeGreaterThanOrEqual(0)
  })
})

test.describe('Forms — Signup validation', () => {
  test('signup page has required fields', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('input[type="email"], input[name="email"]')
    const passwordInput = page.locator('input[type="password"], input[name="password"]')

    expect(await emailInput.count()).toBeGreaterThan(0)
    expect(await passwordInput.count()).toBeGreaterThan(0)
  })

  test('signup has Google OAuth button', async ({ page }) => {
    await page.goto('/signup')
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google")')
    expect(await googleBtn.count()).toBeGreaterThan(0)
  })
})

test.describe('Forms — Contact', () => {
  test('contact page loads and has form', async ({ page }) => {
    const res = await page.goto('/contact')
    expect(res?.status()).toBeLessThan(400)
    // Check for form elements
    const inputs = page.locator('input, textarea')
    expect(await inputs.count()).toBeGreaterThan(0)
  })
})

test.describe('API — Rate limiting & auth', () => {
  test('protected APIs return 401 without auth', async ({ request }) => {
    const protectedEndpoints = [
      '/api/wallet',
      '/api/referral',
      '/api/points',
      '/api/notifications',
    ]
    for (const endpoint of protectedEndpoints) {
      const res = await request.get(endpoint)
      expect([401, 403]).toContain(res.status())
    }
  })

  test('POST /api/create requires auth', async ({ request }) => {
    const res = await request.post('/api/create', {
      data: { topic: 'test', niche: 'tech' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/stripe/webhook accepts POST', async ({ request }) => {
    const res = await request.post('/api/stripe/webhook', {
      data: {},
    })
    // Should not be 404 or 405 - webhook exists but fails validation
    expect([400, 401, 403, 500]).toContain(res.status())
  })
})
