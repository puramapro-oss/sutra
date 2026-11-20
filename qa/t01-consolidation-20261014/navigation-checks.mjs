// Diagnostic on the real local application; only the HTTP/auth fixture is synthetic.
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function navigationChecks({ page, context, base, fixture, check, details }) {
  await page.goto(base + '/login?next=/library')
  await page.getByTestId('cookie-refuse').click()
  await page.getByTestId('email-input').fill(fixture.user.email)
  await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  await check('real login transition reaches the unaccepted synthetic identity gate', async () => {
    await expect(page.getByRole('heading', { name: 'Mise à jour de nos conditions' })).toBeVisible({ timeout: 60000 })
    await expect(page).toHaveURL(base + '/library')
    assert.equal(fixture.state.writes.length, 0)
  })
  // Seed only the disposable database. No application endpoint or real consent is bypassed.
  fixture.state.acceptances = ['mentions', 'cgu', 'cgv', 'confidentialite'].map(doc_type => ({ user_id: fixture.user.id, doc_type, version: '1.0' }))
  await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('dashboard-greeting')).toBeVisible()
  let pending = false, release
  const held = new Promise(resolve => { release = resolve })
  await context.route('**/__t01_navigation_probe', async route => {
    pending = true
    await held
    await route.fulfill({ status: 204 }).catch(() => {})
  })
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => { void fetch('/__t01_navigation_probe').catch(() => {}) }, { once: true })
  })
  try {
    let timeout = false
    try { await page.goto(base + '/dashboard', { waitUntil: 'networkidle', timeout: 5000 }) }
    catch (error) { if (error.name !== 'TimeoutError') throw error; timeout = true }
    await check('networkidle times out while dashboard is rendered and usable', async () => {
      assert.ok(timeout, 'old readiness metric must reproduce a timeout')
      assert.ok(pending, 'background request is actually pending')
      await expect(page.getByTestId('quick-action-create')).toBeInViewport()
      await page.getByTestId('search-trigger').click()
      await expect(page.getByTestId('search-modal')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('search-trigger')).toBeFocused()
    })
    await check('DOMContentLoaded plus original dashboard assertions tolerate background activity', async () => {
      await page.goto(base + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 5000 })
      await expect(page.getByTestId('quick-action-create')).toBeInViewport()
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.getByTestId('sidebar-toggle').click()
      await expect(page.getByTestId('sidebar-production')).toHaveAccessibleName('Production')
      await page.getByTestId('search-trigger').click()
      await expect(page.getByTestId('search-modal')).toBeVisible()
      await page.getByTestId('search-input').fill('montage')
      await expect(page.getByTestId('search-result-production')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('search-trigger')).toBeFocused()
    })
    details.push({ injectedBackgroundRequest: true, oldNetworkIdleTimedOut: timeout, exactCauseOfHistoricalCIFailure: 'UNPROVEN', productChanged: false })
  } finally { release() }
}
