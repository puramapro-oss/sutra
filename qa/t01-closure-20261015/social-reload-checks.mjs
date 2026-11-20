import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { resolve } from 'node:path'
export async function socialReloadChecks({ page, context, base, output, check, details, production = false }) {
  const account = { id: '33333333-3333-4333-8333-333333333333', platform: 'youtube', username: 'fixture', display_name: 'Fixture', status: 'connected', avatar_url: null, connected_at: '2026-10-15T00:00:00Z' }
  const secondAccount = { ...account, id: '44444444-4444-4444-8444-444444444444', username: 'fixture-second', display_name: 'Deuxième chaîne' }
  const config = { enabled: true, default_platforms: ['youtube'], publish_account_ids: [account.id], auto_caption: false, auto_hashtags: true, caption_style: 'professional', max_hashtags: 7, include_cta: false }
  let mode = 'saved', reads = 0, writes = 0
  await context.route('**/api/social/accounts', route => route.fulfill({ json: { accounts: [account, secondAccount], autopilot: { enabled: false } } }))
  await context.route('**/api/social/autopilot', async route => {
    if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 403, json: {} }) }
    reads++
    if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'PRIVATE_FIXTURE' } })
    if (mode === 'invalid') return route.fulfill({ json: { config: { ...config, default_platforms: 'youtube' } } })
    if (mode === 'missing') return route.fulfill({ json: {} })
    return route.fulfill({ json: { config } })
  })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 }); mode = 'saved'
    await page.goto(base + '/settings/social')
    await check(`${width}: saved autopilot comes from its authoritative GET and survives reload`, async () => {
      await expect(page.getByTestId('select-caption-style')).toHaveValue('professional', { timeout: 3500 })
      await expect(page.getByTestId(`autopilot-account-${account.id}`)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId(`autopilot-account-${secondAccount.id}`)).toHaveAttribute('aria-pressed', 'false')
      const before = reads; await page.reload()
      await expect(page.getByTestId('select-caption-style')).toHaveValue('professional')
      await expect(page.getByTestId(`autopilot-account-${account.id}`)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId(`autopilot-account-${secondAccount.id}`)).toHaveAttribute('aria-pressed', 'false')
      const reloadReads = reads - before
      details.push({ name: `reload-${width}`, reloadReads, production })
      // React development StrictMode remounts the read effect. Production must read once.
      if (production) assert.equal(reloadReads, 1)
      else assert.ok(reloadReads >= 1 && reloadReads <= 2)
      assert.equal(writes, 0)
      await page.getByTestId('select-caption-style').scrollIntoViewIfNeeded()
      await page.waitForTimeout(700) // Framer Motion settles before the evidence capture.
      await page.screenshot({ path: resolve(output, `social-saved-${width}.png`), animations: 'disabled' })
    })
  }
  for (const failure of process.argv.includes('--reload-only') ? [] : ['failure', 'missing', 'invalid']) {
    mode = failure; await page.goto(base + '/settings/social')
    await check(`autopilot ${failure} is unknown, never a default editable state`, async () => {
      await expect(page.getByTestId('social-load-error')).toBeVisible({ timeout: 3500 })
      await expect(page.getByTestId('toggle-autopilot')).toHaveCount(0)
      assert.equal((await page.locator('body').innerText()).includes('PRIVATE_FIXTURE'), false)
      mode = 'saved'; const before = reads
      await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer', exact: true }).evaluate(b => { b.click(); b.click() })
      await expect(page.getByTestId('select-caption-style')).toHaveValue('professional')
      assert.equal(reads - before, 1); assert.equal(writes, 0)
    })
  }
  details.push({ name: 'autopilot-read-contract', reads, writes, realAccountsConnected: 0, publications: 0 })
}
