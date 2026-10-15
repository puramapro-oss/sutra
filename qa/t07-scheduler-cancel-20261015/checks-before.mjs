import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

export async function checks({ page, context, base, check, details }) {
  let writes = 0
  await context.route('**/api/auto/config', async route => {
    if (route.request().method() === 'PATCH') { writes++; await new Promise(done => setTimeout(done, 300)) }
    return route.fulfill({ json: { config: { is_active: writes > 0, schedules: [{ id: 'fixture-schedule', name: 'Fixture', frequency: 'daily', time: '09:00', timezone: 'Europe/Paris' }], auto_publish: false, require_approval_before_publish: true } } })
  })
  await context.route('**/api/auto/videos*', route => route.fulfill({ json: { videos: [] } }))
  for (const width of [375, 1440]) {
    writes = 0
    await page.setViewportSize({ width, height: 900 })
    await page.goto(base + '/auto')
    const button = page.getByTestId('auto-toggle')
    await expect(button).toBeEnabled()
    await button.evaluate(b => { b.click(); b.click() })
    await page.waitForTimeout(750)
    await check(`${width}: scheduler double click sends one explicit preference`, async () => {
      details.push({ width, calls: writes }); assert.equal(writes, 1)
    })
    await check(`${width}: saved preference never claims running scheduler`, async () => {
      await expect(page.getByText('SUTRA produit selon ton planning.', { exact: true })).toHaveCount(0)
    })
    await page.goto(base + '/production')
    await check(`${width}: production exposes durable request cancellation`, async () => {
      await expect(page.getByTestId('production-request-status')).toBeVisible({ timeout: 2000 })
    })
  }
}
