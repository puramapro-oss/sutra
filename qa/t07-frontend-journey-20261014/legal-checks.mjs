import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { expect } from '@playwright/test'
const require = createRequire(import.meta.url)

export async function legalChecks({ page, context, base, fixture, output, baseline, check, details }) {
  await page.goto(base + '/login?next=/library')
  await page.getByTestId('cookie-refuse').click()
  await page.getByTestId('email-input').fill(fixture.user.email)
  await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  const heading = page.getByRole('heading', { name: 'Mise à jour de nos conditions' })
  await expect(heading).toBeVisible({ timeout: 60000 })
  const accept = page.getByRole('button', { name: "J’ai lu, je continue".replace('’', "'") })
  const link = page.getByRole('link', { name: /Lire «/ })
  await check('unaccepted test identity sees gate and no implicit acceptance', async () => assert.equal(fixture.state.writes.length, 0))
  await check('mentions link opens actual legal document (HTTP 200)', async () => {
    const href = await link.getAttribute('href')
    const document = await context.newPage()
    const response = await document.goto(base + href)
    const status = response.status(); details.push({ name: 'mentions route', href, status })
    await document.close(); assert.equal(status, 200)
  })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: modal semantics and initial focus`, async () => {
      await expect(page.getByRole('dialog', { name: 'Mise à jour de nos conditions' })).toBeVisible()
      assert.equal(await heading.evaluate(h => h.parentElement.contains(document.activeElement)), true)
    })
    await check(`${width}: keyboard remains in consent without dismissing on Escape`, async () => {
      await accept.focus()
      await page.keyboard.press('Tab')
      assert.equal(await link.evaluate(a => a === document.activeElement), true)
      await page.keyboard.press('Shift+Tab'); await expect(accept).toBeFocused()
      await page.keyboard.press('Escape'); await expect(heading).toBeVisible()
    })
    await page.screenshot({ path: resolve(output, `legal-${width}.png`), fullPage: false })
    await check(`${width}: no horizontal overflow`, async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true))
  }
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  for (const theme of ['dark', 'light', 'oled']) {
    await page.evaluate(theme => {
      document.documentElement.classList.remove('theme-light', 'theme-oled')
      if (theme !== 'dark') document.documentElement.classList.add(`theme-${theme}`)
    }, theme)
    await page.waitForTimeout(350)
    await check(`consent contrast ${theme}`, async () => {
      const violations = await heading.evaluate(async h => (await window.axe.run(h.parentElement, { runOnly: ['color-contrast'] })).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })))
      details.push({ name: `contrast-${theme}`, violations }); assert.deepEqual(violations, [])
    })
  }
  await page.evaluate(() => document.documentElement.classList.remove('theme-light', 'theme-oled'))
  fixture.state.legalMode = 'error'
  await check('failed acceptance retains document and retry; no grant persisted', async () => {
    await accept.click()
    await expect(page.getByText("L'enregistrement a échoué, réessaie.")).toBeVisible({ timeout: 15000 })
    await expect(accept).toBeEnabled(); await expect(link).toContainText('Mentions légales')
    assert.equal(fixture.state.acceptances.length, 0)
  })
  fixture.state.legalMode = 'normal'
  await check('four explicit acceptances persist through actual local API and reload', async () => {
    for (const doc of ['mentions', 'cgu', 'cgv', 'confidentialite']) {
      const before = fixture.state.writes.length
      await accept.click()
      await expect.poll(() => fixture.state.acceptances.some(a => a.doc_type === doc)).toBe(true)
      assert.equal(fixture.state.writes.length - before, 1)
      if (doc !== 'confidentialite') await expect(accept).toBeEnabled()
    }
    await expect(heading).toHaveCount(0)
    assert.deepEqual(fixture.state.acceptances.map(({ user_id, doc_type, version }) => ({ user_id, doc_type, version })), ['mentions','cgu','cgv','confidentialite'].map(doc_type => ({ user_id: fixture.user.id, doc_type, version: '1.0' })))
    await page.reload(); await expect(page.getByTestId('empty-library')).toBeVisible()
    await expect(heading).toHaveCount(0)
  })
  // The failed request below never reaches the backend. It models a lost/stalled response.
  fixture.state.acceptances = []
  await page.reload(); await expect(heading).toBeVisible()
  let stalled = false
  await context.route('**/api/legal/accept', async route => {
    if (!stalled) { stalled = true; await new Promise(done => setTimeout(done, 17000)); await route.fulfill({ status: 503, json: { error: 'fixture_timeout' } }).catch(() => {}); return }
    await route.fallback()
  })
  await check('stalled consent recovers within 12 seconds and never advances', async () => {
    const start = performance.now()
    await accept.click()
    await expect(page.getByText("L'enregistrement a échoué, réessaie.")).toBeVisible({ timeout: 12000 })
    details.push({ name: 'stalled response recovery', elapsedMs: Math.round(performance.now() - start) })
    await expect(accept).toBeEnabled(); await expect(link).toContainText('Mentions légales')
    assert.equal(fixture.state.acceptances.length, 0)
  })
  if (baseline) details.push({ name: 'baseline only', journey: 'not attempted until gate defects are corrected' })
}
