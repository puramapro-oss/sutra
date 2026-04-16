import { test, expect } from '@playwright/test'

test.describe('V7 — Ambassador block on /ambassadeur (auth required, skipped if not)', () => {
  test('/ambassadeur route exists — redirects non-auth to login', async ({ page }) => {
    const res = await page.goto('/ambassadeur', { waitUntil: 'domcontentloaded' })
    expect(res?.status()).toBeLessThan(500)
    // Either landed on /ambassadeur or bounced to /login
    const url = page.url()
    expect(url).toMatch(/\/(ambassadeur|login)/)
  })

  test('/ambassadeur is protected — non-auth gets redirected', async ({ page }) => {
    await page.goto('/ambassadeur')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/login')
  })
})

test.describe('V7 — Dashboard is protected', () => {
  test('/dashboard redirects to /login if not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    expect(page.url()).toContain('/login')
  })
})
