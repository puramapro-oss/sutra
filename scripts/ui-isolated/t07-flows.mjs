import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function runT07Flows({ page, base, widths, check, noOverflow, auditAccessibility, screenshot, fixture, requests, user }) {
  if (process.argv.includes('--editor-only')) {
    await runEditorFlow({ page, base, check, auditAccessibility, screenshot, fixture, requests, user })
    return
  }
  // Detailed flow checks use the same real browser, with deterministic service fixtures.
  for (const width of widths) {
    await page.setViewportSize({ width, height: 812 })
    await page.goto(base + '/create', { waitUntil: 'networkidle' })
    await page.getByTestId('mode-manual').click()
    for (let step = 0; step < 6; step++) {
      await check(`${width}px manual creation step ${step + 1}`, async () => {
        await expect(page.getByRole('navigation', { name: 'Étapes de création manuelle' }).locator('[aria-current=step]')).toHaveAccessibleName(new RegExp(`^${step + 1}\\.`))
        if (step === 1) await page.getByTestId('topic-input').fill('Une histoire de création avec un titre très long '.repeat(5))
        if (step === 2) await page.getByTestId('script-input').fill('Première scène.\nDeuxième scène.')
        await auditAccessibility(page, `manual-${step + 1}-${width}`)
        if (step === 5) await page.getByTestId('create-button').click({ trial: true })
        else await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      })
    }
    if (width === 320) await screenshot(page, 'manual-confirmation-320')
    await page.goto(base + '/production', { waitUntil: 'networkidle' })
    for (let step = 1; step < 7; step++) {
      await check(`${width}px production step ${step + 1}`, async () => {
        await page.getByRole('navigation', { name: 'Étapes de production' }).getByRole('button').nth(step).click()
        await expect(page.getByRole('navigation', { name: 'Étapes de production' }).locator('[aria-current=step]')).toHaveAccessibleName(new RegExp(`^${step + 1}\\.`))
        // Wait for AnimatePresence to finish replacing content before auditing.
        await page.getByRole('heading', { level: 3 }).first().waitFor()
        await page.waitForTimeout(300); await auditAccessibility(page, `production-step-${step + 1}-${width}`)
      })
    }
    await page.goto(base + '/settings', { waitUntil: 'networkidle' })
    for (const name of ['Compte', 'Abonnement', 'Notifications', 'Apparence', 'Donnees']) {
      await check(`${width}px settings ${name}`, async () => {
        await page.getByRole('tab', { name, exact: true }).click(); await auditAccessibility(page, `settings-${name}-${width}`)
      })
    }
  }
  await page.setViewportSize({ width: 320, height: 812 })
  await check('settings tabs support arrows, Home/End, focus and accessible panels', async () => {
    const first = page.getByRole('tab', { name: 'Profil', exact: true }), last = page.getByRole('tab', { name: 'Donnees', exact: true })
    await last.focus(); await page.keyboard.press('Home'); await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('End'); await expect(last).toBeFocused(); await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Donnees')
    await page.keyboard.press('ArrowRight'); await expect(first).toBeFocused(); await expect(first).toBeInViewport()
    await page.getByRole('tab', { name: 'Notifications', exact: true }).click()
    const toggle = page.getByRole('switch', { name: 'Emails de bienvenue' }), before = await toggle.getAttribute('aria-checked')
    await toggle.focus(); await page.keyboard.press('Space'); await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true')
  })
  await check('library loading, failure, retry and empty state stay distinct', async () => {
    fixture.delay = 1200; await page.goto(base + '/library')
    await expect(page.getByRole('status', { name: 'Chargement de la bibliothèque' })).toBeVisible(); await noOverflow(page)
    await expect(page.getByTestId('empty-library')).toBeVisible(); fixture.delay = 0
    fixture.videosFail = true; await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('library-error')).toBeVisible(); await expect(page.getByTestId('empty-library')).toHaveCount(0)
    fixture.videosFail = false; await page.getByRole('button', { name: 'Réessayer', exact: true }).click(); await expect(page.getByTestId('empty-library')).toBeVisible()
  })
  fixture.videos = Array.from({ length: 25 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, user_id: user.id, title: `${index === 0 ? 'Ancien' : 'Nouveau'} film ${index} — un titre long pour vérifier la bibliothèque`, status: ['draft', 'ready', 'published', 'generating', 'failed'][index % 5], quality: '720p', format: '9:16', created_at: '2026-10-12T12:00:00Z', duration: 65, thumbnail_url: null, video_url: null, script_data: { scenes: [] } }))
  const firstId = fixture.videos[0].id
  for (const width of widths) {
    await page.setViewportSize({ width, height: 812 }); await page.goto(base + '/library', { waitUntil: 'networkidle' })
    for (const view of ['grid', 'list']) {
      await check(`${width}px populated library ${view}`, async () => {
        await page.getByTestId(`view-${view}`).click(); await expect(page.getByTestId(`video-${view === 'grid' ? 'card' : 'list'}-${firstId}`)).toBeVisible()
        await auditAccessibility(page, `library-${view}-${width}`)
        if (width === 320) await screenshot(page, `library-${view}-320`)
      })
    }
  }
  await page.setViewportSize({ width: 320, height: 812 }); await page.getByTestId('view-grid').click()
  await check('folder dialog traps focus, submits with Enter and returns focus on Escape', async () => {
    const trigger = page.getByTestId('library-new-folder-btn')
    await trigger.click(); const input = page.getByTestId('folder-name-input'); await expect(input).toBeFocused()
    await input.fill('Dossier avec un nom très long '.repeat(3)); await auditAccessibility(page, 'folder-dialog-320')
    const dialog = page.getByTestId('folder-modal')
    for (let index = 0; index < 7; index++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true) }
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused()
    await trigger.click(); await input.fill('DossierAvecUnNomSansEspaces'.repeat(3)); await input.press('Enter'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await noOverflow(page)
    const add = page.getByTestId(`add-folder-${firstId}`)
    await add.click(); await page.keyboard.press('Tab'); await expect(page.getByTestId(`folder-menu-${firstId}`).getByRole('button')).toBeFocused()
    await auditAccessibility(page, 'folder-picker-320'); await page.keyboard.press('Escape'); await expect(add).toBeFocused()
  })
  await check('video action dialog is reachable, closes with Escape and preserves failed deletions', async () => {
    const trigger = page.getByTestId(`video-actions-${firstId}`)
    await trigger.click(); await expect(page.getByRole('dialog', { name: 'Actions de la vidéo' })).toBeVisible(); await auditAccessibility(page, 'video-actions-320')
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
    fixture.deleteFails = true; page.once('dialog', dialog => dialog.accept()); await trigger.click(); await page.getByTestId(`video-delete-${firstId}`).click()
    await expect(page.getByTestId('library-error')).toContainText('Impossible de supprimer'); await expect(page.getByTestId(`video-card-${firstId}`)).toBeVisible(); fixture.deleteFails = false
  })
  await check('library pagination ignores same-frame duplicate requests and preserves rows on failure', async () => {
    await page.reload({ waitUntil: 'networkidle' }); fixture.delay = 350
    const before = requests.filter(item => item.path === '/rest/v1/videos' && item.query.includes('offset=12')).length
    await page.getByTestId('load-more').evaluate(button => { button.click(); button.click() })
    await expect(page.locator('[data-testid^="video-card-"]')).toHaveCount(24)
    assert.equal(requests.filter(item => item.path === '/rest/v1/videos' && item.query.includes('offset=12')).length, before + 1)
    fixture.delay = 0; fixture.videosFail = true; await page.getByTestId('load-more').click(); await expect(page.getByTestId('library-error')).toContainText('charger la suite')
    await expect(page.locator('[data-testid^="video-card-"]')).toHaveCount(24); fixture.videosFail = false
  })
  await check('a stale search cannot overwrite the current results or steal input focus', async () => {
    fixture.staleDelay = 1400; const search = page.getByTestId('library-search')
    const before = requests.filter(item => item.query.includes('Ancien')).length
    await search.fill('Ancien'); await expect.poll(() => requests.filter(item => item.query.includes('Ancien')).length).toBeGreaterThan(before)
    await expect(search).toBeFocused(); await search.fill('Nouveau')
    await expect(page.getByTestId(`video-card-${firstId}`)).toHaveCount(0); await expect(page.locator('[data-testid^="video-card-"]')).toHaveCount(12)
    await page.waitForTimeout(1500); await expect(search).toBeFocused(); await expect(page.getByTestId(`video-card-${firstId}`)).toHaveCount(0); fixture.staleDelay = 0
  })
  fixture.videos = []
  await page.goto(base + '/production', { waitUntil: 'networkidle' })
  await check('production shows an announced error and clears busy state after a failed request', async () => {
    await page.route('**/api/production', async route => { await new Promise(done => setTimeout(done, 500)); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Service temporairement indisponible' }) }) })
    await page.getByTestId('production-idea').fill('Un voyage en montagne')
    await page.getByRole('navigation', { name: 'Étapes de production' }).getByRole('button').nth(1).click()
    await page.getByTestId('generate-script').click(); await expect(page.getByTestId('generate-script')).toHaveAttribute('aria-busy', 'true')
    await expect(page.locator('main').getByRole('alert')).toContainText('Service temporairement indisponible'); await expect(page.getByTestId('generate-script')).toBeEnabled(); await auditAccessibility(page, 'production-error-320')
  })
  await page.unroute('**/api/production')
  await check('production waits for queued work before advancing and displays the completed result', async () => {
    let polls = 0
    await page.route('**/api/production', route => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: 'production-fixture', status: 'queued' }) }))
    await page.route('**/api/video/status/production-fixture', route => {
      polls++
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(polls === 1
        ? { jobId: 'production-fixture', status: 'processing' }
        : { jobId: 'production-fixture', status: 'done', data: { title: 'Film local', scenes: [{ voiceover: 'Résultat de la file locale', visual_prompt: 'Montagne', duration_seconds: 5 }] } }) })
    })
    await page.getByTestId('generate-script').click()
    await expect(page.getByTestId('generate-script')).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => polls, { timeout: 10_000 }).toBeGreaterThan(0)
    await expect(page.getByRole('navigation', { name: 'Étapes de production' }).locator('[aria-current=step]')).toHaveAccessibleName(/^2\./)
    await expect(page.getByRole('navigation', { name: 'Étapes de production' }).locator('[aria-current=step]')).toHaveAccessibleName(/^3\./, { timeout: 15_000 })
    await page.getByRole('navigation', { name: 'Étapes de production' }).getByRole('button').nth(1).click()
    await expect(page.locator('main pre')).toContainText('Résultat de la file locale')
    assert.equal(polls, 2)
    await page.unroute('**/api/production')
    await page.unroute('**/api/video/status/production-fixture')
  })
  await runEditorFlow({ page, base, check, auditAccessibility, screenshot, fixture, requests, user })
  await page.goto(base + '/settings', { waitUntil: 'networkidle' })
}

