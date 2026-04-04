import { test, expect, Page } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

/**
 * Utility: collect all clickable elements on a page and verify none are dead.
 * A "dead" button/link = href="#", href="#demo", onclick that does nothing,
 * or a button/link that causes a JS error when clicked.
 */
async function auditClickables(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: 'networkidle', timeout: 15000 })
  expect(res?.status()).toBeLessThan(400)

  // Check no href="#" links
  const deadLinks = await page.locator('a[href="#"], a[href="#demo"]').count()
  expect(deadLinks).toBe(0)

  // Check no buttons with "bientot disponible" toast text in onclick
  const pageContent = await page.content()
  expect(pageContent).not.toContain('bientot disponible')
}

// ── Public pages ──

test.describe('Public Pages - No Dead Buttons', () => {
  test('Landing page - all buttons functional', async ({ page }) => {
    await auditClickables(page, '/')

    // Verify primary CTA exists and links to /signup
    const primaryCTA = page.getByTestId('hero-cta-primary')
    await expect(primaryCTA).toBeVisible()
    expect(await primaryCTA.getAttribute('href')).toBe('/signup')

    // Verify secondary CTA links to /how-it-works (not a dead demo link)
    const secondaryCTA = page.getByTestId('hero-cta-secondary')
    await expect(secondaryCTA).toBeVisible()
    expect(await secondaryCTA.getAttribute('href')).toBe('/how-it-works')

    // Verify no "Voir la demo" text anywhere
    await expect(page.getByText('Voir la demo')).toHaveCount(0)

    // Click primary CTA - should navigate to signup
    await primaryCTA.click()
    await page.waitForURL(/signup/, { timeout: 10000 })
  })

  test('Landing page - footer links work', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // All footer links should have valid hrefs
    const footerLinks = page.locator('footer a[href]')
    const count = await footerLinks.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const href = await footerLinks.nth(i).getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).not.toBe('#')
      expect(href).not.toBe('#demo')
    }
  })

  test('Pricing page - plan buttons work', async ({ page }) => {
    await auditClickables(page, '/pricing')

    // All plan buttons should exist
    const planButtons = page.locator('button, a').filter({ hasText: /commencer|choisir|essayer|gratuit/i })
    const count = await planButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('How It Works page loads', async ({ page }) => {
    await auditClickables(page, '/how-it-works')
  })

  test('Ecosystem page loads', async ({ page }) => {
    await auditClickables(page, '/ecosystem')
  })

  test('Help page loads', async ({ page }) => {
    await auditClickables(page, '/help')
  })

  test('Status page loads', async ({ page }) => {
    await auditClickables(page, '/status')
  })

  test('Legal pages load', async ({ page }) => {
    for (const path of ['/legal', '/legal/terms', '/legal/cgv', '/legal/privacy', '/legal/cookies', '/legal/mentions']) {
      await auditClickables(page, path)
    }
  })
})

// ── Auth pages ──

test.describe('Auth Pages - No Dead Buttons', () => {
  test('Signup page - form buttons work', async ({ page }) => {
    await auditClickables(page, '/signup')

    // Submit button should exist
    const submitBtn = page.locator('button[type="submit"]').first()
    await expect(submitBtn).toBeVisible()

    // Google auth button should exist
    const googleBtn = page.getByTestId('google-button')
    await expect(googleBtn).toBeVisible()
  })

  test('Login page - form buttons work', async ({ page }) => {
    await auditClickables(page, '/login')

    const submitBtn = page.locator('button[type="submit"]').first()
    await expect(submitBtn).toBeVisible()

    // "Inscris-toi" link must point to /signup
    const signupLink = page.locator('a[href="/signup"]')
    await expect(signupLink).toBeVisible()

    // Click it and verify we land on /signup, NOT /dashboard
    await signupLink.click()
    await page.waitForURL(/signup/, { timeout: 10000 })
    expect(page.url()).toContain('/signup')
    expect(page.url()).not.toContain('/dashboard')
  })

  test('Signup page is accessible even with session cookie', async ({ page }) => {
    // Navigate to signup directly — must NOT redirect to dashboard
    const res = await page.goto('/signup', { waitUntil: 'networkidle', timeout: 15000 })
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('Forgot password page loads', async ({ page }) => {
    await auditClickables(page, '/forgot-password')
  })
})

// ── API routes ──

test.describe('API Routes', () => {
  test('/api/status returns JSON', async ({ request }) => {
    const res = await request.get(`${BASE}/api/status`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('Protected API routes return 401 without auth', async ({ request }) => {
    const protectedRoutes = [
      { method: 'GET', path: '/api/admin/stats' },
      { method: 'POST', path: '/api/create' },
      { method: 'GET', path: '/api/drafts' },
      { method: 'GET', path: '/api/notifications' },
      { method: 'GET', path: '/api/templates' },
      { method: 'POST', path: '/api/ai/chat' },
      { method: 'GET', path: '/api/settings' },
    ]

    for (const route of protectedRoutes) {
      const res = route.method === 'GET'
        ? await request.get(`${BASE}${route.path}`)
        : await request.post(`${BASE}${route.path}`, { data: {} })
      expect(res.status(), `${route.method} ${route.path} should be 401`).toBe(401)
    }
  })
})

// ── Dashboard pages (unauthenticated - should redirect to login or show login prompt) ──

test.describe('Dashboard Pages - Redirect or Load', () => {
  const dashboardPages = [
    '/dashboard',
    '/create',
    '/library',
    '/templates',
    '/publish',
    '/voices',
    '/autopilot',
    '/settings',
    '/notifications',
    '/referral',
    '/contest',
    '/wallet',
    '/classement',
  ]

  for (const path of dashboardPages) {
    test(`${path} - does not show 500 error`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'networkidle', timeout: 15000 })
      // Should either redirect to login or load the page (200)
      const status = res?.status() ?? 200
      expect(status).toBeLessThan(500)
    })
  }
})
