import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

const sleep = ms => new Promise(done => setTimeout(done, ms))
const jobId = '22222222-2222-4222-8222-222222222222'
export async function productionChecks({ page, context, base, fixture, width, check, details, visual }) {
  const state = { mode: 'inline', cancel: 'true', status: 'processing', creates: [], cancels: [], reads: 0 }
  const key = `sutra:production-intent:v1:${fixture.user.id}`
  const result = { narration: 'Simulation locale de script', scenes: [{ narration: 'Fixture', visual_prompt: 'Fixture' }] }
  await context.unroute('**/api/production')
  await context.unroute('**/api/production?*')
  await context.unroute('**/api/video/status/*')
  await context.route('**/api/production?*', route => route.fulfill({ status: 404, json: { error: 'Tache introuvable' } }))
  await context.route('**/api/production', async route => {
    const body = route.request().postDataJSON()
    if (body.step === 'cancel') {
      state.cancels.push(body)
      const mode = state.cancel
      await sleep(mode === 'hang' ? 12000 : 300)
      if (mode === 'lost') return route.abort('failed')
      if (mode === 'fail') return route.fulfill({ status: 503, json: { error: 'private-fixture-detail' } })
      return route.fulfill({ json: { data: { cancelled: mode === 'string' ? 'true' : mode === 'true' } } }).catch(() => {})
    }
    state.creates.push(body)
    const mode = state.mode
    if (mode === 'hang') { await sleep(32000); return route.abort().catch(() => {}) }
    if (mode === 'lost') return route.abort('failed')
    if (mode === 'refused') return route.fulfill({ status: 503, json: { error: 'GPU indisponible', code: 'SALAD_UNAVAILABLE' } })
    if (mode === 'quota') return route.fulfill({ status: 403, json: { error: 'SUTRA_QUOTA_EXHAUSTED' } })
    if (mode === 'queued') return route.fulfill({ status: 202, json: { jobId, status: 'queued' } })
    await sleep(mode === 'late' ? 1800 : 300)
    return route.fulfill({ json: { data: body.step === 'all' ? { script: result } : result } }).catch(() => {})
  })
  await context.route('**/api/video/status/*', route => {
    state.reads++
    assert.equal(new URL(route.request().url()).pathname, `/api/video/status/${jobId}`)
    return route.fulfill({ json: { jobId, status: state.status, ...(state.status === 'done' ? { data: result } : {}) } })
  })
  const panel = page.getByTestId('production-request-status')
  const cancel = page.getByTestId('production-cancel'), resume = page.getByTestId('production-resume')
  const receipt = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key)
  async function start(mode, all = false, beforeSubmit = async () => {}) {
    state.mode = mode; state.cancel = 'true'; state.status = 'processing'
    await page.goto(base + '/production')
    await expect(page.getByTestId('production-idea')).toBeEnabled({ timeout: 15000 })
    await page.getByTestId('production-idea').fill('Fixture : volcan sous-marin')
    if (!all) await page.getByRole('button', { name: /^2\. Script/ }).click()
    const button = page.getByTestId(all ? 'generate-all' : 'generate-script')
    await expect(button).toBeEnabled()
    await beforeSubmit()
    await button.evaluate(button => { button.click(); button.click() })
  }
  await check(`${width}: production double submission has one UUID and a successful step result`, async () => {
    const count = state.creates.length; await start('inline')
    await expect(panel).toContainText('Tâche terminée.')
    assert.equal(state.creates.length, count + 1)
    assert.match(state.creates.at(-1).requestId, /^[0-9a-f-]{36}$/)
    assert.equal(await receipt(), null)
    await expect(page.getByRole('button', { name: /^2\. Script — terminé/ })).toBeVisible()
  })
  await check(`${width}: cancel queued task once using original requestId and target; strict server ACK`, async () => {
    await start('queued')
    await expect(panel).toContainText('file d’attente')
    const saved = await receipt(), count = state.cancels.length
    assert.equal(saved.jobId, jobId)
    await expect(page.getByTestId('generate-script')).toBeDisabled()
    await cancel.focus(); await expect(cancel).toBeFocused()
    const began = performance.now()
    await cancel.evaluate(button => { button.click(); button.click() })
    await expect(cancel).toBeDisabled()
    await expect(panel).toContainText('Annulation confirmée par le serveur.')
    details.push({ width, measure: 'cancellation_ack_ms_300ms_fixture', value: Math.round(performance.now() - began) })
    assert.equal(state.cancels.length, count + 1)
    assert.deepEqual(state.cancels.at(-1), { step: 'cancel', targetStep: 'script', requestId: saved.requestId, idea: 'Fixture : volcan sous-marin' })
    assert.equal(await receipt(), null)
    await visual(`production-cancelled-${width}`, '[data-testid="production-request-status"]')
  })
  await check(`${width}: false and malformed cancellation do not clear the receipt; reload retains intent`, async () => {
    await start('queued'); await expect(panel).toContainText('file d’attente')
    state.cancel = 'false'; await cancel.click(); await expect(panel).toContainText('Annulation non confirmée.')
    assert.equal((await receipt()).cancelRequested, true)
    const creates = state.creates.length, id = (await receipt()).requestId
    await page.reload(); await expect(panel).toContainText('Annulation non confirmée.')
    assert.equal(state.creates.length, creates)
    assert.equal((await receipt()).requestId, id)
    state.cancel = 'string'; await cancel.click(); await expect(cancel).toBeEnabled()
    await expect(panel).toContainText('Annulation non confirmée.')
    await visual(`production-uncertain-${width}`, '[data-testid="production-request-status"]')
    state.cancel = 'true'; await cancel.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
    assert.ok(state.cancels.slice(-3).every(body => body.requestId === id))
  })
  await check(`${width}: lost cancel acknowledgement is recoverable with identical cancellation`, async () => {
    await start('queued'); await expect(panel).toContainText('file d’attente')
    state.cancel = 'lost'; await cancel.click(); await expect(panel).toContainText('Annulation non confirmée.')
    const id = (await receipt()).requestId
    state.cancel = 'true'; await cancel.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
    assert.ok(state.cancels.slice(-2).every(body => body.requestId === id))
  })
  await check(`${width}: GET reconciles completion racing with a refused cancellation without POST replay`, async () => {
    await start('queued'); await expect(panel).toContainText('file d’attente')
    state.cancel = 'false'; await cancel.click(); await expect(panel).toContainText('Annulation non confirmée.')
    state.status = 'done'; const count = state.creates.length
    await resume.click(); await expect(panel).toContainText('Tâche terminée.')
    assert.equal(state.creates.length, count); assert.equal(await receipt(), null)
  })
  await check(`${width}: lost submission ACK resumes immutable request after reload, no new identity`, async () => {
    await start('lost'); await expect(panel).toContainText('État non confirmé.')
    const saved = await receipt(), original = state.creates.at(-1)
    assert.equal(saved.jobId, undefined)
    await page.reload(); await expect(panel).toContainText('Demande retrouvée.')
    await page.getByRole('button', { name: /^1\. Idee/ }).click()
    await expect(page.getByTestId('production-idea')).toHaveValue(original.idea)
    await expect(page.getByTestId('production-idea')).toBeDisabled()
    state.mode = 'inline'
    await resume.evaluate(button => { button.click(); button.click() })
    await expect(panel).toContainText('Tâche terminée.')
    assert.deepEqual(state.creates.at(-1), original)
    assert.equal(state.creates.at(-1).requestId, saved.requestId)
  })
  await check(`${width}: cancelled request without jobId can reconcile absence but never replay generation`, async () => {
    await start('lost'); await expect(panel).toContainText('État non confirmé.')
    state.cancel = 'fail'; await cancel.click(); await expect(panel).toContainText('Annulation non confirmée.')
    await expect(resume).toBeEnabled()
    await expect(page.getByRole('main')).not.toContainText('private-fixture-detail')
    const count = state.creates.length
    await page.reload(); await expect(panel).toContainText('Annulation non confirmée.')
    await resume.click(); await expect(panel).toContainText('État non confirmé.')
    await expect(resume).toBeEnabled(); assert.equal(state.creates.length, count)
    state.cancel = 'true'; await cancel.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
  })
  await check(`${width}: late inline success never overwrites confirmed cancellation`, async () => {
    await start('late'); await expect(cancel).toBeEnabled()
    await cancel.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
    await sleep(2000)
    await expect(panel).toContainText('Annulation confirmée par le serveur.')
    await expect(panel).not.toContainText('Tâche terminée.')
  })
  await check(`${width}: acknowledged task resumes with GET after reload and handles server reconciliation`, async () => {
    await start('queued'); await expect(panel).toContainText('file d’attente')
    const count = state.creates.length
    await page.reload(); await expect(panel).toContainText('Demande retrouvée.')
    state.status = 'reconciliation_required'; await resume.click(); await expect(panel).toContainText('État non confirmé.')
    assert.equal(state.creates.length, count)
    state.status = 'cancelled'; await resume.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
    assert.equal(await receipt(), null)
  })
  await check(`${width}: provider unavailable and credits absent release only rejected pre-submission intent`, async () => {
    await start('refused', true); await expect(panel).toContainText('Demande refusée avant exécution.')
    await expect(page.getByRole('main')).toContainText('GPU distant indisponible.')
    assert.equal(await receipt(), null)
    await start('quota'); await expect(panel).toContainText('Demande refusée avant exécution.')
    await expect(page.getByRole('main')).toContainText('Crédits ou quota insuffisants.')
    assert.equal(await receipt(), null)
  })
  if (width === 375) {
    await check('375: submission timeout releases loader but retains immutable intent for recovery', async () => {
      const time = performance.now(); await start('hang')
      await expect(panel).toContainText('État non confirmé.', { timeout: 35000 })
      details.push({ width, measure: 'submission_timeout_ms', value: Math.round(performance.now() - time) })
      assert.ok((await receipt()).requestId); await expect(resume).toBeEnabled()
      state.mode = 'inline'; await resume.click(); await expect(panel).toContainText('Tâche terminée.')
    })
    await check('375: cancellation timeout never claims success and retry keeps same identity', async () => {
      await start('queued'); await expect(panel).toContainText('file d’attente')
      state.cancel = 'hang'; const time = performance.now(); await cancel.click()
      await expect(panel).toContainText('Annulation non confirmée.', { timeout: 15000 })
      details.push({ width, measure: 'cancellation_timeout_ms', value: Math.round(performance.now() - time) })
      const id = (await receipt()).requestId; state.cancel = 'true'
      await cancel.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      assert.ok(state.cancels.slice(-2).every(body => body.requestId === id))
    })
  }
  await check(`${width}: complete pipeline keeps UUID and normal successful navigation`, async () => {
    await start('inline', true); await expect(panel).toContainText('Tâche terminée.')
    assert.equal(state.creates.at(-1).step, 'all')
    await expect(page.getByRole('button', { name: /^7\./ })).toHaveAttribute('aria-current', 'step')
  })
  await check(`${width}: storage write failure prevents submission and exposes an actionable error`, async () => {
    const count = state.creates.length
    try {
      await start('inline', false, () => page.evaluate(key => {
        window.savedSetItem = Storage.prototype.setItem
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Fixture quota', 'QuotaExceededError')
          return window.savedSetItem.call(this, name, value)
        }
      }, key))
      await expect(panel.getByRole('alert')).toContainText('Aucune nouvelle demande envoyée.')
      assert.equal(state.creates.length, count)
      await expect(page.getByTestId('generate-script')).toBeEnabled()
      await visual(`production-storage-error-${width}`, '[data-testid="production-request-status"]')
    } finally { await page.evaluate(() => { if (window.savedSetItem) Storage.prototype.setItem = window.savedSetItem }) }
  })
  await check(`${width}: corrupt receipt blocks generation without deleting recovery evidence`, async () => {
    const count = state.creates.length
    try {
      await page.evaluate(key => sessionStorage.setItem(key, '{invalid fixture'), key)
      await page.reload()
      await expect(panel.getByRole('alert')).toContainText('Reçu local indisponible.')
      await expect(page.getByTestId('generate-all')).toBeDisabled()
      assert.equal(state.creates.length, count)
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), '{invalid fixture')
    } finally { await page.evaluate(key => sessionStorage.removeItem(key), key); await page.reload() }
  })
}
