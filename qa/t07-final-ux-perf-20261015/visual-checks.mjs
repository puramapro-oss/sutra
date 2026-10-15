import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import { enterTestSession } from './session.mjs'
const require = createRequire(import.meta.url)

export async function visualChecks({ page, context, base, fixture, output, check, details }) {
  await enterTestSession({ page, base, fixture })
  let connected = false
  await context.route('**/api/social/accounts', route => route.fulfill(connected
    ? { json: { accounts: [{ id: '33333333-3333-4333-8333-333333333333', platform: 'youtube', username: 'test-social', display_name: 'Compte de test', status: 'connected', connected_at: '2026-10-15T00:00:00Z' }] } }
    : { status: 503, json: { error: 'fixture_social_unavailable' } }))
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    connected = false
    await page.goto(base + '/settings/social')
    await check(`${width}: settled social error and dialog visuals, labels and contrast`, async () => {
      await expect(page.getByTestId('social-load-error')).toBeVisible()
      await page.waitForTimeout(700)
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const audit = async (selector, name) => {
        const violations = await page.evaluate(async selector => (await window.axe.run(document.querySelector(selector), { runOnly: ['label', 'button-name', 'color-contrast', 'aria-dialog-name'] })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })), selector)
        details.push({ name, violations })
        assert.deepEqual(violations, [])
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      }
      await audit('main', `social-error-${width}`)
      await page.screenshot({ path: resolve(output, `social-error-${width}.png`), fullPage: true })
      connected = true
      await page.getByTestId('social-load-error').getByRole('button', { name: 'Réessayer' }).click()
      await page.getByTestId('disconnect-youtube').click()
      await expect(page.getByTestId('cancel-disconnect')).toBeFocused()
      await page.waitForTimeout(700)
      await audit('[role=dialog]', `social-dialog-${width}`)
      await page.screenshot({ path: resolve(output, `social-dialog-${width}.png`), fullPage: true })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
  }
}