async function runEditorFlow({ page, base, check, auditAccessibility, screenshot, fixture, requests, user }) {
  await check('editor loads once, retains source clips and sends normalized volumes to export', async () => {
    const editorId = '33333333-3333-4333-8333-333333333333'
    fixture.videos = [{ id: editorId, user_id: user.id, title: 'Montage local', created_at: '2026-10-12T12:00:00Z', status: 'ready', quality: '1080p', format: '16:9', duration: 5, video_url: null,
      script_data: { narration: 'Bonjour.', scenes: [{ visual_prompt: 'Montagne', duration_seconds: 5, use_stock: false }] },
      shotstack_json: { sutraEditorClips: [{ url: 'https://media.invalid/clip.mp4', type: 'ia', kind: 'video', duration: 5 }] } }]
    let exported
    await page.route('**/api/video/export', async route => {
      exported = route.request().postDataJSON()
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: 'export-fixture', status: 'queued' }) })
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(base + '/editor/' + editorId, { waitUntil: 'networkidle' })
    try { await expect(page.getByTestId('editor-title')).toHaveText('Montage local') } catch (error) {
      await screenshot(page, 'editor-load-failure')
      process.stderr.write(JSON.stringify({ url: page.url(), body: await page.locator('body').innerText(), requests: requests.slice(-15) }) + '\n')
      throw error
    }
    const reads = requests.filter(r => r.path === '/rest/v1/videos' && r.query.includes(editorId)).length
    await page.waitForTimeout(500)
    assert.equal(requests.filter(r => r.path === '/rest/v1/videos' && r.query.includes(editorId)).length, reads, 'no load/history render loop')
    await page.getByTestId('editor-export').click()
    await expect.poll(() => exported).toBeTruthy()
    assert.deepEqual(exported.scenes, [{ url: 'https://media.invalid/clip.mp4', type: 'ia', kind: 'video', duration: 5 }])
    assert.equal(exported.voiceVolume, .8); assert.equal(exported.musicVolume, .5)
    await expect(page.getByText('Export en cours.', { exact: false })).toBeVisible()
    await screenshot(page, 'editor-export-1280')
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      for (const tab of ['script', 'scenes', 'audio', 'subtitles', 'brandkit']) {
        await page.getByTestId('editor-tab-' + tab).click()
        await auditAccessibility(page, `editor-${tab}-${width}`)
      }
      await screenshot(page, `editor-a11y-${width}`)
    }
    await page.unroute('**/api/video/export')
    fixture.videos = []
  })
}
