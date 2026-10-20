// Owner-routed T07 regression only. Derived from T06 pages harness; no live APIs.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, open, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { enterTestSession } from '../t07-final-ux-perf-20261015/session.mjs'
import { capabilitiesCases } from '../t07-modes-20261014/capabilities-fixtures.mjs'

const require = createRequire(import.meta.url)
const phase = process.argv[2]
assert.ok(/^[a-z0-9-]+$/.test(phase || ''), 'unique evidence label required')
const output = resolve(`qa/t07-ui-fcd-20261020/${phase}`)
const partnerSuccess = phase === 'after-partner-success'
const analyticsBalance = phase.startsWith('after-analytics-balance')
let syntheticBalance = 40
const harnessSha256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')
await mkdir(output)
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const sourcePatchSha256 = createHash('sha256').update(execFileSync('git', ['diff', '--', 'src'])).digest('hex')
const sourceChanges = execFileSync('git', ['diff', '--name-only', '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
const routing = JSON.parse(await readFile(resolve('qa/t07-ui-fcd-20261020/owner-routing.json'), 'utf8'))
const selected = process.argv.slice(3)
const paths = routing.ownership.T07.map(file => ({file, route:routing.pages[file].route}))
  .filter(row => !selected.length || selected.includes(row.route))
const inventory = paths
const core = []
const fixture = await startFixture()
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const environment = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base,
}
const results = [], errors = [], blocked = [], writes = [], apiReads = [], interactions = []
let child, browser
try {
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
    { cwd: process.cwd(), env: environment, detached: true, stdio: ['ignore', log.fd, log.fd] })
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/login', { signal: AbortSignal.timeout(2500) })).ok) { ready = true; break } } catch { /* own loopback boot */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'owned development server ready')
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce', locale: 'fr-FR' })
  context.setDefaultTimeout(10000)
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === fixture.url) {
      if (analyticsBalance && url.pathname === '/rest/v1/profiles') {
        const response = await route.fetch(), original = await response.json()
        const decorate = row => ({ ...row, credits: syntheticBalance })
        return route.fulfill({ response, json: Array.isArray(original) ? original.map(decorate) : decorate(original) })
      }
      if (partnerSuccess && url.pathname === '/rest/v1/profiles') {
        const response = await route.fetch(), original = await response.json()
        const decorate = row => ({ ...row, referral_code: 'TEST PARTNER' })
        return route.fulfill({ response, json: Array.isArray(original) ? original.map(decorate) : decorate(original) })
      }
      return route.continue()
    }
    if (url.origin !== base) { blocked.push({ origin: url.origin, path: url.pathname }); return route.abort() }
    if (url.pathname === '/api/legal/accept') return route.continue()
    // Test cookie refusal is explicit in enterTestSession, not a publication.
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push({ method: request.method(), path: url.pathname })
        return route.fulfill({ status: 503, json: { error: 'Service indisponible dans cette simulation.' } })
      }
      apiReads.push(url.pathname)
      if (partnerSuccess && url.pathname === '/api/partner/stats') return route.fulfill({ json: {
        partner_code: 'TEST PARTNER', share_url: 'https://canonical.example.invalid/scan/approved-test',
        total_referrals: 0, total_commissions: 0, balance: 0, tier: 'Bronze', pending_commissions: 0,
        monthly_graph: [], recent_referrals: [],
      } })
      if (url.pathname === '/api/video/capabilities') return route.fulfill({ json: capabilitiesCases[0][1].body })
      if (url.pathname === '/api/social/accounts') return route.fulfill({ json: { accounts: [] } })
      if (url.pathname === '/api/social/autopilot') return route.fulfill({ json: { config: { enabled: false, default_platforms: [], auto_caption: true, auto_hashtags: true, caption_style: 'engaging', max_hashtags: 10, include_cta: true } } })
      return route.fulfill({ status: 503, json: { error: 'Service indisponible dans cette simulation.' } })
    }
    if (!['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/__nextjs')) {
      writes.push({ method: request.method(), path: url.pathname }); return route.abort()
    }
    return route.continue()
  })
  await context.addInitScript(() => {
    localStorage.setItem('sutra_intro_seen', '1')
    localStorage.setItem('sutra_tutorial_dismissed', 'true')
  })
  const login = await context.newPage()
  await enterTestSession({ page: login, base, fixture })
  await login.close()
  for (const entry of paths) {
    const page = await context.newPage()
    page.on('pageerror', error => errors.push({ route: entry.route, type: 'pageerror', message: error.message }))
    page.on('console', message => {
      if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text()))
        errors.push({ route: entry.route, type: 'hydration', message: message.text() })
    })
    const routeReadsStart = apiReads.length
    try {
      const navigationStarted = performance.now()
      const response = await page.goto(base + entry.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
      const navigationMs = Math.round(performance.now() - navigationStarted)
      await page.locator('body').waitFor()
      await page.waitForTimeout(850)
      const actual = new URL(page.url()).pathname
      if (actual !== entry.route) {
        results.push({ ...entry, status: 'REDIRECT', actual, http: response?.status(),
          scope: 'non-admin synthetic session; destination recorded, source page not visually certified' })
        continue
      }
      {
        await expect.poll(async () => (await page.locator('body').innerText()).length, { timeout: 10000 }).toBeGreaterThan(50)
        await page.waitForTimeout(1800)
      }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      for (const width of core.includes(entry.route) ? [320, 375, 768, 1280, 1440] : [375, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(250)
        if (phase.startsWith('after') && entry.route === '/partenariat') {
          // Focus/resize reveals motion cards. Wait for their actual final opacity before measuring contrast.
          for (const channel of await page.locator('[data-testid^="channel-"]').all()) {
            await channel.scrollIntoViewIfNeeded()
            await expect.poll(() => channel.evaluate(el => Number(getComputedStyle(el.parentElement).opacity))).toBe(1)
          }
        }
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, scroll: document.documentElement.scrollWidth,
          headings: [...document.querySelectorAll('h1')].map(el => el.textContent),
          textLength: document.body.innerText.length,
          applicationError: /Application error: a client-side exception/.test(document.body.innerText),
        }))
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        })).violations.map(({ id, impact, nodes }) => ({
          id, impact, count: nodes.length, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary, html: node.html })),
        })))
        const status = response.status() === 200 && layout.scroll <= width + 1 && !layout.applicationError
          && layout.textLength > 50 && violations.length === 0 ? 'PASS' : 'FAIL'
        const row = { ...entry, width, status, http: response.status(), navigationMs, layout, violations }
        results.push(row)
        if ([375, 1440].includes(width)) {
          row.capture = entry.route.replaceAll('/', '_') + `-${width}.png`
          await page.screenshot({ path: resolve(output, row.capture), fullPage: false })
        }
        process.stdout.write(`${status} ${width} ${entry.route}\n`)
        if (phase.startsWith('after')) {
          const check = async (name, action) => {
            try { await action(); interactions.push({ route: entry.route, width, name, status: 'PASS' }) }
            catch (error) { interactions.push({ route: entry.route, width, name, status: 'FAIL', error: error.message }) }
          }
          if (entry.route === '/batch') await check('Four named selects usable by keyboard without submitting', async () => {
            for (const name of ['Format', 'Qualite', 'Voix', 'Moteur video']) {
              const control = page.getByRole('combobox', { name, exact: true })
              await control.focus(); await expect(control).toBeFocused()
              await control.press('ArrowDown'); await control.press('Escape')
              await expect(control).toBeEnabled()
            }
          })
          if (analyticsBalance && entry.route === '/analytics') await check('Empty history with balance 40 then 43 shows balance, never consumption', async () => {
            for (const balance of [40, 43]) {
              syntheticBalance = balance
              await page.reload({ waitUntil: 'domcontentloaded' })
              await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
              const card = page.getByTestId('kpi-credits')
              await expect(card).toContainText('Solde de crédits')
              await expect(page.getByTestId('kpi-credits-value')).toHaveText(String(balance))
              await expect(card).not.toContainText(/utilis|consomm/i)
              await expect(page.getByTestId('kpi-videos-month-value')).toHaveText('0')
              await page.screenshot({ path: resolve(output, `analytics-balance-${balance}-${width}.png`) })
            }
          })
          if (entry.route === '/settings/notifications') await check('Unavailable persistence stated; no false save, no settings request', async () => {
            await expect(page.getByRole('status')).toContainText('Aucun réglage')
            await expect(page.getByRole('button', { name: 'Sauvegarder' })).toBeDisabled()
            await expect(page.getByText('Preferences sauvegardees', { exact: true })).toHaveCount(0)
            const back = page.getByRole('link', { name: 'Retour aux réglages' })
            await back.focus(); await expect(back).toBeFocused()
            assert.equal(apiReads.slice(routeReadsStart).filter(path => path === '/api/settings').length, 0)
          })
          if (entry.route.startsWith('/partenaire') && entry.route !== '/partenaire/coach' && !partnerSuccess) await check('Missing partner code is unavailable, not an invalid copy or stuck loading', async () => {
            const copy = page.getByTestId(entry.route === '/partenaire' ? 'action-copy-link' : 'copy-partner-link')
            await expect(copy).toBeDisabled()
            await expect(page.getByText('Lien partenaire indisponible', { exact: true }).first()).toBeVisible()
            if (entry.route.endsWith('/outils')) await expect(page.getByTestId('copy-utm-link')).toBeDisabled()
          })
          if (partnerSuccess && entry.route.startsWith('/partenaire')) await check('Valid code/authoritative URL copied, UTM encoded, repeat click safe', async () => {
            await page.evaluate(() => { window.__copiedLinks = []; Object.defineProperty(navigator, 'clipboard', {
              configurable: true, value: { writeText: async text => { window.__copiedLinks.push(text) } },
            }) })
            const tools = entry.route.endsWith('/outils')
            const expected = tools ? `${base}/scan/TEST%20PARTNER` : 'https://canonical.example.invalid/scan/approved-test'
            const button = page.getByTestId(tools ? 'copy-partner-link' : 'action-copy-link')
            await expect(button).toBeEnabled(); await button.dblclick()
            await expect.poll(() => page.evaluate(() => window.__copiedLinks)).toEqual([expected, expected])
            if (tools) {
              await page.getByTestId('utm-source').fill('email & test')
              await page.getByTestId('copy-utm-link').click()
              await expect.poll(() => page.evaluate(() => window.__copiedLinks.at(-1)))
                .toBe(`${expected}?utm_source=email+%26+test`)
            }
          })
          if (entry.route.startsWith('/chat/')) await check('Named message region and send control', async () => {
            const region = page.getByRole('region', { name: 'Messages de la conversation' })
            await region.focus(); await expect(region).toBeFocused()
            await expect(page.getByRole('button', { name: 'Envoyer le message', exact: true })).toHaveCount(1)
          })
          if (entry.route === '/legal/cookies') await check('Cookie tables keyboard focus', async () => {
            for (const region of await page.getByRole('region', { name: 'Tableau des cookies' }).all()) {
              await region.focus(); await expect(region).toBeFocused()
              await region.press('ArrowRight')
            }
          })
          if (entry.route === '/partenariat') await check('Named referrals slider changes by keyboard', async () => {
            const slider = page.getByRole('slider', { name: 'Nombre de filleuls' })
            const before = await slider.inputValue(); await slider.focus(); await slider.press('ArrowRight')
            assert.notEqual(await slider.inputValue(), before)
          })
        }
      }
      if (phase === 'interaction-before' && entry.route === '/settings/notifications') {
        const save = page.getByRole('button', { name: 'Sauvegarder' })
        const writesBefore = writes.length
        await save.click()
        await page.waitForTimeout(100)
        interactions.push({
          route: entry.route,
          defect: 'Save claims persistence without a request',
          successToast: await page.getByText('Preferences sauvegardees', { exact: true }).count(),
          requestsAfterSave: writes.slice(writesBefore),
        })
        await page.screenshot({ path: resolve(output, 'notification-false-success.png') })
      }
    } catch (error) {
      results.push({ ...entry, status: 'FAIL', error: String(error.message).slice(0, 1500) })
      process.stdout.write(`FAIL navigation ${entry.route}\n`)
    } finally {
      await page.close()
      await writeFile(resolve(output, 'results.json'), JSON.stringify({ candidate, harnessSha256, sourceChanges, sourcePatchSha256, mode: 'development, local synthetic session, unknown APIs503',
        inventory, selectedRoutes: paths, results, errors, blocked, writes, apiReads, interactions, realConnections: 0, realPublications: 0 }, null, 2) + '\n')
    }
  }
  await context.close()
} finally {
  await browser?.close()
  if (child?.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections()
  await new Promise(done => fixture.server.close(done))
  await log.close()
}
process.exitCode = results.some(row => row.status === 'FAIL') || interactions.some(row => row.status === 'FAIL') || errors.length || writes.length ? 1 : 0
