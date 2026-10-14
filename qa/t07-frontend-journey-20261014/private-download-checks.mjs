import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'

// Real /api/media route, fake authenticated owner and signed storage, no external I/O.
export async function privateDownloadChecks({ page, context, base, fixture, check, details }) {
  const bytes = await readFile(new URL('./fixture-video.mp4', import.meta.url))
  const hash = createHash('sha256').update(bytes).digest('hex')
  const reference = Buffer.from(`owners/${fixture.user.id}/fixture.mp4`).toString('base64url')
  const url = base + '/api/media/' + reference
  const video = { id: '22222222-2222-4222-8222-222222222222', user_id: fixture.user.id, title: 'Fichier privé simulé', status: 'ready', video_url: url, format: '9:16', quality: '720p', script_data: null, shotstack_json: { sutraVerification: { url, sha256: hash } }, duration: 1, created_at: '2026-10-14T00:00:00Z' }
  fixture.state.videos = [video]
  let exports = 0
  let downloads = 0, mediaFetches = 0
  page.on('download', () => downloads++)
  page.on('request', request => { if (request.url() === url && request.resourceType() === 'fetch') mediaFetches++ })
  await context.route('**/api/video/export', route => { exports++; return route.fulfill({ status: 403 }) })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/editor/' + video.id)
    await check(`${width}: private media 307 to inline cross-origin storage downloads at keyboard`, async () => {
      const link = page.getByTestId('editor-download')
      await expect(link).toBeVisible(); await link.focus()
      const received = page.waitForEvent('download')
      await page.keyboard.press('Enter')
      const download = await received
      assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), hash)
      assert.equal(new URL(page.url()).pathname, '/editor/' + video.id)
      assert.equal(exports, 0)
      assert.ok(fixture.state.signatures.length > 0)
      assert.ok(fixture.state.signatures.every(s => s.expiresIn === 300))
      details.push({ width, filename: download.suggestedFilename(), sha256: hash, storageSigned: true, externalStorage: false })
    })
  }
  const button = page.getByTestId('editor-download')
  const error = page.getByRole('alert').filter({ hasText: 'Téléchargement indisponible' })
  for (const mode of ['denied', 'html', 'corrupt']) {
    await check(`download ${mode}: no file, sanitized visible error and retry enabled`, async () => {
      fixture.state.mediaMode = mode
      const before = downloads
      await button.click()
      await expect(error).toBeVisible(); await expect(button).toBeEnabled()
      assert.equal(downloads, before)
      assert.ok(!(await error.innerText()).includes('private_diagnostic'))
    })
  }
  await check('download retry after failure: one fetch for simultaneous clicks, hash preserved', async () => {
    fixture.state.mediaMode = 'normal'; fixture.state.mediaDelayMs = 200
    const before = mediaFetches
    const received = page.waitForEvent('download')
    await button.evaluate(b => { b.click(); b.click() })
    const download = await received
    assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), hash)
    assert.equal(mediaFetches - before, 1)
    await expect(error).toHaveCount(0); await expect(button).toBeEnabled()
  })
  await check('download suspended body: bounded timeout and retry; no file', async () => {
    fixture.state.mediaMode = 'hang'; fixture.state.mediaDelayMs = 0
    const before = downloads
    await page.clock.install()
    const response = page.waitForResponse(r => r.url().includes('/storage/v1/object/sign/') && r.request().resourceType() === 'fetch')
    await button.click(); await response
    await expect(button).toBeDisabled()
    await page.clock.fastForward(31000)
    await expect(error).toBeVisible(); await expect(button).toBeEnabled()
    assert.equal(downloads, before)
    details.push({ timeout: '30000ms browser clock advanced 31000ms; body suspended', noActualWait30s: true })
  })
}
