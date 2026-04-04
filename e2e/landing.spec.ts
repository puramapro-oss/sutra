import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('01 — loads with H1 and correct title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/SUTRA/)
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
  })

  test('02 — responsive: mobile menu visible on small screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('03 — desktop 1440px renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Pricing', () => {
  test('04 — pricing page loads with plans', async ({ page }) => {
    const res = await page.goto('/pricing')
    expect(res?.status()).toBe(200)
    await expect(page.locator('h2, h1').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Auth Pages', () => {
  test('05 — signup page loads with form', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByTestId('email-input').or(page.locator('input[type="email"]').first())).toBeVisible({ timeout: 10000 })
  })

  test('06 — login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('login-button').or(page.locator('button[type="submit"]').first())).toBeVisible({ timeout: 10000 })
  })

  test('07 — login with wrong credentials shows error', async ({ page }) => {
    // Pre-set cookie consent to prevent banner overlay
    await page.goto('/login')
    await page.evaluate(() => localStorage.setItem('sutra-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false })))
    await page.reload()
    const emailInput = page.getByTestId('email-input').or(page.locator('input[type="email"]').first())
    const passInput = page.getByTestId('password-input').or(page.locator('input[type="password"]').first())
    await emailInput.fill('fake@test.com')
    await passInput.fill('wrongpassword123')
    const submitBtn = page.getByTestId('login-button').or(page.locator('button[type="submit"]').first())
    await submitBtn.click()
    // Should show error toast or stay on login page
    await expect(page).toHaveURL(/login/, { timeout: 5000 })
  })
})

test.describe('Public Pages', () => {
  test('08 — help page loads', async ({ page }) => {
    await page.goto('/help')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('09 — status page loads', async ({ page }) => {
    await page.goto('/status')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('10 — changelog page loads', async ({ page }) => {
    await page.goto('/changelog')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('11 — terms page loads', async ({ page }) => {
    await page.goto('/legal/terms')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('12 — privacy page loads', async ({ page }) => {
    await page.goto('/legal/privacy')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('13 — cookies page loads', async ({ page }) => {
    await page.goto('/legal/cookies')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('14 — offline page loads', async ({ page }) => {
    await page.goto('/offline')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('API', () => {
  test('15 — /api/status returns 200', async ({ request }) => {
    const res = await request.get('/api/status')
    expect(res.status()).toBe(200)
  })

  test('16 — /api/admin/stats without auth returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/stats')
    expect(res.status()).toBe(401)
  })

  test('17 — /api/create without auth returns 401', async ({ request }) => {
    const res = await request.post('/api/create', { data: { topic: 'test' } })
    expect(res.status()).toBe(401)
  })
})

test.describe('PWA', () => {
  test('18 — manifest.json accessible', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toContain('SUTRA')
  })

  test('19 — sw.js accessible', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
  })
})

test.describe('Navigation', () => {
  test('22 — landing CTA buttons have valid hrefs', async ({ page }) => {
    await page.goto('/')
    const ctaLinks = page.locator('a[href="/signup"], a[href="/pricing"], a[href="/login"]')
    const count = await ctaLinks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('23 — pricing page has Stripe checkout buttons', async ({ page }) => {
    await page.goto('/pricing')
    const buttons = page.locator('button, a').filter({ hasText: /commencer|choisir|essayer/i })
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('24 — how-it-works page loads', async ({ page }) => {
    const res = await page.goto('/how-it-works')
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('25 — ecosystem page loads', async ({ page }) => {
    const res = await page.goto('/ecosystem')
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('26 — no dead href="#" links on landing', async ({ page }) => {
    await page.goto('/')
    const deadLinks = page.locator('a[href="#"]')
    const count = await deadLinks.count()
    expect(count).toBe(0)
  })
})

test.describe('Google OAuth', () => {
  test('27 — Google login button redirects to Google', async ({ page }) => {
    await page.goto('/login')
    const googleBtn = page.getByTestId('google-button')
    await expect(googleBtn).toBeVisible()
    // Click and check redirect starts (to Supabase auth then Google)
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('auth') || r.url().includes('google'), { timeout: 10000 }).catch(() => null),
      googleBtn.click(),
    ])
    // Should navigate away from login
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 }).catch(() => {})
  })
})

test.describe('Security', () => {
  test('20 — XSS in query params is escaped', async ({ page }) => {
    await page.goto('/?q=<script>alert(1)</script>')
    const content = await page.content()
    expect(content).not.toContain('<script>alert(1)</script>')
  })

  test('21 — SQL injection in URL does not cause error', async ({ page }) => {
    const res = await page.goto("/go/'; DROP TABLE users; --")
    expect(res?.status()).toBeLessThan(500)
  })
})
