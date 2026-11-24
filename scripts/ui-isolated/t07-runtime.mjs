import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

// Local observations, not a Lighthouse score or a real-device performance budget.
export async function runT07Runtime({ page, base, check, noOverflow, screenshot }) {
  const observations = []
  await page.addInitScript(() => {
    window.sutraLongTasks = []
    new PerformanceObserver(list => {
      window.sutraLongTasks.push(...list.getEntries().map(entry => entry.duration))
    }).observe({ type: 'longtask', buffered: true })
  })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 812 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    for (const path of ['/dashboard', '/create', '/production', '/library', '/settings']) {
      await check(`${width}px normal motion ${path} remains usable`, async () => {
        await page.goto(base + path, { waitUntil: 'networkidle' })
        await expect(page.getByTestId('header')).toBeVisible()
        await page.waitForTimeout(700); await noOverflow(page)
        await page.getByTestId('search-trigger').click(); await expect(page.getByTestId('search-input')).toBeFocused()
        await page.keyboard.press('Escape'); await expect(page.getByTestId('search-trigger')).toBeFocused()
        observations.push({ width, path, ...await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0]
          return { domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd), loadMs: Math.round(navigation.loadEventEnd), longTasks: window.sutraLongTasks.length, maxLongTaskMs: Math.round(Math.max(0, ...window.sutraLongTasks)) }
        }) })
      })
    }
    if (width === 1440) await screenshot(page, 'settings-normal-motion-1440')
  }
  await check('reduced motion disables the decorative canvas and the quote stays after content', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(base + '/create', { waitUntil: 'networkidle' })
    await expect(page.locator('canvas')).toHaveCount(0)
    const quote = page.getByTestId('studio-quote')
    assert.equal(await quote.evaluate(el => getComputedStyle(el).position), 'static')
    const quoteBox = await quote.boundingBox(), createBox = await page.getByTestId('create-button').boundingBox()
    assert.ok(quoteBox.y >= createBox.y + createBox.height, 'footer never overlays the primary action')
  })
  return observations
}
