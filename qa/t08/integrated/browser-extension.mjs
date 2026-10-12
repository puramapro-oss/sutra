import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { runT07Flows } from '../../../scripts/ui-isolated/t07-flows.mjs'

// Reuse the canonical local auth/DB/browser harness. Only its test flow export
// is wrapped; no product module is substituted or edited by this extension.
const results = [], output = resolve('test-results/t08/browser-extra.json')
mkdirSync(resolve('test-results/t08'), { recursive: true })
async function check(name, run) {
  const start = Date.now()
  try { await run(); results.push({ name, status: 'PASS', durationMs: Date.now() - start }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error), durationMs: Date.now() - start }); process.exitCode = 1 }
  writeFileSync(output, JSON.stringify(results, null, 2) + '\n')
  process.stdout.write(`${results.at(-1).status} ${name}\n`)
}
mock.module(new URL('../../../scripts/ui-isolated/t07-flows.mjs', import.meta.url).href, { namedExports: {
  runT07Flows: async ctx => {
    await runT07Flows(ctx)
    const { page, base, fixture, user, screenshot, auditAccessibility } = ctx
    const id = '88888888-8888-4888-8888-888888888888'
    const payload = '<img src=x onerror="window.__t08Xss=1">'
    await page.addInitScript(() => { window.__t08Xss = 0 })
    fixture.videos = [{ id, user_id: user.id, title: payload, created_at: '2026-10-12T12:00:00Z', status: 'ready', quality: '1080p', format: '16:9', duration: 5, video_url: null,
      script_data: { narration: payload, scenes: [{ visual_prompt: payload, duration_seconds: 5, use_stock: false }] },
      shotstack_json: { sutraEditorClips: [{ url: 'https://media.invalid/t08.mp4', type: 'ia', kind: 'video', duration: 5 }] } }]
    await page.setViewportSize({ width: 1280, height: 900 })
    await check('T08 browser: stored markup remains inert in library and editor', async () => {
      await page.goto(base + '/library', { waitUntil: 'networkidle' })
      await expect(page.getByTestId(`video-card-${id}`)).toContainText(payload)
      assert.equal(await page.evaluate(() => window.__t08Xss), 0)
      await page.goto(base + '/editor/' + id, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('editor-title')).toHaveText(payload)
      await expect(page.locator('main img[onerror]')).toHaveCount(0)
      assert.equal(await page.evaluate(() => window.__t08Xss), 0)
      await screenshot(page, 't08-xss-inert')
    })
    let calls = [], mode = 'failure'
    await page.route('**/api/video/export', async route => {
      calls.push(route.request().postDataJSON())
      await new Promise(done => setTimeout(done, 250))
      if (mode === 'abort') return route.abort('timedout')
      return route.fulfill({ status: mode === 'failure' ? 503 : 202, contentType: 'application/json', body: JSON.stringify(mode === 'failure' ? { error: `T08 export indisponible ${payload}` } : { jobId: 't08-export', status: 'queued' }) })
    })
    await check('T08 browser: failed export announces inert error and restores retry', async () => {
      await page.getByTestId('editor-export').click()
      await expect(page.getByText(`T08 export indisponible ${payload}`, { exact: true })).toBeVisible()
      await expect(page.getByTestId('editor-export')).toBeEnabled()
      assert.equal(calls.length, 1); assert.equal(await page.evaluate(() => window.__t08Xss), 0)
    })
    await check('T08 browser: export retry preserves source clips and marks accepted work pending', async () => {
      mode = 'success'; await page.getByTestId('editor-export').click()
      await expect(page.getByText('Export en cours.', { exact: false })).toBeVisible()
      await expect(page.getByTestId('editor-export')).toBeEnabled()
      assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0])
      assert.equal(calls[1].scenes[0].url, 'https://media.invalid/t08.mp4')
    })
    await check('T08 browser: transport timeout restores export controls', async () => {
      mode = 'abort'; const before = calls.length
      await page.getByTestId('editor-export').click()
      await expect.poll(() => calls.length).toBe(before + 1)
      await expect(page.getByTestId('editor-export')).toBeEnabled()
    })
    await check('T08 browser: same-frame duplicate export dispatches one request', async () => {
      mode = 'success'; const before = calls.length
      await page.getByTestId('editor-export').evaluate(button => { button.click(); button.click() })
      await expect.poll(() => calls.length).toBeGreaterThan(before)
      await expect(page.getByTestId('editor-export')).toBeEnabled()
      assert.equal(calls.length - before, 1, 'duplicate export submissions')
    })
    await check('T08 browser: editor error/retry state remains accessible at 320px', async () => {
      await page.setViewportSize({ width: 320, height: 900 })
      await auditAccessibility(page, 't08-editor-retry-320')
      await screenshot(page, 't08-editor-retry-320')
    })
    await page.unroute('**/api/video/export'); fixture.videos = []
    await page.goto(base + '/settings', { waitUntil: 'networkidle' })
  },
} })
