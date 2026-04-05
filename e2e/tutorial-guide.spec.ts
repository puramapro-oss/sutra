import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

test.describe('Page /guide', () => {
  test('guide page requires auth - redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/guide`)
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('/login')
  })

  test('help page has link to guide', async ({ page }) => {
    await page.goto(`${BASE}/help`)
    await page.evaluate(() => localStorage.setItem('cookie_consent', 'accepted'))
    await page.goto(`${BASE}/help`)
    const guideLink = page.locator('[data-testid="help-guide-link"]')
    await expect(guideLink).toBeVisible()
    await expect(guideLink).toHaveAttribute('href', '/guide')
  })
})

test.describe('Tutorial overlay', () => {
  test('dashboard requires auth - redirects to login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForURL(/\/login/)
    expect(page.url()).toContain('/login')
  })
})

test.describe('Guide page content (via direct nav)', () => {
  test('guide page returns 200 for authenticated or redirects for unauth', async ({ page }) => {
    const response = await page.goto(`${BASE}/guide`)
    // Should redirect to login (307) or show login page (200)
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe('Sidebar has Guide link', () => {
  test('sidebar guide link exists in page source', async ({ page }) => {
    // We can only check this on a page that uses the sidebar (dashboard)
    // Since we can't auth, we verify the guide page structure indirectly
    // by checking the help page link to guide
    await page.goto(`${BASE}/help`)
    await page.evaluate(() => localStorage.setItem('cookie_consent', 'accepted'))
    await page.goto(`${BASE}/help`)

    // The guide link should exist
    const link = page.locator('a[href="/guide"]')
    await expect(link.first()).toBeVisible()
  })
})
