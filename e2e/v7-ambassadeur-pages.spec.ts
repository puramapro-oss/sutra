import { test, expect, Page } from '@playwright/test'

async function dismissCookieBanner(page: Page) {
  await page.evaluate(() =>
    localStorage.setItem(
      'sutra-cookie-consent',
      JSON.stringify({ essential: true, analytics: false, marketing: false })
    )
  )
}

test.describe('V7 — /devenir-ambassadeur page', () => {
  test('page loads with tier grid + form visible', async ({ page }) => {
    await page.goto('/devenir-ambassadeur')
    await dismissCookieBanner(page)
    await page.reload()

    await expect(page.locator('h1').first()).toBeVisible()
    await expect(page.getByText(/Programme Ambassadeur/i).first()).toBeVisible()
    await expect(page.locator('[data-testid="input-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="input-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="submit-ambassador"]')).toBeVisible()
  })

  test('shows all 9 ambassador tiers (Bronze → Éternel)', async ({ page }) => {
    await page.goto('/devenir-ambassadeur')
    const tiers = ['Bronze', 'Argent', 'Or', 'Platine', 'Diamant', 'Légende', 'Titan', 'Dieu', 'Éternel']
    for (const tier of tiers) {
      await expect(page.getByText(tier, { exact: true }).first()).toBeVisible()
    }
  })

  test('displays legendary prime amount 200 000 €', async ({ page }) => {
    await page.goto('/devenir-ambassadeur')
    await expect(page.getByText(/200 000/).first()).toBeVisible()
  })

  test('form empty submit does nothing (required validation)', async ({ page }) => {
    await page.goto('/devenir-ambassadeur')
    const submit = page.locator('[data-testid="submit-ambassador"]')
    await expect(submit).toBeDisabled()
  })

  test('/devenir-influenceur redirects permanently to /devenir-ambassadeur', async ({ request }) => {
    const res = await request.get('/devenir-influenceur', { maxRedirects: 0 })
    expect([301, 308]).toContain(res.status())
    expect(res.headers()['location']).toContain('/devenir-ambassadeur')
  })

  test('/influencer redirects permanently to /ambassadeur', async ({ request }) => {
    const res = await request.get('/influencer', { maxRedirects: 0 })
    expect([301, 308]).toContain(res.status())
    expect(res.headers()['location']).toContain('/ambassadeur')
  })
})
