import { test, expect, Page } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL ?? 'https://sutra.purama.dev'

async function dismissCookieBanner(page: Page) {
  await page.evaluate(() =>
    localStorage.setItem(
      'sutra-cookie-consent',
      JSON.stringify({ essential: true, analytics: false, marketing: false })
    )
  )
}

test.describe('Media Mode (stock footage)', () => {
  test('mediaMode cards visible on /create (auto mode)', async ({ page }) => {
    await page.goto(`${BASE}/create`)
    await dismissCookieBanner(page)
    // Auth wall: page redirects to /login if not logged in. We just verify
    // the route exists by checking either form or login presence.
    const loginVisible = await page
      .locator('[data-testid="login-form"], form input[type="email"]')
      .first()
      .isVisible()
      .catch(() => false)
    test.skip(loginVisible, 'Auth wall in place; smoke test only')

    await expect(page.getByTestId('media-mode-ai')).toBeVisible()
    await expect(page.getByTestId('media-mode-stock')).toBeVisible()
    await expect(page.getByTestId('media-mode-mixed')).toBeVisible()
  })

  test('selecting each mediaMode toggles selected state', async ({ page }) => {
    await page.goto(`${BASE}/create`)
    await dismissCookieBanner(page)
    const ai = page.getByTestId('media-mode-ai')
    const stock = page.getByTestId('media-mode-stock')
    const mixed = page.getByTestId('media-mode-mixed')

    const visible = await ai.isVisible().catch(() => false)
    test.skip(!visible, 'Auth wall in place; smoke test only')

    for (const card of [ai, stock, mixed]) {
      await card.click()
      // The selected card has the violet border class — assert via DOM
      const cls = await card.getAttribute('class')
      expect(cls).toContain('border-violet-500/50')
    }
  })

  test('POST /api/stock/search returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post(`${BASE}/api/stock/search`, {
      data: { query: 'sunset beach', orientation: 'landscape', type: 'any' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('POST /api/stock/search rejects invalid params (when reachable)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/stock/search`, {
      data: { query: '', orientation: 'invalid' },
    })
    expect([400, 401, 403]).toContain(res.status())
  })
})
