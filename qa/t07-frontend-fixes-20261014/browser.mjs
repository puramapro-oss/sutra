// Targeted UI evidence only. Every generation response is intercepted in Chromium.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'
import { readConsentContrast } from './consent-contrast.mjs'
import { socialFeedbackChecks } from '../final-delta-20261014/social-browser.mjs'

const require = createRequire(import.meta.url)
const baseline = process.argv.includes('--baseline'), consentOnly = process.argv.includes('--consent-only'), production = process.argv.includes('--production')
const output = resolve(process.env.SUTRA_T07_OUTPUT || 'qa/t07-frontend-fixes-20261014/evidence', consentOnly ? 'consent-before' : baseline ? 'before' : 'after')
await mkdir(output, { recursive: true })
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'studio-test@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { name: 'Studio Test' }, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })).toString('base64url')}.fixture-signature`
const profile = { id: user.id, email: user.email, name: 'Studio Test', plan: 'creator', credits: 40, monthly_video_count: 0, is_admin: false, tutorial_completed: true, brand_kit: null }
const videos = Array.from({ length: 13 }, (_, i) => ({
  id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`, user_id: user.id,
  title: i === 12 ? 'Favori de la seconde page' : `Vidéo témoin ${i + 1}`,
  status: 'draft', created_at: new Date(Date.UTC(2026, 9, 13, 0, 0, 13 - i)).toISOString(),
  duration: 30, format: '9:16', video_url: null, thumbnail_url: null,
}))
const requests = [], results = [], errors = [], violations = [], metrics = [], blocked = [], mockedConsents = [], unexpectedMutations = [], themeColors = []
let dataMode = 'normal', child, childExit, browser, diagnosticPage
const authPaths = [], delayMs = 400
const fixture = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const url = new URL(req.url, 'http://fixture.invalid'), path = url.pathname
  const send = value => res.end(JSON.stringify(value))
  if (path.startsWith('/auth/') || path === '/rest/v1/profiles') authPaths.push({ path, method: req.method })
  if (path === '/auth/v1/token') return send({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user })
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return send({ error: 'fixture_read_only' }) }
  if (path === '/auth/v1/user') return send(user)
  if (path === '/rest/v1/profiles') return send(req.headers.accept?.includes('object+json') ? profile : [profile])
  if (path === '/rest/v1/legal_acceptances') return send(['mentions', 'cgu', 'cgv', 'confidentialite'].map(doc_type => ({ doc_type, version: '1.0' })))
  if (path === '/rest/v1/videos') {
    const start = performance.now(), offset = Number(url.searchParams.get('offset') || 0)
    const record = { query: url.search, mode: dataMode, offset }; requests.push(record)
    await new Promise(done => setTimeout(done, delayMs))
    record.durationMs = Math.round(performance.now() - start)
    if (record.mode === 'error' || record.mode === 'append-error' && offset > 0) { res.writeHead(400); return send({ code: 'fixture_failure', message: 'fixture_failure' }) }
    let rows = record.mode === 'empty' ? [] : [...videos]
    if (url.searchParams.get('status')) rows = rows.filter(v => `eq.${v.status}` === url.searchParams.get('status'))
    if (url.searchParams.get('title')) rows = rows.filter(v => v.title.toLowerCase().includes(url.searchParams.get('title').replace(/^ilike\.\%|\%$/g, '').toLowerCase()))
    const count = rows.length
    if (url.searchParams.get('order')?.includes('asc')) rows.reverse()
    const limit = Number(url.searchParams.get('limit') || 12)
    rows = rows.slice(offset, offset + limit)
    res.setHeader('Content-Range', `${offset}-${Math.max(offset, offset + rows.length - 1)}/${count}`)
    return send(req.headers.accept?.includes('object+json') ? rows[0] ?? null : rows)
  }
  res.setHeader('Content-Range', '0-0/0')
  return send(req.headers.accept?.includes('object+json') ? null : [])
})
fixture.listen(0, '127.0.0.1'); await once(fixture, 'listening')
const fixtureURL = `http://127.0.0.1:${fixture.address().port}`
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixtureURL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
async function check(name, run) {
  try { await run(); results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`) }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1; process.stderr.write(`FAIL ${name}: ${error.message}\n`) }
}
async function layout(page, name) {
  await page.waitForTimeout(650)
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'document fits viewport')
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, html, failureSummary }) => ({ target, html, failureSummary })) })))
  violations.push({ name, violations: found }); assert.deepEqual(found, [], `axe ${name}`)
}
try {
  // As in T08, build and serve with the exact same isolated fixture environment.
  if (production) {
    const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { cwd: process.cwd(), env, stdio: ['ignore', log.fd, log.fd] })
    const [code] = await once(build, 'exit'); assert.equal(code, 0, 'isolated production build')
  }
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', ...(production ? [] : ['--webpack']), '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  child.once('exit', (code, signal) => { childExit = { code, signal } })
  await writeFile(resolve(output, 'owned-server.json'), JSON.stringify({ pid: child.pid, base, cwd: process.cwd() }) + '\n')
  let ready = false
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok) { ready = true; break } } catch { /* local boot */ }
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
      if (url.pathname === '/api/legal/cookie-consent' && request.method() === 'POST') {
        mockedConsents.push({ path: url.pathname, method: request.method() })
        return route.fulfill({ json: { success: true } })
      }
      if (request.method() !== 'GET') {
        unexpectedMutations.push({ path: url.pathname, method: request.method() })
        return route.fulfill({ status: 403, json: { error: 'fixture_forbids_mutation' } })
      }
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort()
    return route.continue()
  })
  const page = await context.newPage(); diagnosticPage = page
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /hydration|did not match|server rendered/i.test(m.text())) errors.push(m.text()) })
  await page.goto(`${base}/login?next=/library`)
  await check('first visit: cookie acceptance text meets contrast and keyboard focus', async () => {
    await expect(page.getByTestId('cookie-banner')).toBeVisible()
    const accept = page.getByTestId('cookie-accept')
    await accept.focus(); await expect(accept).toBeFocused()
    await page.waitForTimeout(650)
    await page.screenshot({ path: resolve(output, 'consent-375.png'), fullPage: true })
    await layout(page, 'login-first-visit')
  })
  if (!consentOnly) {
  for (const width of [375, 1440]) for (const theme of ['dark', 'light', 'oled']) {
    await check(`${width}px consent ${theme}: button contrast and visible focus`, async () => {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate(theme => {
        document.documentElement.classList.remove('theme-light', 'theme-oled')
        if (theme !== 'dark') document.documentElement.classList.add(`theme-${theme}`)
      }, theme)
      await page.waitForTimeout(650)
      const accept = page.getByTestId('cookie-accept')
      await accept.focus(); await expect(accept).toBeFocused()
      const colors = await page.evaluate(readConsentContrast)
      themeColors.push({ width, theme, ...colors })
      assert.ok(colors.accept >= 4.5, `accept contrast ${colors.accept}`)
      assert.ok(colors.link >= 4.5, `link contrast ${colors.link}`)
      if (width === 1440) await page.screenshot({ path: resolve(output, `consent-${width}-${theme}.png`), fullPage: true })
      const contrast = await page.evaluate(async () => (await window.axe.run(document.querySelector('[data-testid="cookie-banner"]'), { runOnly: ['color-contrast'] })).violations)
      assert.deepEqual(contrast, [])
      assert.ok(await accept.evaluate(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }))
    })
  }
  await page.evaluate(() => document.documentElement.classList.remove('theme-light', 'theme-oled'))
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByTestId('email-input').fill(user.email); await page.getByTestId('password-input').fill('fixture-password')
  await page.getByTestId('login-button').click()
  await expect(page.getByTestId('load-more')).toBeVisible({ timeout: 60000 })
  await page.evaluate(id => {
    localStorage.setItem('sutra_favorites', JSON.stringify([id]))
    localStorage.setItem('sutra_folders', JSON.stringify([{ id: 'later', name: 'Dossier deuxième page', videoIds: [id] }]))
  }, videos[12].id)
  async function reset() {
    dataMode = 'normal'
    await page.goto(base + '/library')
    await expect(page.getByTestId('load-more')).toBeVisible()
  }
  await reset()
  for (let i = 0; i < 3; i++) {
    for (const filter of ['favorites', 'all']) {
      const before = requests.length
      const timing = await page.evaluate(async filter => {
        const start = performance.now()
        document.querySelector(`[data-testid="filter-${filter}"]`).click()
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
        const committedMs = performance.now() - start
        const end = start + 4000
        while (!document.querySelector('[data-testid="empty-library"], [data-testid="load-more"]') && performance.now() < end) await new Promise(requestAnimationFrame)
        return { committedMs: Math.round(committedMs), readyMs: Math.round(performance.now() - start) }
      }, filter)
      await page.waitForTimeout(delayMs + 200)
      metrics.push({ filter, iteration: i + 1, requests: requests.length - before, ...timing })
    }
  }
  await check('all/favorites toggles reuse identical server result without requests', async () => assert.equal(metrics.reduce((n, m) => n + m.requests, 0), 0))
  await page.getByTestId('cookie-refuse').click(); await expect(page.getByTestId('cookie-banner')).toHaveCount(0)
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const filter of ['favorites', 'folder']) {
      await reset()
      await page.getByTestId(filter === 'favorites' ? 'filter-favorites' : 'folder-later').click()
      await expect(page.getByTestId('empty-library')).toBeVisible()
      await check(`${width}px ${filter}: incomplete page keeps honest state and pagination`, async () => {
        await expect(page.getByTestId('load-more')).toBeVisible({ timeout: 1200 })
        await expect(page.getByTestId('empty-library')).toContainText('vidéos chargées')
        await layout(page, `${width}-${filter}-pending`)
        await page.screenshot({ path: resolve(output, `${width}-${filter}-pending.png`), fullPage: false })
        const button = page.getByTestId('load-more')
        await button.focus(); await expect(button).toBeFocused()
        const before = requests.length
        await page.keyboard.press('Enter')
        await expect(button).toBeDisabled()
        await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
        assert.equal(requests.length - before, 1)
        assert.equal(requests.at(-1).offset, 12)
        await expect(button).toHaveCount(0)
        await layout(page, `${width}-${filter}-loaded`)
      })
    }
  }
  if (!baseline) {
    await page.setViewportSize({ width: 375, height: 900 })
    await reset()
    await check('server filters and search still fetch; fast search retains latest result', async () => {
      let before = requests.length
      await page.getByTestId('filter-ready').click()
      await expect(page.getByTestId('empty-library')).toBeVisible()
      assert.equal(requests.length - before, 1)
      assert.ok(requests.at(-1).query.includes('status=eq.ready'))
      await page.getByTestId('filter-all').click()
      await expect(page.getByTestId('load-more')).toBeVisible()
      before = requests.length
      await page.getByTestId('library-search').fill('témoin')
      await page.getByTestId('library-search').fill('seconde')
      await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
      await expect(page.getByTestId('load-more')).toHaveCount(0)
      assert.equal(requests.length - before, 1)
      await layout(page, 'search-result')
    })
    await reset()
    await check('pagination failure remains an error; retry recovers, no false empty result', async () => {
      await page.getByTestId('filter-favorites').click()
      dataMode = 'append-error'
      await page.getByTestId('load-more').click()
      await expect(page.getByTestId('library-error')).toContainText('charger la suite')
      await expect(page.getByTestId('empty-library')).toHaveCount(0)
      await layout(page, 'append-error')
      dataMode = 'normal'
      await page.getByTestId('load-more').click()
      await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
      await expect(page.getByTestId('library-error')).toHaveCount(0)
    })
    await check('rapid pagination clicks issue only one append', async () => {
      await reset()
      const before = requests.length
      await page.getByTestId('load-more').evaluate(b => { b.click(); b.click(); b.click() })
      await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
      assert.equal(requests.length - before, 1)
    })
    await check('local filter changes preserve loaded and in-flight second pages', async () => {
      await reset()
      const before = requests.length
      await page.getByTestId('load-more').click()
      await expect(page.getByTestId('load-more')).toBeDisabled()
      await page.getByTestId('filter-favorites').click()
      await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
      await page.getByTestId('filter-all').click()
      await expect(page.getByText(videos[0].title, { exact: true })).toBeVisible()
      await page.getByTestId('filter-favorites').click()
      await expect(page.getByText(videos[12].title, { exact: true })).toBeVisible()
      await page.waitForTimeout(delayMs + 100)
      assert.equal(requests.length - before, 1)
      await expect(page.getByTestId('load-more')).toHaveCount(0)
    })
    await check('server filter failure clears old pagination; retry restores current query', async () => {
      await reset()
      dataMode = 'error'
      await page.getByTestId('filter-ready').click()
      await expect(page.getByTestId('library-error')).toBeVisible()
      await expect(page.getByTestId('empty-library')).toHaveCount(0)
      await expect(page.getByTestId('load-more')).toHaveCount(0)
      dataMode = 'normal'
      await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
      await expect(page.getByTestId('library-error')).toHaveCount(0)
      await expect(page.getByTestId('empty-library')).toBeVisible()
    })
    for (const mode of ['error', 'empty']) await check(`initial ${mode}: truthful state, layout and contrast`, async () => {
      dataMode = mode
      await page.goto(base + '/library')
      await expect(page.getByTestId(mode === 'error' ? 'library-error' : 'empty-library')).toBeVisible()
      if (mode === 'error') await expect(page.getByTestId('empty-library')).toHaveCount(0)
      await expect(page.getByTestId('load-more')).toHaveCount(0)
      await layout(page, `initial-${mode}`)
    })
  }
  }
  if (!consentOnly) await socialFeedbackChecks(page, base, output, check)
  await check('no unexpected mutation API reached', async () => assert.deepEqual(unexpectedMutations, []))
  await check('no JS or hydration errors', async () => assert.deepEqual(errors, []))
} catch (error) {
  if (diagnosticPage) {
    results.push({ name: 'failure-diagnostic', path: new URL(diagnosticPage.url()).pathname, authPaths, visibleAlerts: await diagnosticPage.locator('[role=alert], [data-sonner-toast]').allTextContents() })
    await diagnosticPage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true })
  }
  process.exitCode = 1; results.push({ name: 'harness', status: 'FAIL', message: error.message }); process.stderr.write(`${error.stack}\n`)
} finally {
  if (browser) await browser.close()
  if (child && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  await new Promise(done => fixture.close(done)); await log.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ observedAt: new Date().toISOString(), runtime: process.version,
    baseline, production, delayMs, childExit, results, metrics, requests, errors, violations, mockedConsents, unexpectedMutations, themeColors, blockedExternalOrigins: [...new Set(blocked)],
    proof: 'LOCAL_CHROMIUM_FIXTURES_ONLY; no secret/provider/publication' }, null, 2) + '\n')
}
