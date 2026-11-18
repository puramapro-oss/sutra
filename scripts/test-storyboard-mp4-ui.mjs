import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { BufferSource, Input, MP4 } from 'mediabunny'

export async function verifyStoryboardMp4(context, origin) {
  const page = await context.newPage()
  const external = []
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue()
    external.push(url.origin)
    return route.abort()
  })
  const evidence = process.env.SUTRA_MOTION_EVIDENCE_DIR
  const directory = evidence || await mkdtemp(join(tmpdir(), 'sutra-mp4-'))
  await mkdir(directory, { recursive: true })
  try {
    await page.goto(origin)
    await page.locator('#idea').fill('SUTRA')
    await page.getByRole('button', { name: /^9:16/ }).click()
    const texts = ['De l’idée au storyboard.', 'Anime chaque plan.', 'Du storyboard au MP4.']
    for (const [index, text] of texts.entries()) {
      await page.getByTestId(index ? 'add-scene-btn' : 'add-first-scene-btn').click()
      await page.getByLabel(`Description du plan ${index + 1}`, { exact: true }).fill(text)
      await page.getByLabel(`Durée du plan ${index + 1} en secondes`).fill('2')
      await page.getByLabel(`Transition du plan ${index + 1}`).selectOption(['slide', 'zoom', 'fade'][index])
    }

    // The portable project remains available even when hardware H.264 is absent.
    const [jsx] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-remotion-btn').click()])
    await jsx.saveAs(join(directory, 'sutra.remotion.jsx'))
    const render = page.getByTestId('render-storyboard-mp4')
    const download = page.getByTestId('download-storyboard-mp4')
    await render.click()
    const unsupported = page.getByRole('alert').filter({ hasText: 'H.264' })
    await expect(download.or(unsupported)).toBeVisible({ timeout: 90_000 })
    if (await unsupported.isVisible()) {
      assert.ok(!evidence, 'The requested native MP4 qualification requires a browser with H.264')
      return 'H.264 non pris en charge sur cet appareil, export Remotion vérifié'
    }
    const [movie] = await Promise.all([page.waitForEvent('download'), download.click()])
    const path = join(directory, 'SUTRA_Storyboard_6s.mp4')
    await movie.saveAs(path)
    const input = new Input({ formats: [MP4], source: new BufferSource(await readFile(path)) })
    try {
      const [video] = await input.getVideoTracks()
      assert.ok(video)
      assert.equal((await input.getTracks()).length, 1)
      assert.deepEqual(await Promise.all([video.getCodec(), video.getDisplayWidth(), video.getDisplayHeight()]), ['avc', 1080, 1920])
      const stats = await video.computePacketStats()
      assert.equal(stats.packetCount, 144)
      assert.ok(Math.abs(stats.averagePacketRate - 24) < 0.001)
      assert.ok(Math.abs(await input.computeDuration() - 6) < 0.001)
    } finally {
      input.dispose()
    }

    await page.getByLabel('Description du plan 1', { exact: true }).fill('Une nouvelle accroche.')
    await expect(download).toHaveCount(0)
    await render.click()
    await page.getByRole('button', { name: 'Annuler le rendu' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Rendu annulé' })).toBeVisible()
    await expect(download).toHaveCount(0)
    assert.deepEqual(external, [])
    return 'MP4 natif H.264, 1080×1920, 144 images en 6 s ; édition et annulation vérifiées'
  } finally {
    await page.close()
    if (!evidence) await rm(directory, { recursive: true, force: true })
  }
}
