import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { expect } from '@playwright/test'
const require = createRequire(import.meta.url)

export async function finalChecks({ page, context, base, fixture, output, check, details, keyboardKey }) {
  const authCalls = []
  let mode = 'failure'
  await context.route('**/auth/v1/{signup,token}**', async route => {
    authCalls.push({ path: new URL(route.request().url()).pathname, at: performance.now() })
    if (mode === 'interrupt') return route.abort('connectionreset')
    if (mode === 'success') return route.fulfill({ json: { user: fixture.user, session: null } })
    await new Promise(done => setTimeout(done, 350))
    await route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' } })
  })
  for (const path of ['signup', 'login']) {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${base}/${path}`, { waitUntil: 'domcontentloaded' })
      if (path === 'signup' && width === 375) {
        await page.getByTestId('cookie-refuse').click()
        await expect(page.getByTestId('cookie-refuse')).toHaveCount(0)
      }
      const submit = page.getByTestId(`${path}-button`)
      await expect(submit).toBeEnabled()
      if (path === 'signup') await page.getByTestId('name-input').fill('Test UX')
      await page.getByTestId('email-input').fill('ux-test@example.invalid')
      await page.getByTestId('password-input').fill('Fixture-pass-123!')
      await check(`${path} ${width}: password visibility reachable by keyboard`, async () => {
        await page.getByTestId('password-input').focus()
        assert.ok(['Tab', 'Alt+Tab'].includes(keyboardKey), 'keyboard calibrated on native HTML')
        await page.keyboard.press(keyboardKey)
        await expect(page.getByRole('button', { name: 'Afficher le mot de passe' })).toBeFocused()
        await page.keyboard.press('Space')
        await expect(page.getByTestId('password-input')).toHaveAttribute('type', 'text')
        await expect(page.getByRole('button', { name: 'Masquer le mot de passe' })).toHaveAttribute('aria-pressed', 'true')
        await page.keyboard.press('Space')
      })
      await check(`${path} ${width}: duplicate form submission produces one auth request`, async () => {
        const before = authCalls.length, start = performance.now()
        await submit.evaluate(button => { button.form.requestSubmit(); button.form.requestSubmit() })
        await expect(submit).toBeDisabled()
        await expect(submit).toBeEnabled({ timeout: 15000 })
        await page.waitForTimeout(800)
        const calls = authCalls.length - before
        details.push({ name: `${path}-${width}-double-submit`, calls, recoveryMs: Math.round(performance.now() - start) })
        assert.equal(calls, 1)
      })
      await check(`${path} ${width}: API rejection remains visible and retry available`, async () => {
        await expect(page.locator('[data-sonner-toast]').first()).toBeVisible()
        await expect(submit).toBeEnabled()
        await expect(page.getByTestId('email-input')).toHaveValue('ux-test@example.invalid')
      })
      await check(`${path} ${width}: interrupted network releases loading and preserves retry`, async () => {
        mode = 'interrupt'
        const before = authCalls.length
        await submit.click()
        await expect(submit).toBeEnabled({ timeout: 12000 })
        await expect(page.locator('[data-sonner-toast]').first()).toBeVisible()
        await expect(page.getByTestId('email-input')).toHaveValue('ux-test@example.invalid')
        assert.equal(authCalls.length - before, 1)
        mode = 'failure'
        await submit.click()
        await expect(submit).toBeEnabled({ timeout: 12000 })
        assert.equal(authCalls.length - before, 2)
      })
      await check(`${path} ${width}: labels, contrast and no horizontal overflow`, async () => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
        const violations = await page.evaluate(async () => (await window.axe.run(document.querySelector('form'), { runOnly: ['label', 'button-name', 'color-contrast', 'aria-valid-attr-value'] })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })))
        details.push({ name: `${path}-${width}-axe`, violations })
        assert.deepEqual(violations, [])
      })
      await page.screenshot({ path: resolve(output, `${path}-${width}.png`), fullPage: true })
      details.push(await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0]
        const resources = performance.getEntriesByType('resource')
        return { name: 'local-page-metrics', path: location.pathname, width: innerWidth, responseMs: Math.round(nav.responseEnd - nav.startTime), domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime), resourceCount: resources.length, transferredBytes: resources.reduce((sum, r) => sum + r.transferSize, 0), decodedBytes: resources.reduce((sum, r) => sum + r.decodedBodySize, 0) }
      }))
    }
  }
  await check('signup: confirmation and legal notice use a synthetic identity only', async () => {
    await page.goto(base + '/signup')
    await page.getByTestId('name-input').fill('Test UX')
    await page.getByTestId('email-input').fill('ux-test@example.invalid')
    await page.getByTestId('password-input').fill('Fixture-pass-123!')
    await expect(page.getByRole('link', { name: 'CGU', exact: true })).toHaveAttribute('href', '/cgu')
    mode = 'success'
    await page.getByTestId('signup-button').click()
    await expect(page.getByRole('heading', { name: 'Verifie ton email' })).toBeVisible()
    await expect(page.getByText('ux-test@example.invalid', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Retour a la connexion' }).click()
    await expect(page.getByTestId('login-button')).toBeVisible()
    // An unconfirmed identity cannot gain access through this test.
    assert.equal(fixture.state.acceptances.length, 0)
  })
}
