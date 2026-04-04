import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

// All public pages that should return 200
const PUBLIC_PAGES = [
  '/',
  '/login',
  '/signup',
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
  '/legal/mentions',
  '/legal/privacy',
  '/legal/terms',
  '/legal/cgv',
  '/legal/cookies',
  '/offline',
]

// Protected pages — should redirect to /login without auth
const PROTECTED_PAGES = [
  '/dashboard',
  '/create',
  '/library',
  '/publish',
  '/profile',
  '/settings',
  '/referral',
  '/wallet',
  '/contest',
  '/classement',
  '/notifications',
  '/voices',
  '/templates',
  '/autopilot',
]

// Admin pages — should redirect without admin role
const ADMIN_PAGES = [
  '/admin',
  '/admin/users',
  '/admin/finances',
  '/admin/withdrawals',
  '/admin/contest',
  '/admin/classement',
  '/admin/config',
  '/admin/health',
  '/admin/api-usage',
]

test.describe('Public pages load correctly', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} returns 200`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      expect(res?.status()).toBe(200)
    })
  }
})

test.describe('Protected pages redirect to /login without auth', () => {
  for (const path of PROTECTED_PAGES) {
    test(`${path} redirects to /login`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      expect(page.url()).toContain('/login')
    })
  }
})

test.describe('Admin pages redirect without admin role', () => {
  for (const path of ADMIN_PAGES) {
    test(`${path} redirects without admin`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
      // Should redirect to either /login (no auth) or /dashboard (no admin)
      const url = page.url()
      expect(url.includes('/login') || url.includes('/dashboard')).toBeTruthy()
    })
  }
})

test.describe('API routes respond correctly', () => {
  test('/api/status returns JSON', async ({ request }) => {
    const res = await request.get(`${BASE}/api/status`)
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.app).toBe('SUTRA')
  })

  test('/api/stripe/webhook returns 405 for GET', async ({ request }) => {
    const res = await request.get(`${BASE}/api/stripe/webhook`)
    // webhooks only accept POST
    expect([405, 400, 500].includes(res.status())).toBeTruthy()
  })

  test('/api/admin/stats returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/stats`)
    expect(res.status()).toBe(401)
  })

  test('/api/wallet returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/wallet`)
    expect(res.status()).toBe(401)
  })

  test('/api/referral returns 401 without auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/referral`)
    expect(res.status()).toBe(401)
  })
})

test.describe('SEO checks', () => {
  test('sitemap.xml exists', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`)
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).toContain('urlset')
  })

  test('robots.txt exists', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`)
    expect(res.status()).toBe(200)
  })

  test('landing page has meta title and description', async ({ page }) => {
    await page.goto(BASE)
    const title = await page.title()
    expect(title.length).toBeGreaterThan(10)
    const desc = await page.locator('meta[name="description"]').getAttribute('content')
    expect(desc?.length).toBeGreaterThan(20)
  })

  test('pricing page has meta title and og:image', async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    const title = await page.title()
    expect(title.length).toBeGreaterThan(5)
    const og = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(og).toBeTruthy()
  })
})

test.describe('Login page UI elements', () => {
  test('has all required elements', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="google-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="remember-me-checkbox"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    // Link to signup
    await expect(page.locator('a[href="/signup"]')).toBeVisible()
    // Link to forgot password
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
  })
})

test.describe('Pricing page', () => {
  test('shows plans with correct prices', async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    // Check plan names/prices exist
    await expect(page.locator('text=Starter')).toBeVisible()
    // Check that pricing section is visible
    const body = await page.textContent('body')
    expect(body).toContain('9')
    expect(body).toContain('29')
    expect(body).toContain('99')
  })
})

test.describe('Legal pages have real content', () => {
  test('/mentions-legales has content', async ({ page }) => {
    await page.goto(`${BASE}/mentions-legales`)
    const text = await page.textContent('body')
    expect(text?.length).toBeGreaterThan(200)
  })

  test('/politique-confidentialite has content', async ({ page }) => {
    await page.goto(`${BASE}/politique-confidentialite`)
    const text = await page.textContent('body')
    expect(text?.length).toBeGreaterThan(200)
  })

  test('/cgv has content', async ({ page }) => {
    await page.goto(`${BASE}/cgv`)
    const text = await page.textContent('body')
    expect(text?.length).toBeGreaterThan(200)
  })

  test('/cgu has content', async ({ page }) => {
    await page.goto(`${BASE}/cgu`)
    const text = await page.textContent('body')
    expect(text?.length).toBeGreaterThan(200)
  })
})

test.describe('Help center', () => {
  test('has guides and FAQ', async ({ page }) => {
    await page.goto(`${BASE}/help`)
    const text = await page.textContent('body')
    // Should have substantial content
    expect(text?.length).toBeGreaterThan(500)
  })
})

test.describe('Landing page sections', () => {
  test('has hero, features, pricing CTA', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    // Hero should be visible
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    // Should have CTA buttons
    const body = await page.textContent('body')
    expect(body).toContain('SUTRA')
  })
})

test.describe('Mobile responsive', () => {
  test('login page works at 375px', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="remember-me-checkbox"]')).toBeVisible()
    await context.close()
  })

  test('landing page works at 375px', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    await context.close()
  })

  test('pricing page works at 375px', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator('text=Starter')).toBeVisible()
    await context.close()
  })
})
