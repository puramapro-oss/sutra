import { test, expect, Page } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

async function dismissCookieBanner(page: Page) {
  // Set consent in localStorage to prevent banner from appearing
  await page.evaluate(() => localStorage.setItem('sutra-cookie-consent', JSON.stringify({ essential: true, analytics: false, marketing: false })))
  await page.reload()
}

test.describe('Auth session security', () => {
  test('login page shows remember-me checkbox', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await dismissCookieBanner(page)
    const checkbox = page.locator('[data-testid="remember-me-checkbox"]')
    await expect(checkbox).toBeVisible()
    // Default: unchecked
    await expect(checkbox).not.toBeChecked()
  })

  test('remember-me checkbox can be toggled', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await dismissCookieBanner(page)
    const checkbox = page.locator('[data-testid="remember-me-checkbox"]')
    await expect(checkbox).not.toBeChecked()
    await checkbox.click()
    await expect(checkbox).toBeChecked()
    await checkbox.click()
    await expect(checkbox).not.toBeChecked()
  })

  test('login form has email, password, google, remember-me, and submit', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="google-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="remember-me-checkbox"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
  })

  test('after signout, user lands on /login and is not auto-reconnected', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()

    // Simulate: set the signed_out flag (as signOut does)
    await page.evaluate(() => {
      sessionStorage.setItem('sutra_signed_out', 'true')
      localStorage.clear()
    })

    // Reload: should stay on login, not redirect to dashboard
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    expect(page.url()).toContain('/login')
  })

  test('remember-me label text is visible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await dismissCookieBanner(page)
    await expect(page.locator('[data-testid="remember-me-label"]')).toContainText('Rester connecte')
  })

  test('cookie banner appears on first visit', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const banner = page.locator('button:has-text("Accepter tout")')
    await expect(banner).toBeVisible({ timeout: 5000 })
  })
})
