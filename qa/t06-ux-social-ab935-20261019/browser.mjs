// Real browser, synthetic local session, all publication requests intercepted.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, webkit, expect } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { capabilitiesCases } from '../t07-modes-20261014/capabilities-fixtures.mjs'
import { enterTestSession } from '../t07-final-ux-perf-20261015/session.mjs'
import { nativeRuntimeControls } from '../t01-final-20261015/browser-harness/native-controls.mjs'
import { observeRuntimeErrors } from '../t01-final-20261015/browser-harness/runtime-guard.mjs'

const require = createRequire(import.meta.url)
const baseline = process.argv.includes('--baseline'), engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium'
const output = resolve('qa/t06-ux-social-ab935-20261019', process.argv.find(x => x.startsWith('--out='))?.slice(6) ?? (baseline ? 'before' : engine))
await mkdir(output, { recursive: true })
const fixture = await startFixture()
const id = '33333333-3333-4333-8333-333333333333'
fixture.state.videos = [{ id, user_id: fixture.user.id, title: 'Vidéo de démonstration sans publication', created_at: '2026-10-15T00:00:00Z', status: 'ready', quality: '720p', format: '9:16', duration: 5, video_url: fixture.url + '/media.mp4', script_data: null }]
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`, log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
const production = process.argv.includes('--production')
const checks = [], blocked = [], publications = [], axes = [], metrics = [], unexpectedWrites = []
let child, browser, runtimeSnapshot, engineControl, accountMode = 'normal', responseMode = 'unknown', reads = 0, capability = capabilitiesCases.find(([name]) => name === 'client')[1], capabilityReads = 0
const accounts = [
  { id: '11111111-1111-4111-8111-111111111111', platform: 'youtube', username: 'chaine-test', status: 'connected' },
  { id: '22222222-2222-4222-8222-222222222222', platform: 'instagram', username: 'profil-test', status: 'connected' },
  { id: '44444444-4444-4444-8444-444444444444', platform: 'x', username: 'compte-revoque', status: 'revoked' },
]
async function check(name, run) {
  try { await run(); checks.push({ name, status: 'PASS' }) }
  catch (error) { checks.push({ name, status: 'FAIL', error: String(error.message).slice(0, 1800) }) }
  process.stdout.write(`${checks.at(-1).status} ${name}\n`)
}
try {
  if (production) {
    const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { cwd: process.cwd(), env, stdio: ['ignore', log.fd, log.fd] })
    assert.equal((await once(build, 'exit'))[0], 0, 'isolated production build')
  }
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/login', { signal: AbortSignal.timeout(2500) })).ok) { ready = true; break } } catch { /* loopback startup */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'local fixture app ready')
  browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}) })
  engineControl = await nativeRuntimeControls(browser)
  await writeFile(resolve(output, 'native-engine.json'), JSON.stringify(engineControl, null, 2) + '\n')
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, timezoneId: 'Pacific/Honolulu', reducedMotion: 'reduce', locale: 'fr-FR' })
  const routeRequests = async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (url.pathname === '/api/legal/accept') return route.continue()
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
    if (url.pathname === '/api/social/accounts') {
      reads++
      if (accountMode === 'error') return route.fulfill({ status: 503, json: { error: 'fixture_private_token_never_display' } })
      if (accountMode === 'slow') await new Promise(done => setTimeout(done, 700))
      const list = accountMode === 'empty' ? [] : accountMode === 'expired' ? accounts.map(a => ({ ...a, token_expires_at: '2000-01-01T00:00:00Z' })) : accountMode === 'ambiguous' ? [accounts[0], { ...accounts[0], id: '55555555-5555-4555-8555-555555555555' }] : accounts
      return route.fulfill({ json: { accounts: list } })
    }
    if (url.pathname === '/api/social/publish') {
      publications.push(req.postDataJSON())
      if (responseMode === 'lost') return route.abort()
      if (responseMode === 'error') return route.fulfill({ status: 503, json: { error: 'fixture_private_token_never_display' } })
      const body = req.postDataJSON()
      assert.ok(body.platforms.every(platform => body.accountIds[platform] === accounts.find(a => a.platform === platform).id))
      assert.equal(body.platforms.length, new Set(body.platforms).size)
      if (responseMode === 'slow') await new Promise(done => setTimeout(done, 700))
      const platforms = responseMode === 'full-journal' ? ['youtube', 'instagram'] : body.platforms
      return route.fulfill({ status: 202, json: { results: platforms.map(platform => ({ platform, accountId: platform === 'youtube' ? '111111111111111111111111' : '222222222222222222222222', success: responseMode === 'partial' && platform === 'youtube', status: responseMode === 'full-journal' ? 'published' : responseMode === 'partial' ? platform === 'youtube' ? 'published' : 'failed' : responseMode === 'scheduled' ? 'scheduled' : 'unknown', error: responseMode === 'partial' && platform === 'instagram' ? 'fixture_private_token_never_display' : undefined })) } })
    }
    if (url.pathname === '/api/video/capabilities') { capabilityReads++; return route.fulfill({ json: capability.body }) }
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method())) unexpectedWrites.push({ method: req.method(), path: url.pathname })
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(req.method())) { blocked.push(url.pathname); return route.abort() }
    return route.continue()
  }
  await context.route('**/*', routeRequests)
  await context.addInitScript(() => { localStorage.setItem('sutra_intro_seen', '1'); localStorage.setItem('sutra_tutorial_dismissed', 'true') })
  const page = await context.newPage()
  runtimeSnapshot = await observeRuntimeErrors(page, { engine, nativeControl: engineControl, fixtureOrigin: fixture.url })
  await enterTestSession({ page, base, fixture })
  const trigger = page.getByTestId(`publish-everywhere-${id}`), modal = page.getByTestId('publish-everywhere-modal')
  const fresh = async () => { await page.goto(base + '/library'); await trigger.click(); await expect(page.getByTestId('publish-platform-youtube')).toBeEnabled(); await expect(page.getByTestId('publish-submit')).toBeVisible() }
  await fresh()
  await check('modal: named dialog, initial focus, focus trap, Escape and focus restoration', async () => {
    await expect(modal).toHaveAttribute('role', 'dialog', { timeout: 1500 })
    assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true)
    await page.getByTestId('publish-cancel').focus(); await page.keyboard.press('Tab')
    assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true)
    await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
  await fresh()
  await check('revoked account cannot be selected; unavailable accounts have accessible connect links', async () => {
    await expect(page.getByTestId('publish-platform-x')).toBeDisabled({ timeout: 1500 })
    assert.equal(await modal.locator('button a').count(), 0)
    await expect(modal.getByRole('link', { name: /connecter|comptes/i }).first()).toHaveAttribute('href', '/settings/social')
  })
  await page.getByTestId('schedule-later').click()
  await check('schedule: accessible name, selected state, browser IANA timezone and local minimum', async () => {
    await expect(page.getByTestId('scheduled-at-input')).toHaveAccessibleName(/date|heure/i, { timeout: 1500 })
    await expect(page.getByTestId('schedule-later')).toHaveAttribute('aria-pressed', 'true')
    const correctMin = await page.evaluate(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) })
    assert.equal(await page.getByTestId('scheduled-at-input').getAttribute('min'), correctMin)
    await expect(modal).toContainText('Pacific/Honolulu')
  })
  await page.getByTestId('caption-mode-custom').click()
  await page.getByTestId('custom-caption-input').fill('Brouillon conservé — jamais publié')
  const stableReads = reads
  for (const width of baseline ? [320, 768] : [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}px: publish modal fits, controls reachable, axe WCAG AA`, async () => {
      await page.waitForTimeout(300)
      const overflow = await modal.evaluate(el => ({ width: el.getBoundingClientRect().width, left: el.getBoundingClientRect().left, scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }))
      assert.ok(overflow.left >= 0 && overflow.width <= overflow.viewport && overflow.scroll <= overflow.client + 1, JSON.stringify(overflow))
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      const violations = await page.evaluate(async () => (await window.axe.run('[data-testid="publish-everywhere-modal"]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(n => n.target) })))
      axes.push({ width, violations })
      await page.getByTestId('scheduled-at-input').scrollIntoViewIfNeeded()
      await page.getByTestId('scheduled-at-input').focus()
      assert.equal(await page.getByTestId('scheduled-at-input').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }), true)
      await page.screenshot({ path: resolve(output, `publish-${width}.png`), fullPage: false })
      assert.deepEqual(violations, [])
      assert.equal(await page.getByTestId('scheduled-at-input').evaluate(el => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return top === el || el.contains(top) }), true, 'focused date is not covered by footer')
    })
  }
  if (process.argv.includes('--responsive-only')) {
    if (checks.some(item => item.status === 'FAIL')) process.exitCode = 1
  } else {
  await check('editing and resizing neither refetch accounts nor submit a draft', async () => {
    assert.equal(reads, stableReads); assert.equal(publications.length, 0)
    await page.getByTestId('scheduled-at-input').focus(); await page.keyboard.press('Shift+Tab')
    assert.equal(await modal.evaluate(el => el.contains(document.activeElement)), true)
  })
  for (const mode of ['unknown', 'lost', 'error']) {
    responseMode = mode
    await fresh(); await page.getByTestId('schedule-now').click()
    await page.getByTestId('publish-platform-youtube').click()
    await check(`${mode}: safe useful response, uncertain submission cannot be retried`, async () => {
      const before = publications.length
      await page.getByTestId('publish-submit').click()
      await expect.poll(() => publications.length).toBe(before + 1)
      await expect(page.getByTestId('publish-submit')).not.toHaveText('Publication...')
      await expect(page.getByTestId('publish-submit')).toBeDisabled({ timeout: 1500 })
      await expect(page.getByText('fixture_private_token_never_display', { exact: false })).toHaveCount(0)
      await expect(modal.getByRole('link', { name: /suivi|publication|historique/i })).toBeVisible()
    })
  }
  responseMode = 'partial'
  await fresh(); await page.getByTestId('schedule-now').click(); await page.getByTestId('publish-toggle-all').click()
  await check('partial: successful destinations retained, retry targets only failed destinations, no raw diagnostic', async () => {
    await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-result-youtube')).toContainText(/publi/i)
    await expect(page.getByText('fixture_private_token_never_display', { exact: false })).toHaveCount(0)
    await page.getByTestId('publish-submit').click()
    assert.deepEqual(publications.at(-1).platforms, ['instagram'])
    await expect(page.getByTestId('publish-result-youtube')).toBeVisible()
  })
  responseMode = 'lost'
  await check('partial retry response lost: previous success retained and uncertain account not retried', async () => {
    await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-submit')).toBeDisabled()
    await expect(page.getByTestId('publish-result-youtube')).toContainText('Publie', { timeout: 1500 })
    await expect(page.getByTestId('publish-result-instagram')).toContainText('A verifier')
  })
  await check('uncertain result survives close/reopen; reopening never resubmits', async () => {
    const sent = publications.length
    await page.getByTestId('publish-cancel').click(); await trigger.click()
    await expect(page.getByTestId('publish-result-youtube')).toContainText('Publie')
    await expect(page.getByTestId('publish-submit')).toBeDisabled()
    assert.equal(publications.length, sent)
  })
  responseMode = 'partial'
  await fresh(); await page.getByTestId('publish-toggle-all').click()
  await check('targeted retry accepts full journal without duplicating a successful account', async () => {
    await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-result-instagram')).toContainText('Echec')
    responseMode = 'full-journal'; await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-result-instagram')).toContainText('Publie')
    await expect(page.getByTestId('publish-result-youtube')).toHaveCount(1)
    await expect(page.getByTestId('publish-submit')).toBeDisabled()
    assert.deepEqual(publications.at(-1).platforms, ['instagram'])
  })
  for (const mode of ['empty', 'expired', 'ambiguous', 'error', 'slow']) {
    accountMode = mode
    await page.goto(base + '/library'); const before = reads; await trigger.click()
    await check(`accounts ${mode}: safe state, no phantom destination, bounded request`, async () => {
      await expect(page.getByTestId('publish-submit')).toBeDisabled()
      if (mode === 'slow') {
        await expect(modal.getByText('Vérification des comptes…')).toBeVisible()
        await expect(page.getByTestId('publish-platform-youtube')).toBeEnabled()
      } else if (mode === 'error') {
        await expect(modal.getByRole('alert')).toContainText('Impossible de vérifier')
        await expect(modal).not.toContainText('fixture_private_token_never_display')
        accountMode = 'normal'; await modal.getByRole('button', { name: 'Réessayer' }).click()
        await expect(page.getByTestId('publish-platform-youtube')).toBeEnabled()
      } else {
        await expect(modal).toContainText('Aucun compte connecté et disponible')
        await expect(page.getByTestId('publish-platform-youtube')).toBeDisabled()
      }
      assert.equal(reads - before, mode === 'error' ? 2 : 1)
    })
  }
  accountMode = 'normal'; await fresh(); await page.getByTestId('publish-platform-youtube').click()
  await check('draft cancel preserves text; empty caption and past date send nothing', async () => {
    const sent = publications.length
    await page.getByTestId('caption-mode-custom').click(); await page.getByTestId('custom-caption-input').fill('  ')
    await page.getByTestId('publish-submit').click(); await expect(modal.getByRole('alert')).toContainText('Ajoute une légende')
    await page.getByTestId('custom-caption-input').fill('Brouillon sans envoi')
    await page.getByTestId('publish-cancel').click(); await trigger.click()
    await expect(page.getByTestId('custom-caption-input')).toHaveValue('Brouillon sans envoi')
    await page.getByTestId('schedule-later').click(); await page.getByTestId('scheduled-at-input').fill('2000-01-01T10:00')
    await page.getByTestId('publish-submit').click(); await expect(modal.getByRole('alert')).toContainText('futures valides')
    assert.equal(publications.length, sent)
  })
  await check('Honolulu local time converts exactly to UTC; scheduled is not published', async () => {
    responseMode = 'scheduled'
    await page.getByTestId('scheduled-at-input').fill('2027-05-01T12:00'); await page.getByTestId('publish-submit').click()
    await expect(page.getByTestId('publish-result-youtube')).toContainText('Programme')
    assert.equal(publications.at(-1).scheduledAt, '2027-05-01T22:00:00.000Z')
    await expect(page.getByTestId('publish-submit')).toBeDisabled()
  })
  const parisContext = await browser.newContext({ storageState: await context.storageState(), timezoneId: 'Europe/Paris', locale: 'fr-FR', viewport: { width: 375, height: 900 } })
  await parisContext.route('**/*', routeRequests)
  const paris = await parisContext.newPage()
  await paris.goto(base + '/library'); await paris.getByTestId(`publish-everywhere-${id}`).click()
  await expect(paris.getByTestId('publish-platform-youtube')).toBeEnabled()
  await paris.getByTestId('publish-platform-youtube').click(); await paris.getByTestId('schedule-later').click()
  await check('Paris DST gap rejected; autumn fold displays and sends chosen UTC offset', async () => {
    const sent = publications.length, dialog = paris.getByTestId('publish-everywhere-modal')
    await paris.getByTestId('scheduled-at-input').fill('2027-03-28T02:30'); await paris.getByTestId('publish-submit').click()
    await expect(dialog.getByRole('alert')).toContainText('changement d’heure'); assert.equal(publications.length, sent)
    await paris.getByTestId('scheduled-at-input').fill('2027-10-31T02:30')
    await expect(dialog).toContainText('UTC+02:00')
    await paris.getByTestId('publish-submit').click()
    await expect(paris.getByTestId('publish-result-youtube')).toContainText('Programme')
    assert.equal(publications.at(-1).scheduledAt, '2027-10-31T00:30:00.000Z')
  })
  await parisContext.close()
  responseMode = 'slow'; await fresh(); await page.getByTestId('publish-platform-youtube').click()
  await check('rapid double click sends one request and cannot dismiss an in-flight submission', async () => {
    const sent = publications.length
    await page.getByTestId('publish-submit').evaluate(button => { button.click(); button.click() })
    await page.keyboard.press('Escape'); await expect(modal).toBeVisible()
    await expect(page.getByTestId('publish-cancel')).toBeDisabled()
    await expect(page.getByTestId('publish-result-youtube')).toContainText('A verifier')
    assert.equal(publications.length, sent + 1)
  })
  for (const mode of ['client', 'unavailable', 'ready']) {
    const scenario = capabilitiesCases.find(([name]) => name === mode); capability = scenario[1]
    await page.setViewportSize({ width: mode === 'ready' ? 1440 : 375, height: 900 })
    const start = performance.now(), before = capabilityReads
    await page.goto(base + '/create')
    await check(`creation mode ${mode}: visible distinction, costs and no automatic generation`, async () => {
      const notice = page.getByRole('complementary', { name: 'Modes de génération' })
      await expect(notice).toContainText(scenario[2])
      await notice.locator('summary').focus(); await page.keyboard.press('Enter')
      await expect(notice).toContainText('Personnel open source distant')
      await expect(notice).toContainText('API client')
      await expect(notice).not.toContainText('fixture-private-reason-never-display')
      assert.equal(capabilityReads - before, 1)
      metrics.push({ name: mode, navigationToNoticeMs: Math.round(performance.now() - start) })
      await page.waitForTimeout(700) // Wait for existing page entrance animation before visual proof.
      await page.screenshot({ path: resolve(output, `mode-${mode}.png`) })
    })
  }
  await check('runtime: no hydration/client error and no unmocked publication', async () => {
    assert.deepEqual(runtimeSnapshot().unexpected, [])
    assert.deepEqual(blocked, [])
    assert.deepEqual(unexpectedWrites, [])
    assert.ok(publications.every(body => body.videoId === id))
  })
  }
} finally {
  const runtime = runtimeSnapshot?.() ?? { errors: [], qualified: [], unexpected: [] }
  await writeFile(resolve(output, 'runtime-errors.json'), JSON.stringify(runtime, null, 2) + '\n')
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseCandidate: 'ab935e59ca4e39776630f05b2ba6c0422c74ec62', engine, production, baseline, observedAt: new Date().toISOString(), checks, metrics, axes, errors: runtime.errors, qualified: runtime.qualified, unexpected: runtime.unexpected, blocked, unexpectedWrites, accountReads: reads, publications, realPublications: 0 }, null, 2) + '\n')
  await browser?.close()
  if (child && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections(); await new Promise(done => fixture.server.close(done)); await log.close()
}
if (checks.some(item => item.status === 'FAIL')) process.exitCode = 1
