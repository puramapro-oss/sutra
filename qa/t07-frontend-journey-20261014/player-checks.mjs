import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'

export async function playerChecks({ page, fixture, width, output, check, exportCalls }) {
  const video = fixture.state.videos[0]
  const bytes = await readFile(new URL('./fixture-video.mp4', import.meta.url))
  const hash = createHash('sha256').update(bytes).digest('hex')
  const url = fixture.url + '/media.mp4'
  for (const [status, text] of [
    ['draft', 'Ce brouillon ne contient pas encore de vidéo.'],
    ['generating', 'La video est en cours de generation'],
    ['ready', 'Le fichier final est indisponible. Vérifie la bibliothèque ou contacte le support.'],
  ]) await check(`${width}: ${status} without media has truthful state and disabled controls`, async () => {
    video.status = status
    await page.reload()
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    for (const id of ['editor-play-pause', 'editor-mute', 'editor-volume', 'editor-seek', 'editor-speed-1']) await expect(page.getByTestId(id)).toBeDisabled()
    await expect(page.getByTestId('editor-download')).toHaveCount(0)
  })
  video.video_url = url; video.status = 'ready'
  await check(`${width}: unverified result cannot be downloaded`, async () => {
    await page.reload()
    await expect(page.getByText('Résultat non validé', { exact: false })).toBeVisible()
    await expect(page.getByTestId('editor-download')).toHaveCount(0)
  })
  video.shotstack_json = { sutraVerification: { url: url + '-stale', sha256: hash } }
  await check(`${width}: mismatched proof is not validation`, async () => {
    await page.reload(); await expect(page.getByText('Résultat non validé', { exact: false })).toBeVisible()
    await expect(page.getByTestId('editor-download')).toHaveCount(0)
  })
  video.shotstack_json.sutraVerification.url = url
  await check(`${width}: verified saved result downloads existing bytes without a render`, async () => {
    await page.reload()
    const before = exportCalls.length
    const link = page.getByTestId('editor-download')
    await expect(link).toBeVisible()
    await link.focus(); await expect(link).toBeFocused()
    const received = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await received
    assert.equal(download.suggestedFilename(), 'sutra-video.mp4')
    assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), hash)
    assert.equal(exportCalls.length, before)
    await page.screenshot({ path: resolve(output, `download-${width}.png`), fullPage: true })
  })
  video.status = 'failed'
  await check(`${width}: failed status with stale verified bytes never offers final download`, async () => {
    await page.reload(); await expect(page.getByText('Résultat non validé', { exact: false })).toBeVisible()
    await expect(page.getByTestId('editor-download')).toHaveCount(0)
  })
  // Persisted, recoverable source list: exercise the existing export form, never a renderer.
  video.status = 'ready'
  video.script_data = { narration: '', scenes: [{ scene_number: 1, description: 'Fixture', duration_seconds: 1 }] }
  video.shotstack_json.sutraEditorClips = [{ url, duration: 1, kind: 'video' }]
  await page.reload()
  await check(`${width}: simulated export outage recovers, one request for simultaneous clicks`, async () => {
    const before = exportCalls.length
    await page.getByTestId('editor-export').evaluate(b => { b.click(); b.click() })
    await expect(page.getByText('Export indisponible', { exact: true })).toBeVisible()
    await expect(page.getByTestId('editor-export')).toBeEnabled()
    assert.equal(exportCalls.length - before, 1)
  })
}
