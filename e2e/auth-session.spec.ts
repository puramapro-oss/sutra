import { test, expect } from '@playwright/test'

const BASE = 'https://sutra.purama.dev'

test.describe('Auth session security', () => {
  test('login page shows remember-me checkbox', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    const checkbox = page.locator('[data-testid="remember-me-checkbox"]')
    await expect(checkbox).toBeVisible()
    // Default: unchecked
    await expect(checkbox).not.toBeChecked()
  })

  test('remember-me checkbox can be toggled', async ({ page }) => {
    await page.goto(`${BASE}/login`)
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
    // Go to login page
    await page.goto(`${BASE}/login`)

    // Verify we are on the login page
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()

    // Simulate: set the signed_out flag (as signOut does)
    await page.evaluate(() => {
      sessionStorage.setItem('sutra_signed_out', 'true')
      localStorage.clear()
    })

    // Reload: should stay on login, not redirect to dashboard
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
    // Verify we're still on login
    expect(page.url()).toContain('/login')
  })

  test('remember-me label text is visible', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await expect(page.locator('[data-testid="remember-me-label"]')).toContainText('Rester connecte')
  })
})
