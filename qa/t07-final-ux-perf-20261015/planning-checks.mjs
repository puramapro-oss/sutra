import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { expect } from '@playwright/test'
import { enterTestSession } from './session.mjs'
const require = createRequire(import.meta.url)

export async function planningChecks({ page, context, base, fixture, output, check, details }) {
  await enterTestSession({ page, base, fixture })
  let mode = 'failure', writes = [], schedules = []
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'GET') {
      if (mode === 'load-invalid') return route.fulfill({ json: { error: 'invalid_fixture' } })
      if (mode === 'load-failure') return route.fulfill({ status: 503, json: { error: 'fixture_unavailable' } })
      return route.fulfill({ json: { config: { schedules } } })
    }
    const payload = route.request().postDataJSON()
    writes.push(payload)
    await new Promise(done => setTimeout(done, mode === 'slow' ? 12_000 : 350))
    if (mode === 'failure') return route.fulfill({ status: 503, json: { error: 'fixture_unavailable' } })
    schedules = payload.schedules
    return route.fulfill({ json: { config: { schedules } } })
  })
  for (const width of [375, 1440]) {
    schedules = []; mode = 'failure'
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/auto/schedules')
    await page.getByTestId('schedule-add').click()
    const input = page.getByTestId('schedule-name'), save = page.getByTestId('schedule-save')
    await input.fill('Planning test sans publication')
    await check(`${width}: schedule labels, state and contrast`, async () => {
      await expect(page.getByTestId('schedule-time')).toHaveAccessibleName('Heure (Europe/Paris)')
      await expect(page.getByTestId('schedule-freq-weekly')).toHaveAttribute('aria-pressed', 'true')
      await page.waitForTimeout(700) // Let Framer Motion opacity settle before contrast measurement.
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: ['label', 'button-name', 'color-contrast'] })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target), reasons: nodes.map(n => n.failureSummary) })))
      details.push({ name: `planning-${width}-axe`, violations }); assert.deepEqual(violations, [])
    })
    await check(`${width}: failed schedule save preserves draft and rejects duplicate submissions`, async () => {
      const before = writes.length
      await save.evaluate(button => { button.click(); button.click() })
      await page.waitForTimeout(1000)
      details.push({ name: `schedule-${width}-double-submit`, calls: writes.length - before, draftRetained: await input.isVisible() })
      assert.equal(writes.length - before, 1)
      await expect(input).toHaveValue('Planning test sans publication')
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      await expect(save).toBeEnabled()
      mode = 'success'
      await save.click()
      await expect(input).toHaveCount(0)
      await expect(page.getByText('Planning test sans publication', { exact: true })).toBeVisible()
      assert.equal(writes.at(-1).schedules[0].timezone, 'Europe/Paris')
      assert.equal(writes.at(-1).schedules[0].id, writes[before].schedules[0].id, 'manual retry preserves draft identity')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    })
    await page.screenshot({ path: resolve(output, `planning-${width}.png`), fullPage: true })
  }
  await check('failed delete preserves schedule and manual retry deletes once', async () => {
    mode = 'failure'
    const remove = page.getByRole('button', { name: 'Supprimer le planning Planning test sans publication' })
    const before = writes.length
    await remove.evaluate(button => { button.click(); button.click() })
    await expect(page.getByTestId('schedule-save-error')).toBeVisible()
    assert.equal(writes.length - before, 1)
    await expect(remove).toBeVisible()
    mode = 'success'
    await remove.click()
    await expect(remove).toHaveCount(0)
  })
  await check('lost save response has bounded wait, no automatic retry and stable draft ID', async () => {
    await page.getByTestId('schedule-add').click()
    await page.getByTestId('schedule-name').fill('Reprise après réponse perdue')
    mode = 'slow'
    const before = writes.length, started = Date.now()
    await page.getByTestId('schedule-save').click()
    await expect(page.getByTestId('schedule-save-error')).toBeVisible({ timeout: 12_000 })
    const timeoutMs = Date.now() - started
    details.push({ name: 'save-timeout', timeoutMs, requests: writes.length - before })
    assert.ok(timeoutMs < 12_000)
    await expect(page.getByTestId('schedule-name')).toHaveValue('Reprise après réponse perdue')
    assert.equal(writes.length - before, 1)
    await page.waitForTimeout(2500) // First request may have completed remotely after the response was lost.
    mode = 'success'
    await page.getByTestId('schedule-save').click()
    await expect(page.getByTestId('schedule-name')).toHaveCount(0)
    assert.equal(writes.at(-1).schedules[0].id, writes[before].schedules[0].id)
    assert.equal(schedules.length, 1)
  })
  mode = 'load-failure'
  await page.goto(base + '/auto/schedules')
  await check('schedule load failure cannot become empty or allow overwriting existing schedules', async () => {
    await expect(page.getByTestId('schedule-load-error')).toBeVisible()
    await expect(page.getByTestId('schedule-add')).toHaveCount(0)
    mode = 'success'
    await page.getByTestId('schedule-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByText('Reprise après réponse perdue', { exact: true })).toBeVisible()
  })
  mode = 'load-invalid'
  await page.goto(base + '/auto/schedules')
  await check('malformed successful load cannot become an empty schedule', async () => {
    await expect(page.getByTestId('schedule-load-error')).toBeVisible()
    await expect(page.getByTestId('schedule-add')).toHaveCount(0)
  })
}
