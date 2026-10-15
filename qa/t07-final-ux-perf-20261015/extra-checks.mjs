import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { expect } from '@playwright/test'
import { enterTestSession } from './session.mjs'
const require = createRequire(import.meta.url)

export async function extraChecks({ page, context, base, fixture, output, check, details }) {
  await enterTestSession({ page, base, fixture })
  const audit = async name => {
    await page.waitForTimeout(700)
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: ['label', 'button-name', 'color-contrast', 'aria-valid-attr-value'] })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })))
    details.push({ name, violations })
    assert.deepEqual(violations, [])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: dashboard failure, explicit retry and navigation`, async () => {
      fixture.state.videoMode = 'error'
      await page.goto(base + '/dashboard')
      await expect(page.getByRole('heading', { name: 'Le tableau de bord n’a pas pu être chargé' })).toBeVisible()
      await expect(page.getByTestId('dashboard-greeting')).toHaveCount(0)
      fixture.state.videoMode = 'normal'
      await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
      await expect(page.getByTestId('dashboard-greeting')).toContainText('Legal')
      const link = page.getByRole('link', { name: /Creer|Créer/ }).first()
      await link.focus(); await page.keyboard.press('Enter')
      await expect(page.getByTestId('topic-input')).toBeVisible()
    })
    await check(`${width}: unavailable capabilities, formats and cost disclosure`, async () => {
      await page.goto(base + '/create')
      await expect(page.getByText('Mode personnel distant : disponibilité non vérifiée sur cet écran.')).toBeVisible()
      const disclosure = page.getByText('Modes, coûts et disponibilité', { exact: true })
      await disclosure.focus(); await page.keyboard.press('Enter')
      await expect(page.getByText('Aucun budget chiffré ni délai garanti', { exact: false })).toBeVisible()
      await expect(page.getByText('Open source ne signifie pas hébergement gratuit.', { exact: false })).toBeVisible()
      await page.getByTestId('format-16x9').click()
      await page.getByTestId('format-1x1').click()
      await page.getByTestId('engine-wan-classic').click()
      await audit(`create-cost-format-${width}`)
    })
    await page.getByTestId('mode-manual').click()
    for (let step = 0; step < 6; step++) {
      await check(`${width}: manual brief step ${step + 1}`, async () => {
        await expect(page.getByRole('navigation', { name: 'Étapes de création manuelle' }).locator('[aria-current=step]')).toHaveAccessibleName(new RegExp(`^${step + 1}\\.`))
        if (step === 1) await page.getByTestId('topic-input').fill('Un récit test : aucun fournisseur réel')
        if (step === 2) await page.getByTestId('script-input').fill('Scène de test.\nDeuxième scène.')
        await audit(`manual-${step + 1}-${width}`)
        if (step === 5) await page.getByTestId('create-button').click({ trial: true })
        else await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      })
    }
    await page.screenshot({ path: resolve(output, `manual-${width}.png`), fullPage: true })
    fixture.state.videos = [{ id: '33333333-3333-4333-8333-333333333333', user_id: fixture.user.id, title: 'Montage simulé — sous-titres', created_at: '2026-10-15T00:00:00Z', status: 'draft', quality: '720p', format: '9:16', duration: 5, video_url: null, script_data: { narration: 'Bonjour.', scenes: [{ visual_prompt: 'Montagne', duration_seconds: 5 }] }, shotstack_json: null }]
    await page.goto(base + '/editor/' + fixture.state.videos[0].id)
    await expect(page.getByTestId('editor-title')).toBeVisible()
    for (const tab of ['script', 'scenes', 'audio', 'subtitles', 'brandkit']) {
      await check(`${width}: editor ${tab} accessible`, async () => {
        await page.getByTestId('editor-tab-' + tab).click()
        await audit(`editor-${tab}-${width}`)
      })
    }
    await check(`${width}: subtitle edit, delete and undo preserve draft`, async () => {
      await page.getByTestId('editor-tab-subtitles').click()
      await page.getByTestId('add-subtitle').click()
      const text = page.getByRole('textbox', { name: 'Texte du sous-titre' }).last()
      await text.fill('Sous-titre de test')
      await page.getByRole('button', { name: 'Supprimer le sous-titre' }).last().click()
      await page.getByTestId('editor-undo').click()
      await expect(page.getByRole('textbox', { name: 'Texte du sous-titre' }).last()).toHaveValue('Sous-titre de test')
      await audit(`subtitle-edit-${width}`)
    })
    await page.screenshot({ path: resolve(output, `subtitles-${width}.png`), fullPage: true })
    fixture.state.videos = []
  }
  let calls = 0
  await context.route('**/api/create', route => {
    calls++
    return route.fulfill({ status: 402, json: { error: 'Crédits insuffisants' } })
  })
  await check('missing credits are distinct from provider availability, with no automatic retry', async () => {
    await page.goto(base + '/create')
    await page.getByTestId('topic-input').fill('Test budget')
    await page.getByTestId('create-button').click()
    await expect(page.getByText('Limite du compte ou budget atteint', { exact: true })).toBeVisible()
    await expect(page.getByTestId('create-button')).toBeEnabled()
    assert.equal(calls, 1)
  })
  let polls = 0, submissions = 0
  const productionJob = '66666666-6666-4666-8666-666666666666'
  await context.route('**/api/production', route => {
    assert.equal(route.request().method(), 'POST'); submissions++
    return route.fulfill({ status: 202, json: { jobId: productionJob, status: 'queued' } })
  })
  await context.route(`**/api/video/status/${productionJob}`, route => {
    polls++
    return route.fulfill({ json: polls === 1 ? { jobId: productionJob, status: 'processing' } : { jobId: productionJob, status: 'done', data: { title: 'Simulation locale', scenes: [{ voiceover: 'Résultat simulé', visual_prompt: 'Montagne', duration_seconds: 5 }] } } })
  })
  await check('queued production stays pending until simulated completion', async () => {
    await page.goto(base + '/production')
    await page.getByTestId('production-idea').fill('Test de progression')
    const nav = page.getByRole('navigation', { name: 'Étapes de production' })
    await nav.getByRole('button').nth(1).click()
    await page.getByTestId('generate-script').click()
    await expect(page.getByTestId('generate-script')).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => polls, { timeout: 10000 }).toBeGreaterThan(0)
    await expect(nav.locator('[aria-current=step]')).toHaveAccessibleName(/^2\./)
    await expect(nav.locator('[aria-current=step]')).toHaveAccessibleName(/^3\./, { timeout: 15000 })
    assert.equal(polls, 2)
    assert.equal(submissions, 1, 'queued work never triggers a second generation')
    await nav.getByRole('button').nth(1).click()
    await expect(page.locator('main pre')).toContainText('Résultat simulé')
    assert.equal(await page.evaluate(id => sessionStorage.getItem(`sutra:production-intent:v1:${id}`), fixture.user.id), null)
  })
}
