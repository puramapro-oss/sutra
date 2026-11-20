import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

const sleep = ms => new Promise(done => setTimeout(done, ms))
export async function schedulerChecks({ page, context, base, width, check, details, visual }) {
  const state = { active: false, writes: [], reads: 0, mode: 'normal', readMode: 'normal', delay: 300 }
  const config = () => ({ is_active: state.active, schedules: [{ id: 'fixture-schedule', name: 'Fixture Europe/Paris', frequency: 'daily', time: '09:00', timezone: 'Europe/Paris' }], auto_publish: false, require_approval_before_publish: true })
  await context.unroute('**/api/auto/config')
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'GET') {
      state.reads++
      if (state.readMode === 'hang') { await sleep(12_000); return route.abort().catch(() => {}) }
      if (state.readMode === 'fail') return route.fulfill({ status: 503, json: { error: 'private-fixture-detail' } })
      if (state.readMode === 'malformed') return route.fulfill({ json: { config: { is_active: 'true' } } })
      return route.fulfill({ json: { config: config() } })
    }
    const body = route.request().postDataJSON(); state.writes.push(body)
    await sleep(state.delay)
    if (state.mode === 'fail') return route.fulfill({ status: 503, json: { error: 'private-fixture-detail' } })
    if (state.mode !== 'mismatch') state.active = body.is_active
    if (state.mode === 'lost') return route.abort('failed')
    return route.fulfill({ json: { config: config() } })
  })
  await context.route('**/api/auto/videos*', route => route.fulfill({ json: { videos: [] } }))
  const toggle = page.getByTestId('auto-toggle'), retry = page.getByTestId('auto-retry')
  const status = page.getByTestId('auto-status'), panel = page.getByTestId('auto-scheduler')
  await check(`${width}: scheduler load and keyboard double activation persist one absolute preference`, async () => {
    const started = performance.now(); await page.goto(base + '/auto')
    await expect(toggle).toBeEnabled({ timeout: 15000 })
    details.push({ width, measure: 'auto_ready_ms_dev', value: Math.round(performance.now() - started) })
    await toggle.focus(); await expect(toggle).toBeFocused()
    const clicked = performance.now()
    await toggle.evaluate(button => { button.click(); button.click() })
    await expect(toggle).toBeDisabled()
    await expect(status).toHaveText('Planification autorisée dans la configuration.')
    await expect(toggle).toBeEnabled()
    assert.deepEqual(state.writes, [{ is_active: true }])
    details.push({ width, measure: 'activation_ack_ms_300ms_fixture', value: Math.round(performance.now() - clicked), requests: state.writes.length })
    await expect(page.getByText('SUTRA produit selon ton planning.', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('auto-runtime-status')).toContainText('non vérifiable')
    await expect(panel).toContainText('payants')
  })
  await check(`${width}: scheduler pause through keyboard does not invoke cron or generation`, async () => {
    await toggle.focus(); await page.keyboard.press('Enter')
    await expect(status).toHaveText('Planification en pause dans la configuration.')
    assert.deepEqual(state.writes[1], { is_active: false })
  })
  await check(`${width}: lost activation acknowledgement reconciles by GET without another PATCH`, async () => {
    state.mode = 'lost'
    await toggle.click()
    await expect(panel.getByRole('alert')).toBeVisible()
    const count = state.writes.length
    await retry.evaluate(button => { button.click(); button.click() })
    await expect(status).toHaveText('Planification autorisée dans la configuration.')
    assert.equal(state.writes.length, count)
    await expect(toggle).toBeEnabled()
  })
  await check(`${width}: unavailable API retries the same pause, preserving all scheduling fields`, async () => {
    state.mode = 'fail'
    await toggle.click(); await expect(panel.getByRole('alert')).toBeVisible()
    await expect(panel).not.toContainText('private-fixture-detail')
    state.mode = 'normal'
    await retry.click(); await expect(status).toHaveText('Planification en pause dans la configuration.')
    assert.deepEqual(state.writes.slice(-2), [{ is_active: false }, { is_active: false }])
    assert.ok(state.writes.every(body => Object.keys(body).join() === 'is_active'))
  })
  await check(`${width}: contradictory 200 response is not activation success`, async () => {
    state.mode = 'mismatch'
    await toggle.click(); await expect(panel.getByRole('alert')).toBeVisible()
    await expect(status).not.toHaveText('Planification autorisée dans la configuration.')
    state.mode = 'normal'; await retry.click()
    await expect(status).toHaveText('Planification autorisée dans la configuration.')
  })
  await check(`${width}: loading failure has an inline error and manual recovery, never false inactive`, async () => {
    state.readMode = 'fail'; await page.reload()
    await expect(panel.getByRole('alert')).toBeVisible({ timeout: 15000 })
    await expect(status).toHaveText('État de la préférence inconnu.')
    const count = state.writes.length
    state.readMode = 'normal'; await retry.click()
    await expect(status).toHaveText('Planification autorisée dans la configuration.')
    assert.equal(state.writes.length, count)
  })
  await check(`${width}: stalled read stops loading within deadline and can recover`, async () => {
    state.readMode = 'hang'; const start = performance.now(); await page.reload()
    await expect(panel.getByRole('alert')).toBeVisible({ timeout: 15000 })
    details.push({ width, measure: 'stalled_config_error_ms', value: Math.round(performance.now() - start) })
    await expect(retry).toBeEnabled()
    state.readMode = 'normal'; await retry.click(); await expect(toggle).toBeEnabled()
  })
  await check(`${width}: malformed configuration stays unknown; accessible responsive controls`, async () => {
    state.readMode = 'malformed'; await page.reload(); await expect(panel.getByRole('alert')).toBeVisible()
    await expect(status).toHaveText('État de la préférence inconnu.')
    await visual(`scheduler-error-${width}`, '[data-testid="auto-scheduler"]')
    state.readMode = 'normal'; await retry.click(); await expect(toggle).toBeEnabled()
    await visual(`scheduler-ready-${width}`, '[data-testid="auto-scheduler"]')
  })
}
