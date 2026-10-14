// Targeted UI evidence only. Every generation response is intercepted in Chromium.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'
import { generationErrorCases, socialAccounts } from './generation-fixtures.mjs'
import { capabilitiesCases } from './capabilities-fixtures.mjs'

const require = createRequire(import.meta.url), socialOnly = process.argv.includes('--social-only')
const capabilitiesOnly = process.argv.includes('--capabilities-only')
const visualOnly = process.argv.includes('--visual-only')
const output = resolve('qa/t07-modes-20261014/evidence', socialOnly ? 'social' : capabilitiesOnly ? visualOnly ? 'capabilities-visual' : 'capabilities' : '')
await mkdir(output, { recursive: true })
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'studio-test@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { name: 'Studio Test' }, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })).toString('base64url')}.fixture-signature`
const profile = { id: user.id, email: user.email, name: 'Studio Test', plan: 'creator', credits: 40, monthly_video_count: 0, is_admin: false, tutorial_completed: true, brand_kit: null }
const fixture = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const path = new URL(req.url, 'http://fixture.invalid').pathname
  const send = value => res.end(JSON.stringify(value))
  if (path === '/auth/v1/token') return send({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user })
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return send({ error: 'fixture_read_only' }) }
  if (path === '/auth/v1/user') return send(user)
  if (path === '/rest/v1/profiles') return send(req.headers.accept?.includes('object+json') ? profile : [profile])
  if (path === '/rest/v1/legal_acceptances') return send(['mentions', 'cgu', 'cgv', 'confidentialite'].map(doc_type => ({ doc_type, version: '1.0' })))
  res.setHeader('Content-Range', '0-0/0')
  return send(req.headers.accept?.includes('object+json') ? null : [])
})
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening')
const fixtureURL = `http://127.0.0.1:${fixture.address().port}`
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`,
  NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: fixtureURL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_fixture',
  RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base,
}
let child, childExit, browser, releaseResponse
let responseMode = 'worker'
let capabilitiesFixture = { status: 404, body: { error: 'fixture_route_not_integrated' } }
const capabilitiesRequests = []

const results = [], errors = [], violations = [], intercepted = [], blocked = [], socialRequests = []

async function check(name, run) { await run(); results.push(name); process.stdout.write(`PASS ${name}\n`) }
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document fits viewport')
  const clipped = await page.locator('button, input, textarea, select, summary').evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect()
    return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1) && getComputedStyle(node).visibility !== 'hidden'
  }).map(node => node.getAttribute('data-testid') || node.textContent?.slice(0, 50)))
  assert.deepEqual(clipped, [], 'controls fit viewport')
}
async function axe(page, name) {
  await page.waitForTimeout(650)
  await noOverflow(page)
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })))
  violations.push({ name, violations: found })
  assert.deepEqual(found, [], `axe ${name}`)
}
try {
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  child.once('exit', (code, signal) => { childExit = { code, signal } })
  let ready = false
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break } } catch { /* Local server booting. */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'fixture app ready')
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', locale: 'fr-FR' })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === fixtureURL) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/video/capabilities') {
        capabilitiesRequests.push({ method: request.method(), path: url.pathname, search: url.search })
        const fixture = capabilitiesFixture
        if (fixture.delay) await new Promise(done => setTimeout(done, fixture.delay))
        return route.fulfill({ status: fixture.status ?? 200, ...(fixture.raw ? { body: fixture.raw, contentType: 'application/json' } : { json: fixture.body }) }).catch(() => {})
      }
      if (socialOnly && url.pathname === '/api/social/accounts') {
        if (request.method() === 'DELETE') {
          socialRequests.push({ path: url.pathname, method: request.method() })
          socialAccounts[0].status = 'revoked'
          return route.fulfill({ status: 202, json: { success: false, status: 'revoked', remoteStatus: 'unconfirmed' } })
        }
        return route.fulfill({ json: { accounts: socialAccounts, autopilot: null } })
      }
      if (socialOnly && url.pathname === '/api/social/connect') {
        socialRequests.push({ path: url.pathname, method: request.method() })
        return route.fulfill({ status: 503, json: { error: 'fixture_no_oauth' } })
      }
      if (['/api/create', '/api/production'].includes(url.pathname)) {
        intercepted.push({ path: url.pathname, method: request.method(), mode: responseMode, body: request.postDataJSON() })
        if (responseMode === 'waiting') await new Promise(done => { releaseResponse = done })
        const error = generationErrorCases[responseMode].error
        return route.fulfill({ status: responseMode === 'quota' ? 402 : 503, json: { error } })
      }
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort()
    return route.continue()
  })
  await context.addInitScript(() => {
    localStorage.setItem('purama_cookie_consent_v1', JSON.stringify({ necessaire: true, mesure: false, marketing: false, updatedAt: new Date().toISOString() }))
    localStorage.setItem('sutra_intro_seen', '1'); localStorage.setItem('sutra_tutorial_dismissed', 'true')
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) errors.push(message.text()) })
  await page.goto(`${base}/login`)
  await page.getByTestId('email-input').fill(user.email)
  await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  await expect(page.getByTestId('header')).toBeVisible({ timeout: 30000 })

  for (const width of socialOnly || capabilitiesOnly || process.argv.includes('--errors-only') ? [] : [320, 375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/create', '/production']) {
      await check(`${width}px ${path}: modes, keyboard, budget, unknown readiness, axe and layout`, async () => {
        await page.goto(base + path, { waitUntil: 'networkidle' })
        const notice = page.getByRole('complementary', { name: 'Modes de génération' })
        await expect(notice).toBeVisible()
        const summary = notice.locator('summary')
        await summary.focus(); await expect(summary).toBeFocused(); await page.keyboard.press('Enter')
        await expect(notice.getByText('API client', { exact: true })).toBeVisible()
        await expect(notice.getByText('Personnel open source distant', { exact: true })).toBeVisible()
        await expect(notice.getByText(/Mode personnel distant : disponibilité non vérifiée/)).toBeVisible()
        await expect(notice.getByText(/Aucun budget chiffré ni délai garanti/)).toBeVisible()
        await expect(page.getByText(/inclus gratuit|en quelques minutes/)).toHaveCount(0)
        await expect(page.getByTestId(path === '/create' ? 'create-button' : 'generate-all')).toBeDisabled()
        if (path === '/create') await expect(page.getByTestId('quality-4k')).toContainText('4K (sortie)')
        await axe(page, `${path}-${width}`)
        await page.screenshot({ path: resolve(output, `${path.slice(1)}-${width}.png`), fullPage: true })
        await summary.focus(); await page.keyboard.press('Space'); await expect(notice.locator('details')).not.toHaveAttribute('open', '')
        await expect(notice.getByText(/Mode personnel distant : disponibilité non vérifiée/)).toBeVisible()
        if (width === 375 || width === 1440) {
          await page.evaluate(() => scrollTo(0, 0))
          await page.screenshot({ path: resolve(output, `${path.slice(1)}-${width}-collapsed.png`), fullPage: false })
        }
      })
    }
    await check(`${width}px manual quality wording and keyboard navigation`, async () => {
      await page.goto(base + '/create', { waitUntil: 'networkidle' })
      await page.getByTestId('mode-manual').click()
      await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      await page.getByTestId('topic-input').fill('Une idée de test, sans génération')
      await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      await page.getByTestId('script-input').fill('Une scène de démonstration sans requête fournisseur.')
      await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      await page.getByRole('button', { name: 'Suivant', exact: true }).click()
      await expect(page.getByRole('button', { name: /4K \(sortie\)/ })).toBeDisabled()
      await expect(page.getByText(/une sortie 4K ne garantit pas/)).toBeVisible()
      await axe(page, `manual-${width}`)
      assert.equal(intercepted.length, 0, 'browsing forms never submits generation')
    })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  for (const path of socialOnly || capabilitiesOnly ? [] : ['/create', '/production']) {
    const topic = path === '/create' ? 'topic-input' : 'production-idea'
    const button = path === '/create' ? 'create-button' : 'generate-all'
    for (const mode of Object.keys(generationErrorCases)) {
      await check(`${path} ${mode}: visible actionable error, preserved draft, one intercepted request`, async () => {
        responseMode = mode
        await page.goto(base + path, { waitUntil: 'networkidle' })
        await page.getByTestId(topic).fill('Brouillon conservé après une erreur')
        const before = intercepted.length
        await page.getByTestId(button).click()
        if (mode === 'waiting') {
          await expect(page.getByRole('status').filter({ hasText: 'Demande en cours' })).toBeVisible()
          await expect.poll(() => typeof releaseResponse).toBe('function')
          await axe(page, `${path}-waiting`)
          assert.equal(intercepted.length, before + 1)
          releaseResponse(); releaseResponse = undefined
        }
        const alert = page.getByRole('alert').filter({ hasText: 'Vérifie la bibliothèque' })
        await expect(alert).toBeVisible()
        await expect(alert).toContainText(generationErrorCases[mode].title)
        await expect(page.getByTestId(topic)).toHaveValue('Brouillon conservé après une erreur')
        await expect(page.getByText(/fixture-provider-details|SUTRA_LOCAL_NOT_CONFIGURED|SALAD_ESTIMATE_EXCEEDS_BUDGET|SALAD_UNSUPPORTED_PROFILE/)).toHaveCount(0)
        const link = alert.getByRole('link', { name: 'Vérifier la bibliothèque' })
        await link.focus(); await expect(link).toBeFocused()
        await expect(link).toHaveAttribute('href', '/library')
        await axe(page, `${path}-${mode}-error`)
        await page.screenshot({ path: resolve(output, `${path.slice(1)}-${mode}-error.png`), fullPage: false })
        assert.equal(intercepted.length, before + 1, 'no automatic resubmission')
        const body = intercepted.at(-1).body
        assert.ok(!('executionMode' in body) && !('isOwner' in body), 'UI does not assert server authority')
      })
    }
  }
  if (capabilitiesOnly) {

    for (const [name, fixture, expected] of capabilitiesCases.filter(([name]) => !visualOnly || ['client', 'ready', 'busy'].includes(name))) {
      await check(`capabilities ${name}: safe public state, one GET, no generation or authority fields`, async () => {
        capabilitiesFixture = fixture
        const before = capabilitiesRequests.length
        await page.goto(base + '/create', { waitUntil: 'domcontentloaded' })
        const notice = page.getByRole('complementary', { name: 'Modes de génération' })
        if (name === 'timeout') await expect(notice.getByRole('status')).toContainText('Vérification de la disponibilité')
        await expect(notice.getByRole('status')).toContainText(expected, { timeout: 12000 })
        await notice.locator('summary').focus(); await page.keyboard.press('Enter')
        await expect(notice).toContainText('La disponibilité des fournisseurs API client n’a pas été vérifiée')
        await expect(notice).toContainText('Les quotas restants du worker distant ne sont pas connus')
        if (name === 'ready') {
          await expect(notice).toContainText('0,125 USD')
          await expect(notice).toContainText('Le coût réel est inconnu ; attente, stockage et réseau sont exclus')
        } else await expect(notice).not.toContainText('0,125 USD')
        await expect(notice).not.toContainText('fixture-private-reason-never-display')
        await page.getByTestId('topic-input').fill('Un brouillon qui provoque des rendus React')
        await page.getByTestId('mode-manual').click()
        await page.getByTestId('mode-auto').click()
        await axe(page, `capabilities-${name}`)
        assert.deepEqual(capabilitiesRequests.slice(before), [{ method: 'GET', path: '/api/video/capabilities', search: '' }])
        assert.equal(intercepted.length, 0)
        if (['client', 'ready', 'busy', 'timeout'].includes(name)) await notice.screenshot({ path: resolve(output, `${name}-375.png`) })
      })
    }
  }
  if (socialOnly) {
    for (const width of [320, 375, 768, 1280, 1440]) {
      await check(`${width}px social statuses, historical rows, counters, axe and layout`, async () => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(base + '/settings/social', { waitUntil: 'networkidle' })
        await expect(page.getByTestId('connected-count')).toHaveText('1 / 14 comptes connectes')
        await expect(page.getByTestId('disconnect-youtube')).toBeVisible()
        for (const platform of ['instagram', 'facebook', 'x', 'tiktok', 'linkedin']) {
          const card = page.getByTestId(`platform-card-${platform}`)
          await expect(card).toContainText(`Ancien compte : @historique_${platform}`)
          await expect(card.getByTestId(`connect-${platform}`)).toBeEnabled()
          await expect(card.getByTestId(`disconnect-${platform}`)).toHaveCount(0)
          await expect(card.getByText('Connecte', { exact: true })).toHaveCount(0)
        }
        await axe(page, `social-${width}`)
        if (width === 375 || width === 1440) {
          await page.getByTestId('platform-card-instagram').scrollIntoViewIfNeeded()
          await page.screenshot({ path: resolve(output, `social-${width}.png`), fullPage: false })
        }
        if (width === 375) {
          await page.getByTestId('toggle-autopilot').click()
          await expect(page.getByTestId('autopilot-platform-youtube')).toBeVisible()
          await expect(page.getByTestId('autopilot-platform-instagram')).toHaveCount(0)
          await page.getByTestId('toggle-autopilot').click()
        }
        assert.equal(socialRequests.length, 0, 'browsing never connects or revokes')
      })
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await check('social DELETE202: no false success; reconnect visible; one intercepted revocation', async () => {
      await page.getByTestId('disconnect-youtube').click()
      await page.getByTestId('confirm-disconnect').click()
      await expect(page.getByRole('alert').filter({ hasText: 'Révocation distante non confirmée' })).toBeVisible()
      await expect(page.getByTestId('connected-count')).toHaveText('0 / 14 comptes connectes')
      await expect(page.getByTestId('connect-youtube')).toBeEnabled()
      await expect(page.getByTestId('disconnect-youtube')).toHaveCount(0)
      await expect(page.getByText('YouTube deconnecte', { exact: true })).toHaveCount(0)
      await page.getByRole('alert').filter({ hasText: 'Révocation distante non confirmée' }).scrollIntoViewIfNeeded()
      await axe(page, 'social-revocation-unconfirmed')
      await page.screenshot({ path: resolve(output, 'social-revocation-unconfirmed.png'), fullPage: false })
      assert.equal(socialRequests.length, 1)
    })
    await check('social reconnect button uses keyboard; safe unavailable toast; no real OAuth', async () => {
      const reconnect = page.getByTestId('connect-youtube')
      await reconnect.focus(); await expect(reconnect).toBeFocused(); await page.keyboard.press('Enter')
      await expect(page.getByText('Connexion YouTube indisponible', { exact: true })).toBeVisible()
      await expect(reconnect).toBeEnabled()
      await axe(page, 'social-reconnect-unavailable')
      assert.deepEqual(socialRequests.map(request => request.method), ['DELETE', 'POST'])
    })
  }
  await check('no JS or hydration errors; no live generation, purchase or publication', async () => {
    assert.deepEqual(errors, [])
    assert.equal(intercepted.length, socialOnly || capabilitiesOnly ? 0 : 2 * Object.keys(generationErrorCases).length)
    assert.ok(intercepted.every(request => request.method === 'POST'))
  })
} catch (error) {
  process.exitCode = 1
  results.push(`FAIL ${error.message}`)
  process.stderr.write(`${error.stack}\n`)
} finally {
  releaseResponse?.()
  if (browser) await browser.close()
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') }
  await new Promise(done => fixture.close(done))
  await log.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ observedAt: new Date().toISOString(), runtime: process.version, childExit, results, errors, violations, intercepted: intercepted.map(({ body, ...request }) => ({ ...request, modeField: body.mode ?? null })), socialRequests, capabilitiesRequests, blockedExternalOrigins: [...new Set(blocked)], proof: `LOCAL_CHROMIUM_FIXTURES_ONLY; ${intercepted.length} generation requests intercepted; no paid route executed; no production build repeated` }, null, 2) + '\n')
}
