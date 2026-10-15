import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { productionChecks } from './production-checks.mjs'
import { storageChecks } from './storage-only.mjs'

const jobId = '22222222-2222-4222-8222-222222222222'
const requestId = '11111111-1111-4111-8111-111111111111'

export async function reconcileChecks(args) {
  const { page, context, base, fixture, output, check, details } = args
  const key = `sutra:production-intent:v1:${fixture.user.id}`
  const panel = page.getByTestId('production-request-status')
  const resume = page.getByTestId('production-resume')
  const state = { lookup: 'done', posts: [], reads: [], jobReads: [] }
  const result = { narration: 'Résultat synthétique récupéré', scenes: [] }
  const receipt = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key)
  async function restore(cancelRequested = true) {
    await page.goto(base + '/production')
    await expect(panel).toBeVisible()
    await page.evaluate(({ key, userId, requestId, cancelRequested }) => {
      sessionStorage.setItem(key, JSON.stringify({ version: 1, userId, requestId, step: 'script', cancelRequested,
        body: JSON.stringify({ step: 'script', idea: 'Fixture après réponse perdue', requestId }) }))
    }, { key, userId: fixture.user.id, requestId, cancelRequested })
    await page.reload()
    await expect(resume).toBeEnabled()
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    // All consumers of the changed production hook, without repeating scheduler gates.
    await productionChecks({ ...args, width, visual: async () => {} })
    await context.unroute('**/api/production')
    await context.unroute('**/api/production?*')
    await context.unroute('**/api/video/status/*')
    await context.route('**/api/production', route => {
      state.posts.push(route.request().postDataJSON())
      return route.fulfill({ json: { data: { cancelled: false } } })
    })
    await context.route('**/api/production?*', async route => {
      const request = route.request(), url = new URL(request.url())
      state.reads.push({ method: request.method(), requestId: url.searchParams.get('requestId'), targetStep: url.searchParams.get('targetStep') })
      const mode = state.lookup
      await new Promise(done => setTimeout(done, mode === 'timeout' ? 12000 : 200))
      if (mode === 'lost') return route.abort('failed').catch(() => {})
      if (['400', '401', '404', '503'].includes(mode)) return route.fulfill({ status: Number(mode), json: { error: 'private-fixture-diagnostic' } }).catch(() => {})
      return route.fulfill({ json: { jobId: mode === 'bad-id' ? 'invalid' : jobId, status: mode === 'bad-id' ? 'done' : mode,
        ...(['done', 'bad-id'].includes(mode) ? { data: result } : {}) } }).catch(() => {})
    })
    await context.route('**/api/video/status/*', route => {
      state.jobReads.push(route.request().url())
      return route.fulfill({ json: { jobId, status: 'cancelled' } })
    })
    await check(`${width}: cancelled intent without receipt recovers done by GET, double click sends one read`, async () => {
      state.lookup = 'done'; await restore()
      const reads = state.reads.length, posts = state.posts.length, began = performance.now()
      await resume.focus(); await expect(resume).toBeFocused()
      await resume.evaluate(button => { button.click(); button.click() })
      await expect(resume).toBeDisabled()
      await expect(panel).toContainText('Tâche terminée.')
      details.push({ width, measure: 'lost_receipt_reconcile_ms_200ms_fixture', value: Math.round(performance.now() - began) })
      assert.equal(state.reads.length, reads + 1); assert.equal(state.posts.length, posts)
      assert.deepEqual(state.reads.at(-1), { method: 'GET', requestId, targetStep: 'script' })
      assert.equal(await receipt(), null)
      await expect(page.getByRole('button', { name: /^2\. Script — terminé/ })).toBeVisible()
      await expect(panel.locator('..')).toHaveCSS('opacity', '1')
      await page.screenshot({ path: resolve(output, `reconciled-result-${width}.png`), fullPage: true })
    })
    for (const mode of ['400', '401', '404', '503', 'lost', 'bad-id']) {
      await check(`${width}: lookup ${mode} retains cancelled intent and never submits generation`, async () => {
        state.lookup = mode; await restore()
        const posts = state.posts.length
        await resume.click(); await expect(panel).toContainText('État non confirmé.')
        await expect(resume).toBeEnabled()
        await expect(panel).not.toContainText('Annulation confirmée par le serveur.')
        await expect(panel).not.toContainText('private-fixture-diagnostic')
        assert.equal((await receipt()).cancelRequested, true)
        assert.equal((await receipt()).requestId, requestId)
        assert.equal(state.posts.length, posts)
      })
    }
    await check(`${width}: retry after lookup error restores cancellation status without POST`, async () => {
      state.lookup = 'cancelled'; const posts = state.posts.length
      await resume.click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      assert.equal(await receipt(), null); assert.equal(state.posts.length, posts)
    })
    await check(`${width}: lookup processing persists recovered jobId, polling resumes by job after reload`, async () => {
      state.lookup = 'processing'; await restore()
      const reads = state.reads.length, posts = state.posts.length, jobReads = state.jobReads.length
      await resume.click(); await expect(panel).toContainText('Tâche en cours sur le serveur.')
      assert.equal((await receipt()).jobId, jobId)
      await page.reload(); await expect(resume).toBeEnabled()
      await resume.press('Enter'); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      assert.equal(state.reads.length, reads + 1); assert.equal(state.posts.length, posts)
      assert.equal(state.jobReads.length, jobReads + 1)
    })
    await check(`${width}: lost submission without cancel first recovers result by GET, no duplicate POST`, async () => {
      state.lookup = 'done'; await restore(false)
      const posts = state.posts.length
      await resume.click(); await expect(panel).toContainText('Tâche terminée.')
      assert.equal(state.posts.length, posts); assert.equal(await receipt(), null)
    })
    if (width === 375) await check('375: lookup timeout releases loader; retry GET succeeds without creating a task', async () => {
      state.lookup = 'timeout'; await restore()
      const posts = state.posts.length, began = performance.now()
      await resume.click(); await expect(panel).toContainText('État non confirmé.', { timeout: 15000 })
      details.push({ width, measure: 'lookup_timeout_ms', value: Math.round(performance.now() - began) })
      await expect(resume).toBeEnabled(); assert.equal((await receipt()).cancelRequested, true)
      state.lookup = 'done'; await resume.click(); await expect(panel).toContainText('Tâche terminée.')
      assert.equal(state.posts.length, posts)
    })
  }
  await storageChecks(args)
}
