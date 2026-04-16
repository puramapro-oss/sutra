import { test, expect } from '@playwright/test'

test.describe('V7 — /confirmation page (magic moment)', () => {
  test('page loads with welcome title and prime amount', async ({ page }) => {
    await page.goto('/confirmation?session_id=cs_test_simulation')

    await expect(page.locator('[data-testid="confirmation-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="confirmation-title"]')).toContainText(/Bienvenue/i)
    await expect(page.locator('[data-testid="confirmation-prime-amount"]')).toBeVisible()
    await expect(page.locator('[data-testid="confirmation-prime-amount"]')).toContainText('25')
  })

  test('dashboard CTA exists and is clickable', async ({ page }) => {
    await page.goto('/confirmation?session_id=cs_test_simulation')
    const cta = page.locator('[data-testid="go-dashboard"]')
    await expect(cta).toBeVisible()
    await expect(cta).toBeEnabled()
  })

  test('legal mention L221-28 is present', async ({ page }) => {
    await page.goto('/confirmation?session_id=cs_test_simulation')
    await expect(page.getByText(/L221-28/i).first()).toBeVisible()
  })

  test('purama_promo cookie is cleared on confirmation load', async ({ page, context, baseURL }) => {
    const hostname = new URL(baseURL ?? 'https://sutra.purama.dev').hostname
    await context.addCookies([
      {
        name: 'purama_promo',
        value: JSON.stringify({ coupon: 'WELCOME50', source: 'midas' }),
        domain: hostname,
        path: '/',
      },
    ])
    await page.goto('/confirmation?session_id=cs_test')
    await page.waitForTimeout(500)
    const cookies = await context.cookies()
    const promo = cookies.find((c) => c.name === 'purama_promo' && c.value.length > 0)
    expect(promo).toBeUndefined()
  })
})
