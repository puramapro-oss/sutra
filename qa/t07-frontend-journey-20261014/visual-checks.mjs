import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { expect } from '@playwright/test'
const require = createRequire(import.meta.url)

// Additional risk: screenshots must show settled animations, not an intermediate frame.
export async function visualChecks({ page, base, fixture, output, check, details }) {
  const video = { id: '22222222-2222-4222-8222-222222222222', user_id: fixture.user.id, title: 'Montage test', status: 'ready', video_url: fixture.url + '/media.mp4', format: '9:16', quality: '720p', script_data: null, shotstack_json: null, duration: 1, created_at: '2026-10-14T00:00:00Z' }
  const download = process.argv.includes('--visual-download')
  if (download) video.shotstack_json = { sutraVerification: { url: video.video_url, sha256: createHash('sha256').update(await readFile(new URL('./fixture-video.mp4', import.meta.url))).digest('hex') } }
  fixture.state.videos = [video]
  const settled = async () => {
    await expect(page.locator('main')).toHaveCSS('opacity', '1')
    assert.equal(await page.locator('dialog:modal').count(), 0)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '')
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/editor/' + video.id)
    await check(`${width}: settled ${download ? 'verified download control has focus, contrast and no overflow' : 'unverified player has readable notice and no lingering consent modal'}`, async () => {
      const notice = download ? page.getByTestId('editor-download') : page.getByText('Résultat non validé', { exact: false })
      await expect(notice).toBeVisible(); await settled()
      if (download) { await notice.focus(); await expect(notice).toBeFocused(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true) }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const violations = await notice.evaluate(async el => (await window.axe.run(el.parentElement.parentElement, { runOnly: ['color-contrast'] })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })))
      details.push({ width, playerContrast: violations }); assert.deepEqual(violations, [])
      await page.screenshot({ path: resolve(output, `player-${width}.png`), fullPage: false, animations: 'disabled' })
    })
    if (download) continue
    await page.goto(base + '/settings/social')
    await check(`${width}: all 14 social cards finish entrance animation and remain in viewport width`, async () => {
      await expect(page.getByTestId('platform-card-vimeo')).toHaveCSS('opacity', '1')
      await settled()
      assert.equal(await page.locator('[data-testid^="platform-card-"]').count(), 14)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await page.screenshot({ path: resolve(output, `social-${width}.png`), fullPage: false, animations: 'disabled' })
    })
  }
}
