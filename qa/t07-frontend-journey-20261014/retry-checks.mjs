import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'

// Re-run only the four assertions affected by harness corrections.
export async function retryChecks({ page, context, base, fixture, output, check }) {
  const bytes = await readFile(new URL('./fixture-video.mp4', import.meta.url))
  const hash = createHash('sha256').update(bytes).digest('hex')
  const url = fixture.url + '/media.mp4'
  let calls = 0
  await context.route('**/api/video/export', route => { calls++; return route.fulfill({ status: 503, json: { error: 'unexpected export' } }) })
  const video = { id: '22222222-2222-4222-8222-222222222222', user_id: fixture.user.id, title: 'Montage test', status: 'ready', video_url: url, format: '9:16', quality: '720p', script_data: null, shotstack_json: { sutraVerification: { url, sha256: hash } }, duration: 1, created_at: '2026-10-14T00:00:00Z' }
  fixture.state.videos = [video]
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/editor/' + video.id)
    await expect(page.getByTestId('editor-title')).toBeVisible()
    await check(`${width}: missing sources refuse export with visible reason and no request`, async () => {
      await page.getByTestId('editor-export').evaluate(b => { b.click(); b.click() })
      await expect(page.getByText('Les sources de ce montage sont indisponibles. Aucun export ne peut etre lance.', { exact: true }).first()).toBeVisible()
      await expect(page.getByTestId('editor-export')).toBeEnabled()
      assert.equal(calls, 0)
    })
    await check(`${width}: verified saved result downloads existing bytes without a render`, async () => {
      const link = page.getByTestId('editor-download')
      await link.focus(); await expect(link).toBeFocused()
      const received = page.waitForEvent('download')
      await page.keyboard.press('Enter')
      const download = await received
      assert.equal(download.suggestedFilename(), 'sutra-video.mp4')
      assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), hash)
      assert.equal(calls, 0)
      await page.screenshot({ path: resolve(output, `download-${width}.png`), fullPage: true })
    })
  }
}
