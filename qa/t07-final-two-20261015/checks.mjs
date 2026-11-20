import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { resolve } from 'node:path'

export async function checks({ page, context, base, output, check, details }) {
  let schedules = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Planning existant', is_active: false, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris', theme_ids: ['theme-fixture'] }]
  let mode = 'ok', writes = [], reads = 0
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'GET') {
      reads++
      return route.fulfill({ json: { config: { schedules } } })
    }
    const body = route.request().postDataJSON(); writes.push(body)
    if (mode === 'lost') {
      schedules = body.schedules
      return route.abort('connectionreset')
    }
    if (mode === 'fail') return route.fulfill({ status: 503, json: { error: 'private_fixture_error' } })
    schedules = body.schedules
    return route.fulfill({ json: { config: { schedules } } })
  })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/auto/schedules')
    await expect(page.getByText('Planning existant', { exact: true })).toBeVisible()
    await check(`${width}: inactive schedule exposes status and per-schedule resume`, async () => {
      await expect(page.getByRole('button', { name: 'Reprendre le planning Planning existant', exact: true })).toBeVisible({ timeout: 1200 })
    })
    await page.getByTestId('schedule-add').click()
    await check(`${width}: configurable IANA timezone`, async () => {
      await expect(page.getByTestId('schedule-timezone')).toBeVisible({ timeout: 1200 })
    })
    await page.getByTestId('schedule-name').fill('Réponse perdue')
    mode = 'lost'
    const before = writes.length
    await page.getByTestId('schedule-save').evaluate(button => { button.click(); button.click() })
    await expect(page.getByTestId('schedule-save-error')).toBeVisible()
    await check(`${width}: double click sends one PATCH`, async () => assert.equal(writes.length - before, 1))
    const readBefore = reads
    mode = 'ok'
    await page.getByTestId('schedule-save').click()
    await expect(page.getByTestId('schedule-name')).toHaveCount(0)
    await check(`${width}: lost acknowledgement reconciles before any replay`, async () => {
      details.push({ name: `lost-ack-${width}`, reads: reads - readBefore, writes: writes.length - before })
      assert.ok(reads > readBefore, 'retry must consult persisted configuration')
      assert.equal(writes.length - before, 1, 'saved intent must not be written twice')
    })
    await page.screenshot({ path: resolve(output, `schedule-${width}.png`), fullPage: true })
    schedules = schedules.filter(s => s.name === 'Planning existant')
  }
}
