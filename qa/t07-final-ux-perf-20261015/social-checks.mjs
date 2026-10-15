import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'

export async function socialChecks({ page, context, base, fixture, output, check, details }) {
  await page.goto(base + '/login?next=/library')
  await page.getByTestId('cookie-refuse').click()
  await page.getByTestId('email-input').fill(fixture.user.email)
  await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  const accept = page.getByRole('button', { name: "J'ai lu, je continue" })
  await expect(accept).toBeVisible({ timeout: 60000 })
  for (const doc of ['mentions', 'cgu', 'cgv', 'confidentialite']) {
    await accept.click()
    await expect.poll(() => fixture.state.acceptances.some(a => a.doc_type === doc)).toBe(true)
    if (doc !== 'confidentialite') await expect(accept).toBeEnabled()
  }
  await expect(accept).toHaveCount(0)
  let mode = 'failure', calls = 0, deletes = 0
  const account = { id: '33333333-3333-4333-8333-333333333333', platform: 'youtube', username: 'test-social', display_name: 'Test social', avatar_url: null, status: 'connected', connected_at: '2026-10-15T00:00:00Z' }
  await context.route('**/api/social/accounts', async route => {
    if (route.request().method() === 'DELETE') {
      deletes++
      mode = 'failure'
      return route.fulfill({ status: 202, json: { success: false, remoteStatus: 'unknown' } })
    }
    calls++
    if (mode === 'slow') await new Promise(done => setTimeout(done, 16000))
    if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'fixture_social_unavailable' } })
    if (mode === 'interrupt') return route.abort('connectionreset')
    if (mode === 'invalid') return route.fulfill({ json: { error: 'unexpected_shape' } })
    if (mode === 'connected') return route.fulfill({ json: { accounts: [account], autopilot: null } })
    return route.fulfill({ json: { accounts: [], autopilot: null } }).catch(() => {})
  })
  for (const width of process.argv.includes('--dialog-only') ? [] : [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    mode = 'failure'
    await page.goto(base + '/settings/social')
    await check(`${width}: social unavailable is persistent, never a disconnected summary`, async () => {
      const alert = page.getByTestId('social-load-error')
      await expect(alert).toBeVisible()
      await expect(page.getByTestId('connected-count')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toHaveCount(0)
      await expect(alert.getByRole('button', { name: 'Réessayer', exact: true })).toBeEnabled()
    })
    await page.screenshot({ path: resolve(output, `social-unavailable-${width}.png`), fullPage: true })
    await check(`${width}: explicit retry recovers and ignores duplicate requests`, async () => {
      mode = 'normal'
      const before = calls
      await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer', exact: true }).evaluate(b => { b.click(); b.click() })
      await expect(page.getByTestId('connected-count')).toContainText('0 / 14')
      assert.equal(calls - before, 1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    })
  }
  mode = 'connected'
  await page.goto(base + '/settings/social')
  await check('disconnect dialog is named', async () => {
    await page.getByTestId('disconnect-youtube').click()
    try { await expect(page.getByRole('dialog')).toHaveAccessibleName('Deconnecter YouTube ?') }
    finally { await page.getByTestId('cancel-disconnect').click() }
  })
  await check('disconnect dialog traps focus, Escape restores trigger', async () => {
    const trigger = page.getByTestId('disconnect-youtube')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    try {
      await expect(page.getByTestId('cancel-disconnect')).toBeFocused()
      await page.getByTestId('confirm-disconnect').focus()
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
      assert.equal(deletes, 0)
    } finally {
      if (await dialog.count()) await page.getByTestId('cancel-disconnect').click()
    }
  })
  if (process.argv.includes('--dialog-only')) return
  await check('unconfirmed revocation survives failed account refresh without false empty state', async () => {
    await page.getByTestId('disconnect-youtube').click()
    await page.getByTestId('confirm-disconnect').click()
    await expect(page.getByText('Révocation distante non confirmée.', { exact: false })).toBeVisible()
    await expect(page.getByTestId('social-load-error')).toBeVisible()
    await expect(page.getByTestId('connected-count')).toHaveCount(0)
    assert.equal(deletes, 1)
    mode = 'normal'
    await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByTestId('connected-count')).toContainText('0 / 14')
    await expect(page.getByText('Révocation distante non confirmée.', { exact: false })).toBeVisible()
    assert.equal(deletes, 1)
  })
  mode = 'invalid'
  await page.goto(base + '/settings/social')
  await check('malformed account response is unavailable, not an empty account list', async () => {
    await expect(page.getByTestId('social-load-error')).toBeVisible()
    await expect(page.getByTestId('connected-count')).toHaveCount(0)
  })
  mode = 'slow'
  await page.goto(base + '/settings/social')
  await check('social slow response recovers within 12 seconds without late overwrite', async () => {
    const start = performance.now()
    try { await expect(page.getByTestId('social-load-error')).toBeVisible({ timeout: 12000 }) }
    finally { details.push({ name: 'social-timeout', elapsedMs: Math.round(performance.now() - start) }) }
    await expect(page.getByTestId('connected-count')).toHaveCount(0)
    mode = 'interrupt'
    await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByTestId('social-load-error')).toBeVisible()
    mode = 'normal'
    await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByTestId('connected-count')).toContainText('0 / 14')
    await page.waitForTimeout(6500)
    await expect(page.getByTestId('social-load-error')).toHaveCount(0)
  })
}
