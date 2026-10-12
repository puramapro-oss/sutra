import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

// Real browser interactions; all generation/search/export responses are local fixtures.
export async function runT07Reprise({ page, base, check, auditAccessibility, screenshot, fixture, user }) {
  page.setDefaultTimeout(15_000)
  const failures = []
  const verify = async (name, run) => {
    try { await check(name, run) } catch (error) { failures.push({ name, error: String(error) }); process.stderr.write(`FAIL ${name}: ${error}\n`) }
  }
  await page.setViewportSize({ width: 320, height: 812 })
  await verify('production completion preserves a newer navigation choice', async () => {
    let finish, submissions = 0
    await page.route('**/api/production', async route => {
      submissions++
      await new Promise(resolve => { finish = resolve })
      await route.fulfill({ json: { data: { title: 'Script termine' } } })
    })
    await page.goto(base + '/production', { waitUntil: 'networkidle' })
    await page.getByTestId('production-idea').fill('Une montagne')
    const steps = page.getByRole('navigation', { name: 'Étapes de production' })
    await steps.getByRole('button').nth(1).click()
    await page.getByTestId('generate-script').click()
    await expect.poll(() => submissions).toBe(1)
    await steps.getByRole('button').nth(6).click()
    finish()
    await expect(steps.getByRole('button').nth(1)).toHaveAccessibleName(/terminé/)
    await expect(steps.locator('[aria-current=step]')).toHaveAccessibleName(/^7\./)
    await auditAccessibility(page, 'reprise-production-navigation-320')
    await page.unroute('**/api/production')
  })

  const keywordBodies = [], searchBodies = []
  let stockMode = 'empty', releaseOld, oldArrived = false, releaseKeywords
  const result = id => ({ id, source: 'pexels', type: 'photo', url: `https://media.invalid/${id}.jpg`, thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40"><rect width="60" height="40" fill="purple"/></svg>', width: 1920, height: 1080, quality: '1080p', author: id })
  await page.route('**/api/stock/keywords', async route => {
    const body = route.request().postDataJSON(); keywordBodies.push(body)
    if (body.scenes[0] === 'foret') await new Promise(resolve => { releaseKeywords = resolve })
    return route.fulfill({ json: { keywords: body.scenes.map(scene => [scene]) } })
  })
  await page.route('**/api/stock/search', async route => {
    const { query } = route.request().postDataJSON(); searchBodies.push(query)
    if (query === 'ancien') { oldArrived = true; await new Promise(resolve => { releaseOld = resolve }) }
    if (stockMode === 'error') return route.fulfill({ status: 503, json: { error: 'Recherche indisponible' } })
    return route.fulfill({ json: { results: stockMode === 'empty' ? [] : [result(query)] } })
  })
  await page.goto(base + '/create', { waitUntil: 'networkidle' })
  await page.getByTestId('mode-manual').click()
  await expect(page.getByRole('navigation', { name: 'Étapes de création manuelle' })).toBeVisible()
  await page.getByTestId('media-mode-stock').click()
  const next = page.getByRole('button', { name: 'Suivant', exact: true })
  await next.click(); await page.getByTestId('topic-input').fill('Montagnes'); await next.click()
  await page.getByTestId('script-input').fill('montagne'); await next.click()
  const picker = page.getByTestId('scene-picker-0'), query = picker.getByRole('textbox')
  await expect(query).toBeVisible()
  await verify('stock search has an accessible name and fits all five widths', async () => {
    await expect(query).toHaveAccessibleName(/Recherche.*scène 1/)
    for (const width of [320, 375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 812 })
      await auditAccessibility(page, `reprise-stock-empty-${width}`)
    }
    await screenshot(page, 'stock-empty-1440')
  })
  await page.setViewportSize({ width: 320, height: 812 })
  await verify('stock search failure is announced separately from an empty result and can retry', async () => {
    stockMode = 'error'; await query.fill('erreur'); await query.press('Enter')
    await expect(picker.getByRole('alert')).toContainText(/indisponible/i)
    await expect(picker.getByText(/Aucun media/)).toHaveCount(0)
    await auditAccessibility(page, 'reprise-stock-error-320')
    stockMode = 'results'; await query.fill('reprise'); await query.press('Enter')
    await expect(picker.getByTestId('stock-item-reprise')).toBeVisible()
  })
  await verify('stock search keeps the newest response and deduplicates a pending query', async () => {
    stockMode = 'results'; await query.fill('ancien'); await query.press('Enter')
    await expect.poll(() => oldArrived).toBe(true)
    await expect(picker.getByRole('status')).toHaveAccessibleName(/Recherche de médias en cours/)
    await auditAccessibility(page, 'reprise-stock-loading-320')
    await query.press('Enter'); await query.fill('nouveau'); await query.press('Enter')
    await expect(picker.getByTestId('stock-item-nouveau')).toBeVisible()
    releaseOld(); await page.waitForTimeout(300)
    await expect(picker.getByTestId('stock-item-nouveau')).toBeVisible()
    assert.equal(searchBodies.filter(q => q === 'ancien').length, 1)
    const newest = picker.getByTestId('stock-item-nouveau')
    await newest.focus(); await page.keyboard.press('Enter')
    await expect(newest).toHaveAttribute('aria-pressed', 'true')
    await expect(newest).toBeFocused()
    await auditAccessibility(page, 'reprise-stock-results-320')
    await screenshot(page, 'stock-results-320')
  })
  await verify('editing the script refreshes stock keywords while unchanged steps reuse the selection', async () => {
    await page.getByRole('navigation', { name: 'Étapes de création manuelle' }).getByRole('button').nth(2).click()
    await page.getByTestId('script-input').fill('ocean'); await next.click()
    await expect.poll(() => keywordBodies.length).toBe(2)
    await expect(query).toHaveValue('ocean')
    await expect(picker.getByTestId('stock-item-ocean')).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('navigation', { name: 'Étapes de création manuelle' }).getByRole('button').nth(2).click(); await next.click()
    await expect(query).toBeVisible(); assert.equal(keywordBodies.length, 2)
    await expect(picker.getByTestId('stock-item-ocean')).toHaveAttribute('aria-pressed', 'true')
  })
  await verify('returning to a previous script cancels newer pending keywords and keeps that script current', async () => {
    const scriptStep = page.getByRole('navigation', { name: 'Étapes de création manuelle' }).getByRole('button').nth(2)
    await scriptStep.click(); await page.getByTestId('script-input').fill('foret'); await next.click()
    await expect.poll(() => keywordBodies.length).toBe(3)
    await scriptStep.click(); await page.getByTestId('script-input').fill('ocean'); await next.click()
    releaseKeywords()
    await expect(query).toHaveValue('ocean')
    await expect(picker.getByTestId('stock-item-ocean')).toHaveAttribute('aria-pressed', 'true')
    assert.equal(keywordBodies.length, 4)
  })
  await page.unroute('**/api/stock/keywords'); await page.unroute('**/api/stock/search')

  await verify('leaving the editor cancels client export feedback without claiming server cancellation', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    fixture.videos = [{ id, user_id: user.id, title: 'Export annulation UI', created_at: '2026-10-12T12:00:00Z', status: 'ready', quality: '1080p', format: '16:9', duration: 5, video_url: null,
      script_data: { narration: 'Bonjour.', scenes: [{ visual_prompt: 'Montagne', duration_seconds: 5, use_stock: false }] },
      shotstack_json: { sutraEditorClips: [{ url: 'https://media.invalid/clip.mp4', type: 'ia', kind: 'video', duration: 5 }] } }]
    let finish, submissions = 0
    await page.route('**/api/video/export', async route => { submissions++; await new Promise(resolve => { finish = resolve }); await route.fulfill({ status: 503, json: { error: 'Export fixture obsolete' } }) })
    await page.goto(base + '/editor/' + id, { waitUntil: 'networkidle' })
    await page.getByTestId('editor-export').click()
    await expect.poll(() => submissions).toBe(1)
    await expect(page.getByTestId('editor-sidebar-export')).toBeDisabled()
    // A client-side navigation keeps the global toast host mounted.
    await page.getByTestId('search-trigger').click(); await page.getByTestId('search-input').fill('bibliotheque'); await page.getByTestId('search-result-library').click()
    await expect(page).toHaveURL(base + '/library', { timeout: 15_000 }); finish(); await page.waitForTimeout(350)
    assert.equal(await page.getByText('Export fixture obsolete', { exact: true }).count(), 0)
    await page.unroute('**/api/video/export'); fixture.videos = []
  })
  assert.deepEqual(failures, [], 'T07 reprise regressions')
}
