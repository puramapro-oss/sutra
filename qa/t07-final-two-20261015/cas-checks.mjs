import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function casChecks({ page, context, base, check, details }) {
  const original = { id: '11111111-1111-4111-8111-111111111111', name: 'Planning CAS', is_active: true, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris', theme_ids: ['kept'], extension: { version: 2 } }
  const defaults = { default_style: 'cinematic', default_duration: 30, default_aspect_ratio: '9:16', default_music_genre: 'ambient', default_voice_enabled: false, default_voice_id: null, default_language: 'fr', publish_platforms: [], auto_publish: false, require_approval_before_publish: true, preferred_model: 'ltx-2-3-pro', quality_level: 'standard', user_id: 'fixture-owner', is_active: false }
  let schedules, mode, writes, reads
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'GET') {
      reads++
      if (mode === 'get-failed') return route.fulfill({ status: 503, json: { error: 'PRIVATE_FIXTURE' } })
      return route.fulfill({ json: { config: { ...defaults, schedules } } })
    }
    const payload = route.request().postDataJSON(); writes.push(payload)
    if (!('schedules' in payload)) return route.fulfill({ json: { config: { ...defaults, ...payload, schedules } } })
    if (!('expectedSchedules' in payload)) return route.fulfill({ status: 428, json: { error: 'precondition required' } })
    if (mode === 'conflict') schedules[0].time = '12:00'
    if (mode === 'applied-409') schedules = payload.schedules
    if (mode === 'uncertain-409') { mode = 'get-failed'; return route.fulfill({ status: 409, json: { error: 'conflict' } }) }
    if (JSON.stringify(payload.expectedSchedules) !== JSON.stringify(schedules)) return route.fulfill({ status: 409, json: { error: 'conflict' } })
    schedules = payload.schedules
    if (mode === 'lost') return route.abort('connectionreset')
    return route.fulfill({ json: { config: { ...defaults, schedules } } })
  })
  const visit = async () => {
    schedules = [structuredClone(original)]; mode = 'normal'; writes = []; reads = 0
    await page.goto(base + '/auto/schedules')
    await expect(page.getByTestId('schedule-add')).toBeVisible()
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: CAS snapshot is exact, double click once and lost ACK reread only`, async () => {
      await visit(); mode = 'lost'
      await page.getByRole('button', { name: 'Mettre en pause le planning Planning CAS', exact: true }).evaluate(b => { b.click(); b.click() })
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      assert.equal(writes.length, 1); assert.deepEqual(writes[0].expectedSchedules, [original])
      assert.equal(schedules[0].is_active, false); assert.deepEqual(schedules[0].extension, original.extension)
      const before = reads; mode = 'normal'
      await page.getByRole('button', { name: 'Vérifier et réessayer', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Reprendre le planning Planning CAS', exact: true })).toBeEnabled()
      assert.equal(writes.length, 1); assert.ok(reads > before)
    })
    await check(`${width}: 409 rereads and reports target conflict without overwrite`, async () => {
      await visit(); mode = 'conflict'; const before = reads
      await page.getByRole('button', { name: 'Mettre en pause le planning Planning CAS', exact: true }).click()
      await expect(page.getByText(/Ce planning a été modifié ailleurs/)).toBeVisible({ timeout: 2500 })
      assert.equal(writes.length, 1); assert.equal(schedules[0].time, '12:00'); assert.ok(reads >= before + 2)
      await expect(page.getByTestId('schedule-add')).toBeDisabled()
    })
    await check(`${width}: 409 already applied reconciles from GET without replay`, async () => {
      await visit(); mode = 'applied-409'; const before = reads
      await page.getByRole('button', { name: 'Mettre en pause le planning Planning CAS', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Reprendre le planning Planning CAS', exact: true })).toBeEnabled({ timeout: 2500 })
      assert.equal(writes.length, 1); assert.ok(reads >= before + 2)
      await expect(page.getByTestId('schedule-save-error')).toHaveCount(0)
    })
    await check(`${width}: failed reconciliation after 409 stays unconfirmed`, async () => {
      await visit(); mode = 'uncertain-409'; const before = reads
      await page.getByRole('button', { name: 'Mettre en pause le planning Planning CAS', exact: true }).click()
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      await expect(page.getByTestId('schedule-add')).toBeDisabled()
      assert.equal(writes.length, 1); await expect.poll(() => reads, { timeout: 2500 }).toBeGreaterThanOrEqual(before + 2)
      await expect(page.getByText('PRIVATE_FIXTURE', { exact: true })).toHaveCount(0)
    })
    await check(`${width}: general settings only sends its nine editable fields`, async () => {
      schedules = [structuredClone(original)]; mode = 'normal'; writes = []
      await page.goto(base + '/auto/settings')
      await page.getByTestId('style-anime').click()
      await page.getByTestId('settings-save').click()
      await expect.poll(() => writes.length).toBe(1)
      assert.deepEqual(Object.keys(writes[0]).sort(), ['default_style', 'default_duration', 'default_aspect_ratio', 'default_voice_enabled', 'publish_platforms', 'auto_publish', 'require_approval_before_publish', 'preferred_model', 'quality_level'].sort())
      assert.equal(writes[0].default_style, 'anime'); assert.deepEqual(schedules, [original])
      await expect(page.getByText('Reglages sauvegardes', { exact: true })).toBeVisible()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    })
    details.push({ name: `cas-viewport-${width}`, contract: 'T01 2026-10-15T20:26:24Z; fixture only' })
  }
}
