import { expect } from '@playwright/test'
import { resolve } from 'node:path'
import { enterTestSession } from './session.mjs'

export async function editorChecks({ page, base, fixture, output, check }) {
  await enterTestSession({ page, base, fixture })
  const id = '33333333-3333-4333-8333-333333333333'
  fixture.state.videos = [{ id, user_id: fixture.user.id, title: 'Historique simulé', created_at: '2026-10-15T00:00:00Z', status: 'draft', quality: '720p', format: '9:16', duration: 5, video_url: null, script_data: { narration: 'Bonjour.', scenes: [{ visual_prompt: 'Montagne', duration_seconds: 5 }] }, shotstack_json: null }]
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: subtitle add/edit/delete undo redo preserves initial narration`, async () => {
      await page.goto(`${base}/editor/${id}`)
      await page.getByTestId('editor-tab-subtitles').click()
      const texts = page.getByRole('textbox', { name: 'Texte du sous-titre' })
      const undo = page.getByTestId('editor-undo'), redo = page.getByTestId('editor-redo')
      await expect(texts).toHaveCount(1)
      await page.getByTestId('add-subtitle').click()
      await expect(undo).toBeEnabled()
      await undo.click()
      await expect(texts).toHaveCount(1)
      await expect(texts.first()).toHaveValue('Bonjour')
      await redo.click()
      await texts.last().fill('Texte récupérable')
      await page.getByRole('button', { name: 'Supprimer le sous-titre' }).last().click()
      await undo.click()
      await expect(texts.last()).toHaveValue('Texte récupérable')
      await redo.click()
      await expect(texts).toHaveCount(1)
      await undo.click()
      await texts.last().fill('Nouvelle branche')
      await expect(redo).toBeDisabled()
      await undo.click()
      await expect(texts.last()).toHaveValue('Texte récupérable')
      await redo.click()
      await expect(texts.last()).toHaveValue('Nouvelle branche')
      await page.waitForTimeout(700)
      await page.screenshot({ path: resolve(output, `subtitles-${width}.png`), fullPage: true })
    })
    await check(`${width}: script edit after undo replaces future history`, async () => {
      await page.goto(`${base}/editor/${id}`)
      const script = page.getByTestId('editor-panel-script').getByRole('textbox')
      await script.fill('Première modification')
      await page.getByTestId('editor-undo').click()
      await expect(script).toHaveValue('Bonjour.')
      await script.fill('Nouvelle modification')
      await expect(page.getByTestId('editor-redo')).toBeDisabled()
      await page.getByTestId('editor-undo').click()
      await expect(script).toHaveValue('Bonjour.')
      await page.getByTestId('editor-redo').click()
      await expect(script).toHaveValue('Nouvelle modification')
    })
  }
}
