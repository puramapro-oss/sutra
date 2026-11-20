import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL ?? 'https://sutra.purama.dev'

async function openAuthenticatedCreate(page: Page) {
  // Credentials belong only to the local Supabase fixture in test-ui-isolated.mjs.
  expect(new URL(BASE).hostname, 'synthetic account requires the loopback fixture').toBe('127.0.0.1')
  await page.addInitScript(() => {
    localStorage.setItem('purama_cookie_consent_v1', JSON.stringify({ necessaire: true, mesure: false, marketing: false, updatedAt: new Date().toISOString() }))
    localStorage.setItem('sutra_intro_seen', '1')
    localStorage.setItem('sutra_tutorial_dismissed', 'true')
  })
  await page.goto(`${BASE}/login?next=%2Fcreate`)
  await page.getByTestId('email-input').fill('studio-test@example.invalid')
  await page.getByTestId('password-input').fill('fixture-password-42')
  await page.getByTestId('login-button').click()
  await expect(page).toHaveURL(`${BASE}/create`)
  await expect(page.getByTestId('header')).toBeVisible()
}

test.describe('Media Mode (stock footage)', () => {
  test('mediaMode cards visible on /create (auto mode)', async ({ page }) => {
    await openAuthenticatedCreate(page)

    await expect(page.getByTestId('media-mode-ai')).toBeVisible()
    await expect(page.getByTestId('media-mode-stock')).toBeVisible()
    await expect(page.getByTestId('media-mode-mixed')).toBeVisible()
  })

  test('selecting each mediaMode toggles selected state', async ({ page }) => {
    await openAuthenticatedCreate(page)
    const ai = page.getByTestId('media-mode-ai')
    const stock = page.getByTestId('media-mode-stock')
    const mixed = page.getByTestId('media-mode-mixed')

    for (const card of [ai, stock, mixed]) {
      await card.click()
      for (const option of [ai, stock, mixed]) {
        await expect(option).toHaveAttribute('aria-pressed', option === card ? 'true' : 'false')
      }
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
