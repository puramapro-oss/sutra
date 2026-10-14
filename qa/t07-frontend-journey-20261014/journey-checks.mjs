import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { retryChecks } from './retry-checks.mjs'
import { playerChecks } from './player-checks.mjs'
import { visualChecks } from './visual-checks.mjs'
import { privateDownloadChecks } from './private-download-checks.mjs'
import { expect } from '@playwright/test'

export async function journeyChecks({ page, context, base, fixture, output, check, details }) {
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
  await check('login and explicit consent open empty library', async () => {
    await expect(page.getByTestId('empty-library')).toBeVisible()
    assert.equal(fixture.state.acceptances.length, 4)
  })
  if (process.argv.includes('--private-download')) return privateDownloadChecks({ page, context, base, fixture, output, check, details })
  if (process.argv.includes('--visual')) return visualChecks({ page, context, base, fixture, output, check, details })
  if (process.argv.includes('--retry')) return retryChecks({ page, context, base, fixture, output, check })
  if (process.argv.includes('--player')) {
    const exportCalls = []
    await context.route('**/api/video/export', async route => {
      exportCalls.push(route.request().postDataJSON())
      await new Promise(done => setTimeout(done, 250))
      await route.fulfill({ status: 503, json: { error: 'Export indisponible' } })
    })
    for (const width of [375, 1440]) {
      fixture.state.videos = [{ id: '22222222-2222-4222-8222-222222222222', user_id: fixture.user.id, title: 'Projet test en échec', status: 'failed', video_url: null, format: '9:16', quality: '720p', script_data: null, shotstack_json: null, duration: null, created_at: '2026-10-14T00:00:00Z' }]
      await page.setViewportSize({ width, height: 900 })
      await page.goto(base + '/editor/' + fixture.state.videos[0].id)
      await playerChecks({ page, context, base, fixture, width, output, check, exportCalls })
    }
    return
  }
  const capabilities = { version: 1, client: { mode: 'api', availability: 'unknown', reason: 'PROVIDER_NOT_PROBED' }, personal: { provider: 'salad', allowed: false, available: false, state: 'unavailable', reason: null, operations: [], profiles: [], quotaRemaining: null, cost: { currency: 'USD', actualUsd: null, basis: 'compute-only-excludes-idle-storage-network', estimatedComputeUsd: null } } }
  await context.route('**/api/video/capabilities', route => route.fulfill({ json: capabilities }))
  const createCalls = [], exportCalls = [], productionCalls = []
  await context.route('**/api/create', async route => {
    createCalls.push({ key: route.request().headers()['idempotency-key'], body: route.request().postDataJSON() })
    await new Promise(done => setTimeout(done, 250))
    await route.fulfill({ status: 202, json: { jobId: 'fixture-job' } })
  })
  await context.route('**/api/video/status/*', route => route.fulfill({ json: { status: 'unknown' } }))
  await context.route('**/api/production', async route => {
    productionCalls.push(route.request().postDataJSON())
    await new Promise(done => setTimeout(done, 250))
    await route.fulfill({ status: 503, json: { error: 'SALAD_WORKER_DISABLED' } })
  })
  await context.route('**/api/video/export', async route => {
    exportCalls.push(route.request().postDataJSON())
    await new Promise(done => setTimeout(done, 250))
    await route.fulfill({ status: 503, json: { error: 'Export indisponible' } })
  })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    capabilities.personal.allowed = false; capabilities.personal.state = 'unavailable'
    await page.goto(base + '/create')
    await check(`${width}: API account notice and keyboard generation form`, async () => {
      await expect(page.getByText('Compte en mode API client.', { exact: false })).toBeVisible({ timeout: 20000 })
      const input = page.getByTestId('topic-input')
      await input.focus(); await expect(input).toBeFocused()
      await input.fill('Projet de test sans génération réelle')
      await expect(page.getByTestId('create-button')).toBeEnabled()
    })
    await check(`${width}: queued request, uncertain status, retry preserves intent without duplicate`, async () => {
      const before = createCalls.length
      const submit = page.getByTestId('create-button')
      await submit.evaluate(b => { b.click(); b.click() })
      await expect(page.getByText('Résultat de la génération non confirmé', { exact: true })).toBeVisible({ timeout: 12000 })
      assert.equal(createCalls.length - before, 1)
      await expect(page.getByRole('link', { name: 'Vérifier la bibliothèque' })).toBeVisible()
      await submit.click()
      await expect(page.getByText('Résultat de la génération non confirmé', { exact: true })).toBeVisible({ timeout: 12000 })
      assert.equal(createCalls.length - before, 2)
      assert.ok(createCalls[before].key)
      assert.equal(createCalls[before].key, createCalls[before + 1].key)
      await page.screenshot({ path: resolve(output, `create-error-${width}.png`), fullPage: true })
    })
    capabilities.personal.allowed = true; capabilities.personal.state = 'disabled'
    await page.goto(base + '/production')
    await check(`${width}: remote GPU disabled and production failure remains actionable`, async () => {
      await expect(page.getByText('Worker distant désactivé.', { exact: false })).toBeVisible()
      await page.getByTestId('production-idea').fill('Montage fictif')
      const before = productionCalls.length, submit = page.getByTestId('generate-all')
      await submit.evaluate(b => { b.click(); b.click() })
      await expect(page.getByText('Mode personnel distant indisponible', { exact: true })).toBeVisible()
      await expect(submit).toBeEnabled()
      assert.equal(productionCalls.length - before, 1)
    })
    fixture.state.videoMode = 'error'
    await page.goto(base + '/library')
    await check(`${width}: library failure is not an empty success and retry works`, async () => {
      await expect(page.getByText('Impossible de charger la bibliothèque. Réessaie.')).toBeVisible()
      await expect(page.getByTestId('empty-library')).toHaveCount(0)
      fixture.state.videoMode = 'normal'
      await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
      await expect(page.getByTestId('empty-library')).toBeVisible()
    })
    fixture.state.videos = [{ id: '22222222-2222-4222-8222-222222222222', user_id: fixture.user.id, title: 'Projet test en échec', status: 'failed', video_url: null, format: '9:16', quality: '720p', script_data: null, shotstack_json: null, duration: null, created_at: '2026-10-14T00:00:00Z' }]
    await page.goto(base + '/editor/' + fixture.state.videos[0].id)
    await expect(page.getByTestId('editor-title')).toBeVisible()
    await check(`${width}: failed video never pretends to be generating and player is disabled`, async () => {
      await expect(page.getByText('La video est en cours de generation')).toHaveCount(0)
      await expect(page.getByTestId('editor-play-pause')).toBeDisabled()
      await expect(page.getByTestId('editor-seek')).toBeDisabled()
    })
    await check(`${width}: missing sources refuse export with visible reason and no request`, async () => {
      const before = exportCalls.length
      await page.getByTestId('editor-export').evaluate(b => { b.click(); b.click() })
      await expect(page.getByText('Les sources de ce montage sont indisponibles. Aucun export ne peut etre lance.', { exact: true }).first()).toBeVisible()
      await expect(page.getByTestId('editor-export')).toBeEnabled()
      assert.equal(exportCalls.length - before, 0)
    })
    await page.screenshot({ path: resolve(output, `editor-${width}.png`), fullPage: true })
    await playerChecks({ page, context, base, fixture, width, output, check, exportCalls })
    await check(`${width}: editor no horizontal overflow`, async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true))
    await context.route('**/api/social/connect', route => route.fulfill({ status: 503, json: { error: 'UNTRUSTED_PROVIDER_DIAGNOSTIC' } }))
    await page.goto(base + '/settings/social')
    await check(`${width}: social account absent; simulated consent unavailable does not navigate`, async () => {
      const button = page.getByRole('button', { name: 'Se connecter', exact: true }).first()
      await button.click()
      await expect(page.getByText('Profil social non attribué. Contactez votre administrateur.', { exact: true })).toBeVisible()
      await expect(button).toBeEnabled()
      assert.equal(new URL(page.url()).pathname, '/settings/social')
      await expect(page.getByText('UNTRUSTED_PROVIDER_DIAGNOSTIC', { exact: true })).toHaveCount(0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await page.screenshot({ path: resolve(output, `social-${width}.png`), fullPage: true })
    })
    fixture.state.videos = []
  }
  details.push({ createCalls, productionCalls, exportCalls })
}
