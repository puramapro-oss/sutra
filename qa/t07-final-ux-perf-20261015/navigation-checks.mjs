import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { enterTestSession } from './session.mjs'

export async function navigationChecks({ page, base, fixture, check, details, runtimeSnapshot }) {
  const errors = [], failed = []
  let phase = 'login-consent'
  page.on('pageerror', error => errors.push({ phase, message: error.message, stack: error.stack, time: Date.now() }))
  page.on('requestfailed', request => failed.push({ phase, path: new URL(request.url()).pathname, rsc: new URL(request.url()).searchParams.has('_rsc'), reason: request.failure()?.errorText, time: Date.now() }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterTestSession({ page, base, fixture })
  await page.waitForLoadState('networkidle')
  await check('settled library has no runtime errors', async () => {
    phase = 'settled-library'
    const start = errors.length
    await page.waitForTimeout(2000)
    assert.equal(errors.length, start)
  })
  await check('normal client navigation library to create to library has no runtime errors', async () => {
    phase = 'client-navigation'
    const start = errors.length
    await page.getByTestId('library-create-btn').click()
    await expect(page.getByTestId('topic-input')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.locator('a[href="/library"]').first().click()
    await expect(page.getByTestId('library-create-btn')).toBeVisible()
    await page.waitForLoadState('networkidle')
    assert.equal(errors.length, start)
  })
  phase = 'hard-navigation-control'
  await page.goto(base + '/settings/social')
  await page.goto(base + '/auto/schedules')
  await page.waitForTimeout(2000)
  await check('forced document navigation retains errors and qualifies only native teardown diagnostics', async () => {
    const runtime = runtimeSnapshot()
    assert.deepEqual(runtime.unexpected, [])
    details.push({ name: 'forced-navigation-engine-diagnostics', qualified: runtime.qualified, unexpected: runtime.unexpected })
  })
  details.push({ name: 'navigation-error-diagnostics', errors, failed })
}
