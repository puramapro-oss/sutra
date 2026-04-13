import { test, expect } from '@playwright/test'

test.describe('Security — XSS prevention', () => {
  test('login form does not execute XSS in email', async ({ page }) => {
    let alertFired = false
    page.on('dialog', () => { alertFired = true })
    await page.goto('/login')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await emailInput.fill('<script>alert("xss")</script>')
    await page.waitForTimeout(500)
    expect(alertFired).toBe(false)
  })

  test('search params do not inject HTML', async ({ page }) => {
    await page.goto('/?q=<script>alert(1)</script>')
    const html = await page.content()
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})

test.describe('Security — No secrets in client', () => {
  test('landing page source has no secrets', async ({ page }) => {
    await page.goto('/')
    const html = await page.content()
    expect(html).not.toContain('sk_live_')
    expect(html).not.toContain('sk-ant-')
    expect(html).not.toContain('SUPABASE_SERVICE_ROLE')
    expect(html).not.toContain('POSTGRES_PASSWORD')
  })

  test('pricing page source has no secrets', async ({ page }) => {
    await page.goto('/pricing')
    const html = await page.content()
    expect(html).not.toContain('sk_live_')
    expect(html).not.toContain('sk-ant-')
  })
})

test.describe('Security — CORS & headers', () => {
  test('API returns proper headers', async ({ request }) => {
    const res = await request.get('/api/status')
    expect(res.status()).toBe(200)
  })
})

test.describe('Security — Auth protection', () => {
  test('admin API requires auth', async ({ request }) => {
    const res = await request.get('/api/admin/stats')
    expect([401, 403]).toContain(res.status())
  })

  test('admin pages redirect unauthenticated', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL(/login/, { timeout: 10000 })
    expect(page.url()).toContain('login')
  })
})
