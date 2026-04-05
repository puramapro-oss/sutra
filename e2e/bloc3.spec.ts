import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

test.describe('Centre d\'aide', () => {
  test('aide redirects to help', async ({ page }) => {
    const res = await page.goto('/aide')
    expect(page.url()).toContain('/help')
  })

  test('help page has 4 guides with real content', async ({ page }) => {
    await page.goto('/help')
    await expect(page.locator('h1').first()).toBeVisible()

    // Guide 1: Creer ta premiere video
    await expect(page.locator('#guide-premiere-video')).toBeVisible()
    await expect(page.locator('#guide-premiere-video').locator('text=Etape 1').first()).toBeVisible()

    // Guide 2: Styles
    await expect(page.locator('#guide-styles')).toBeVisible()
    await expect(page.locator('#guide-styles').locator('text=Cinematique').first()).toBeVisible()

    // Guide 3: Publier
    await expect(page.locator('#guide-publier')).toBeVisible()
    await expect(page.locator('#guide-publier').locator('text=Telecharger').first()).toBeVisible()

    // Guide 4: Parrainage
    await expect(page.locator('#guide-parrainage')).toBeVisible()
    await expect(page.locator('#guide-parrainage').locator('text=code de parrainage').first()).toBeVisible()
  })

  test('help page has 15+ FAQ questions', async ({ page }) => {
    await page.goto('/help')

    // Show all FAQs by selecting "Tout"
    const allBtn = page.getByTestId('faq-category-all')
    await allBtn.click()

    // Count FAQ items
    const faqItems = page.locator('button[aria-expanded]')
    const count = await faqItems.count()
    expect(count).toBeGreaterThanOrEqual(15)
  })

  test('help FAQ accordion opens/closes', async ({ page }) => {
    await page.goto('/help')

    const firstToggle = page.locator('button[aria-expanded]').first()
    await expect(firstToggle).toBeVisible()

    // First item is open by default
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true')

    // Click to close
    await firstToggle.click()
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false')

    // Click to reopen
    await firstToggle.click()
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('help FAQ category filters work', async ({ page }) => {
    await page.goto('/help')

    for (const cat of ['general', 'creation', 'voix', 'abonnement', 'technique']) {
      const btn = page.getByTestId(`faq-category-${cat}`)
      await btn.click()
      // Should have at least 1 FAQ visible
      const items = page.locator('button[aria-expanded]')
      const count = await items.count()
      expect(count, `Category ${cat} should have FAQs`).toBeGreaterThan(0)
    }
  })

  test('help contact form is present', async ({ page }) => {
    await page.goto('/help')
    await expect(page.getByTestId('contact-form')).toBeVisible()
    await expect(page.getByTestId('contact-name-input')).toBeVisible()
    await expect(page.getByTestId('contact-email-input')).toBeVisible()
    await expect(page.getByTestId('contact-subject-input')).toBeVisible()
    await expect(page.getByTestId('contact-message-input')).toBeVisible()
    await expect(page.getByTestId('contact-submit')).toBeVisible()
  })

  test('help page has CTA to signup', async ({ page }) => {
    await page.goto('/help')
    const signupLink = page.locator('a[href="/signup"]').first()
    await expect(signupLink).toBeVisible()
  })

  test('help page no dead links', async ({ page }) => {
    await page.goto('/help', { waitUntil: 'networkidle' })
    const deadLinks = await page.locator('a[href="#"], a[href="#demo"]').count()
    expect(deadLinks).toBe(0)
  })
})

test.describe('Admin Dashboard - Access Control', () => {
  test('admin redirects unauthenticated to login', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle', timeout: 15000 })
    // Should redirect to login
    expect(page.url()).toContain('/login')
  })

  test('admin/users redirects unauthenticated', async ({ page }) => {
    await page.goto('/admin/users', { waitUntil: 'networkidle', timeout: 15000 })
    expect(page.url()).toContain('/login')
  })

  test('admin/withdrawals redirects unauthenticated', async ({ page }) => {
    await page.goto('/admin/withdrawals', { waitUntil: 'networkidle', timeout: 15000 })
    expect(page.url()).toContain('/login')
  })

  test('admin/contest redirects unauthenticated', async ({ page }) => {
    await page.goto('/admin/contest', { waitUntil: 'networkidle', timeout: 15000 })
    expect(page.url()).toContain('/login')
  })

  test('admin/classement redirects unauthenticated', async ({ page }) => {
    await page.goto('/admin/classement', { waitUntil: 'networkidle', timeout: 15000 })
    expect(page.url()).toContain('/login')
  })

  test('admin pages dont return 500', async ({ request }) => {
    for (const path of ['/admin', '/admin/users', '/admin/withdrawals', '/admin/contest', '/admin/classement']) {
      const res = await request.get(`${BASE}${path}`)
      expect(res.status(), `${path} should not 500`).toBeLessThan(500)
    }
  })
})

test.describe('Mobile - Help', () => {
  test('help page responsive at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/help')
    await expect(page.locator('h1').first()).toBeVisible()
    // FAQ should still be accessible
    await expect(page.locator('button[aria-expanded]').first()).toBeVisible()
  })
})
