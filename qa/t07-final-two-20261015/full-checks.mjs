import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)

export async function fullChecks({ page, context, base, output, check, details }) {
  const initial = { id: '11111111-1111-4111-8111-111111111111', name: 'Planning existant', is_active: true, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris', theme_ids: ['fixture-theme'] }
  let schedules = [], writes = [], mode = 'ok', reads = 0
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'GET') {
      reads++
      if (mode === 'get-503') return route.fulfill({ status: 503, json: { error: 'PRIVATE_FIXTURE' } })
      if (mode === 'get-slow') await new Promise(done => setTimeout(done, 12_000))
      if (mode === 'invalid') return route.fulfill({ json: { config: { schedules: [null] } } })
      return route.fulfill({ json: { config: { schedules } } })
    }
    const payload = route.request().postDataJSON(); writes.push(payload)
    await new Promise(done => setTimeout(done, 120))
    if (mode === 'fail') return route.fulfill({ status: 503, json: { error: 'PRIVATE_FIXTURE' } })
    if (mode === 'wrong-ack') return route.fulfill({ json: { config: { schedules } } })
    schedules = payload.schedules
    if (mode === 'lost') return route.abort('connectionreset')
    return route.fulfill({ json: { config: { schedules } } })
  })
  const visit = async () => { await page.goto(base + '/auto/schedules'); await expect(page.getByTestId('schedule-add')).toBeVisible() }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 }); schedules = [structuredClone(initial)]; mode = 'ok'
    await visit()
    await check(`${width}: edit IANA/frequency/time preserves identity and theme associations`, async () => {
      await page.getByRole('button', { name: 'Modifier le planning Planning existant', exact: true }).click()
      await expect(page.getByTestId('schedule-name')).toBeFocused()
      await page.getByTestId('schedule-timezone').fill('America/New_York')
      await page.getByTestId('schedule-time').fill('02:30')
      await page.getByTestId('schedule-freq-biweekly').click()
      const before = writes.length, started = performance.now()
      await page.getByTestId('schedule-save').evaluate(button => { button.click(); button.click() })
      await expect(page.getByTestId('schedule-name')).toHaveCount(0)
      details.push({ name: `edit-${width}`, interactionMs: performance.now() - started, writes: writes.length - before, fixtureDelayMs: 120 })
      assert.equal(writes.length - before, 1)
      assert.equal(schedules[0].id, initial.id); assert.deepEqual(schedules[0].theme_ids, initial.theme_ids)
      assert.equal(schedules[0].frequency, 'biweekly'); assert.equal(schedules[0].timezone, 'America/New_York')
      await expect(page.getByText(/02:30 \(America\/New_York\)/)).toBeVisible()
    })
    await check(`${width}: pause error is visible and retry changes only intended schedule`, async () => {
      mode = 'fail'; const before = writes.length
      await page.getByRole('button', { name: 'Mettre en pause le planning Planning existant', exact: true }).evaluate(button => { button.click(); button.click() })
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      assert.equal(writes.length - before, 1); assert.equal(schedules[0].is_active, true)
      await expect(page.getByRole('button', { name: 'Mettre en pause le planning Planning existant', exact: true })).toBeDisabled()
      await expect(page.getByText('PRIVATE_FIXTURE', { exact: true })).toHaveCount(0)
      schedules.push({ ...initial, id: '22222222-2222-4222-8222-222222222222', name: 'Ajouté ailleurs' })
      mode = 'ok'
      await page.getByRole('button', { name: 'Vérifier et réessayer', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Reprendre le planning Planning existant', exact: true })).toBeEnabled()
      assert.equal(schedules[0].is_active, false); assert.equal(schedules.length, 2)
    })
    await check(`${width}: resume lost acknowledgement reconciles once, reload preserves state`, async () => {
      mode = 'lost'; const before = writes.length
      await page.getByRole('button', { name: 'Reprendre le planning Planning existant', exact: true }).click()
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      const readBefore = reads
      mode = 'ok'
      await page.getByRole('button', { name: 'Vérifier et réessayer', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Mettre en pause le planning Planning existant', exact: true })).toBeEnabled()
      assert.equal(writes.length - before, 1); assert.ok(reads > readBefore)
      await visit()
      await expect(page.getByRole('button', { name: 'Mettre en pause le planning Planning existant', exact: true })).toBeEnabled()
      assert.equal(writes.length - before, 1)
    })
    await check(`${width}: keyboard, labels, overflow and relevant axe rules`, async () => {
      await page.getByTestId('schedule-add').focus(); await page.keyboard.press('Enter')
      await expect(page.getByTestId('schedule-name')).toBeFocused()
      await expect(page.getByTestId('schedule-timezone')).toHaveAccessibleName('Fuseau horaire IANA')
      await expect(page.getByRole('button', { name: 'Lundi', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.getByTestId('schedule-name').fill('Validation locale')
      await page.waitForTimeout(700) // Existing page/card opacity transitions must settle before contrast measurement.
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const audit = await page.evaluate(async () => {
        const result = await window.axe.run(document.querySelector('main'), { runOnly: ['label', 'button-name', 'color-contrast', 'aria-allowed-attr'] })
        return { violations: result.violations, incomplete: result.incomplete }
      })
      details.push({ name: `axe-${width}`, ...audit })
      assert.equal(audit.violations.length, 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await page.screenshot({ path: resolve(output, `form-${width}.png`), fullPage: true })
    })
    await check(`${width}: invalid zone and missing days block requests with readable error`, async () => {
      const before = writes.length
      await page.getByTestId('schedule-timezone').fill('Mars/Test')
      await page.getByTestId('schedule-save').click()
      await expect(page.getByRole('alert').filter({ hasText: 'fuseau IANA valide' })).toBeVisible()
      await page.getByTestId('schedule-timezone').fill('Asia/Kolkata')
      await page.getByRole('button', { name: 'Lundi', exact: true }).click()
      await page.getByTestId('schedule-save').click()
      await expect(page.getByRole('alert').filter({ hasText: 'au moins un jour' })).toBeVisible()
      assert.equal(writes.length, before)
      await page.getByTestId('schedule-freq-daily').click()
      await page.getByTestId('schedule-save').click()
      await expect(page.getByTestId('schedule-name')).toHaveCount(0)
      assert.equal(writes.length - before, 1)
      assert.equal(schedules.at(-1).timezone, 'Asia/Kolkata'); assert.deepEqual(schedules.at(-1).days, [])
    })
    await check(`${width}: monthly edit retains explicit cadence and deletion lost ACK survives reload`, async () => {
      await page.getByRole('button', { name: 'Modifier le planning Validation locale', exact: true }).click()
      await page.getByTestId('schedule-freq-monthly').click()
      await page.getByRole('button', { name: 'Vendredi', exact: true }).click()
      await page.getByTestId('schedule-save').click()
      await expect(page.getByTestId('schedule-name')).toHaveCount(0)
      assert.equal(schedules.at(-1).frequency, 'monthly'); assert.deepEqual(schedules.at(-1).days, ['FR'])
      mode = 'lost'; const before = writes.length
      await page.getByRole('button', { name: 'Supprimer le planning Validation locale', exact: true }).click()
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      mode = 'ok'; await visit()
      await expect(page.getByText('Validation locale', { exact: true })).toHaveCount(0)
      assert.equal(writes.length - before, 1)
    })
    await page.screenshot({ path: resolve(output, `list-${width}.png`), fullPage: true })
  }
  await check('concurrent modification to same schedule refuses overwrite', async () => {
    schedules = [structuredClone(initial)]; mode = 'ok'; await visit()
    await page.getByRole('button', { name: 'Modifier le planning Planning existant', exact: true }).click()
    await page.getByTestId('schedule-time').fill('11:00'); schedules[0].time = '12:00'
    const before = writes.length
    await page.getByTestId('schedule-save').click()
    await expect(page.getByText(/Ce planning a été modifié ailleurs/)).toBeVisible()
    assert.equal(writes.length, before); assert.equal(schedules[0].time, '12:00')
  })
  await check('successful HTTP with wrong configuration never reports save success', async () => {
    mode = 'ok'; await visit(); await page.getByTestId('schedule-add').click()
    await page.getByTestId('schedule-name').fill('ACK incohérent'); mode = 'wrong-ack'
    await page.getByTestId('schedule-save').click()
    await expect(page.getByTestId('schedule-save-error')).toBeVisible()
    await expect(page.getByTestId('schedule-name')).toHaveValue('ACK incohérent')
    await expect(page.getByTestId('schedule-name')).toBeDisabled()
  })
  await check('failed or malformed initial load cannot expose destructive controls', async () => {
    for (const failure of ['get-503', 'invalid']) {
      mode = failure; await page.goto(base + '/auto/schedules')
      await expect(page.getByTestId('schedule-load-error')).toBeVisible()
      await expect(page.getByTestId('schedule-add')).toHaveCount(0)
    }
    mode = 'ok'; await page.getByTestId('schedule-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByTestId('schedule-add')).toBeVisible()
  })
  await check('slow GET has bounded loader and safe explicit recovery', async () => {
    mode = 'get-slow'; const started = performance.now(); await page.goto(base + '/auto/schedules')
    await expect(page.getByTestId('schedule-load-error')).toBeVisible({ timeout: 12_000 })
    details.push({ name: 'load-timeout', ms: performance.now() - started })
    assert.ok(performance.now() - started < 12_000)
    mode = 'ok'; await page.getByTestId('schedule-load-error').getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByTestId('schedule-add')).toBeVisible()
  })
}

export async function accessibilityChecks({ page, context, base, output, check, details }) {
  await context.route('**/api/auto/config', route => route.fulfill({ json: { config: { schedules: [] } } }))
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/auto/schedules')
    await page.getByTestId('schedule-add').focus(); await page.keyboard.press('Enter')
    await check(`${width}: settled contrast, keyboard, labels and overflow`, async () => {
      await expect(page.getByTestId('schedule-name')).toBeFocused()
      await expect(page.getByTestId('schedule-timezone')).toHaveAccessibleName('Fuseau horaire IANA')
      await page.getByTestId('schedule-name').fill('Contrôle accessibilité')
      const ancestors = () => page.getByTestId('schedule-name').evaluate(input => {
        const result = []
        for (let node = input; node; node = node.parentElement) result.push({ tag: node.tagName, opacity: getComputedStyle(node).opacity })
        return result
      })
      const before = await ancestors()
      await page.waitForTimeout(700)
      const after = await ancestors()
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const audit = await page.evaluate(async () => {
        const result = await window.axe.run(document.querySelector('main'), { runOnly: ['label', 'button-name', 'color-contrast', 'aria-allowed-attr'] })
        return { violations: result.violations, incomplete: result.incomplete }
      })
      details.push({ name: `settled-axe-${width}`, before, after, ...audit })
      assert.equal(audit.violations.length, 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await page.screenshot({ path: resolve(output, `form-${width}.png`), fullPage: true })
    })
  }
}
