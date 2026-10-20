// T06 publication assertions, reused with the existing production browser/server.
// Only the isolated Supabase read fixture is intercepted. No publication writes.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'

const require = createRequire(import.meta.url)

export async function publicationChecks({ context, base, fixture, output, engine, check, newPage, writes }) {
  let postMode = 'empty', readError = false, page
  const writesBefore = writes.length
  const predicate = url => url.origin === fixture.url
    && ['/rest/v1/videos', '/rest/v1/scheduled_posts'].includes(url.pathname)
  const handler = async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/rest/v1/videos') {
      if (readError === 'videos') return route.fulfill({
        status: 503, json: { message: 'private-fixture-diagnostic-not-for-ui' },
      })
      return route.fallback()
    }
    const scheduled = url.searchParams.get('status') === 'eq.scheduled'
    if (readError === (scheduled ? 'scheduled' : 'past')) return route.fulfill({
      status: 503, json: { message: 'private-fixture-diagnostic-not-for-ui' },
    })
    if (readError === 'malformed') return route.fulfill({
      json: { unexpected: 'private-fixture-diagnostic-not-for-ui' },
    })
    return route.fulfill({ json: postMode === 'empty' ? [] : [{
      id: '44444444-4444-4444-8444-444444444444',
      video_id: '33333333-3333-4333-8333-333333333333',
      platform: 'youtube', status: scheduled ? 'scheduled' : 'published',
      scheduled_at: '2026-10-25T08:30:00.000Z', created_at: '2026-10-20T08:30:00.000Z',
    }] })
  }
  await context.route(predicate, handler)
  try {
    page = await newPage('/publish')
    for (const mode of ['empty', 'populated']) {
      postMode = mode
      if (mode !== 'empty') await page.goto(base + '/publish', { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('publish-title')).toBeVisible()
      await expect(page.getByTestId('publish-loading')).toHaveCount(0)
      await expect(page.getByText(mode === 'empty' ? 'Aucune publication programmee' : 'Programmee', { exact: true })).toBeVisible()
      await page.waitForTimeout(700)
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      for (const width of [320, 375, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(200)
        await check(`publish ${mode}-${width}: axe and layout`, async () => {
          const violations = await page.evaluate(async () => (await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          })).violations.map(({ id, nodes }) => ({
            id, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })),
          })))
          await writeFile(resolve(output, `${engine}-publish-${mode}-${width}-axe.json`), JSON.stringify(violations, null, 2) + '\n')
          await page.screenshot({ path: resolve(output, `${engine}-publish-${mode}-${width}.png`) })
          assert.deepEqual(violations, [])
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        })
      }
    }
    await check('publish table: keyboard scrolling', async () => {
      await page.setViewportSize({ width: 320, height: 900 })
      const region = page.getByRole('region', { name: 'Publications programmées', exact: true })
      await region.focus()
      await expect(region).toBeFocused()
      assert.ok(await region.evaluate(element => element.scrollWidth > element.clientWidth))
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    })
    for (const source of ['scheduled', 'past', 'videos', 'malformed']) {
      await check(`publish read ${source}: error, no false empty, manual recovery`, async () => {
        readError = source
        await page.goto(base + '/publish', { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('alert').filter({ hasText: 'Impossible de vérifier les vidéos et les publications.' })).toBeVisible()
        await page.screenshot({ path: resolve(output, `${engine}-publish-read-${source}-error.png`) })
        assert.equal(await page.getByText('Aucune publication programmee', { exact: true }).count(), 0)
        assert.equal(await page.getByTestId('publish-empty').count(), 0)
        assert.equal((await page.locator('body').innerText()).includes('private-fixture-diagnostic-not-for-ui'), false)
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        })).violations.map(({ id }) => id))
        assert.deepEqual(violations, [])
        readError = false
        const retry = page.getByRole('button', { name: 'Réessayer', exact: true })
        await retry.focus()
        await expect(retry).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByText('Programmee', { exact: true })).toBeVisible()
      })
    }
    await check('publish reads and retry never write business data', async () => {
      assert.equal(writes.length, writesBefore)
    })
  } finally {
    await page?.close()
    await context.unroute(predicate, handler)
  }
}
