import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { schedulerChecks } from './scheduler-checks.mjs'
import { productionChecks } from './production-checks.mjs'
const require = createRequire(import.meta.url)

export async function checks(args) {
  const { page, output, details, check } = args
  async function visual(label, selector) {
    await page.waitForTimeout(700)
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    const accessibility = await page.evaluate(async selector => {
      const result = await window.axe.run(selector, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
      return { violations: result.violations, incomplete: result.incomplete.map(item => ({ id: item.id, count: item.nodes.length })) }
    }, selector)
    await writeFile(resolve(output, label + '-axe.json'), JSON.stringify(accessibility, null, 2))
    await page.screenshot({ path: resolve(output, label + '.png'), fullPage: true })
    assert.deepEqual(accessibility.violations.map(item => item.id), [])
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }))
    details.push({ label, geometry, accessibility })
    assert.ok(geometry.content <= geometry.viewport + 1, JSON.stringify(geometry))
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await schedulerChecks({ ...args, width, visual })
    await productionChecks({ ...args, width, visual })
  }
  await check('production recovery remains scoped to the authenticated user', async () => {
    await page.evaluate(() => sessionStorage.setItem('sutra:production-intent:v1:someone-else', '{"unreadable":"foreign"}'))
    await page.reload()
    await expect(page.getByTestId('production-request-status')).toContainText('Aucune demande')
  })
}
