// Browser contract tests with a local fake Supabase service. No real accounts or providers.
import assert from 'node:assert/strict'
import { runT07Flows } from './ui-isolated/t07-flows.mjs'
import { runT07Runtime } from './ui-isolated/t07-runtime.mjs'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, writeFile, mkdir, open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'

const require = createRequire(import.meta.url)
const root = process.cwd()
const output = resolve(process.env.SUTRA_UI_OUTPUT || 'test-results/ui-isolated')
await mkdir(output, { recursive: true })
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'studio-test@example.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { name: 'Studio Test' }, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email: user.email })).toString('base64url')}.fixture-signature`
let profile = { id: user.id, email: user.email, name: 'Studio Test', plan: 'creator', credits: 40, is_admin: false, tutorial_completed: true, brand_kit: null, created_at: new Date().toISOString() }
let fixtureImage = Buffer.alloc(0)
let profilesFail = false, accountAccessFails = false, updateFails = false, uploaded = 0, passwordChanges = 0
const fixture = { videos: [], delay: 0, staleDelay: 0, deleteFails: false, videosFail: false }
const requests = []
const fake = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS, HEAD')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const url = new URL(req.url, 'http://fixture.invalid')
  requests.push({ path: url.pathname, query: url.search, method: req.method })
  const chunks = []; for await (const chunk of req) chunks.push(chunk)
  let body = {}; try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { /* Storage multipart body. */ }
  const send = (value, status = 200) => { res.writeHead(status); res.end(JSON.stringify(value)) }
  if (url.pathname === '/auth/v1/token') {
    if (body.password !== 'fixture-password-42') return send({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
    return send({ access_token: token, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user })
  }
  if (url.pathname === '/auth/v1/user') {
    if (req.headers.authorization !== `Bearer ${token}`) return send({ message: 'Invalid token' }, 401)
    if (req.method === 'PUT') passwordChanges++
    return send(user)
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); res.end(); return }
  if (url.pathname === '/auth/v1/recover') return send({})
  if (url.pathname.startsWith('/storage/v1/object/')) {
    if (req.method === 'POST') { uploaded++; return send({ Key: url.pathname.replace('/storage/v1/object/', '') }) }
    res.setHeader('Content-Type', 'image/png'); res.end(fixtureImage); return
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (accountAccessFails || (profilesFail && url.searchParams.get('select') === '*') || (updateFails && req.method === 'PATCH')) return send({ message: 'Fixture database unavailable' }, 503)
    if (req.method === 'PATCH') profile = { ...profile, ...body }
    return send(req.headers.accept?.includes('object+json') ? profile : [profile])
  }
  if (url.pathname === '/rest/v1/legal_acceptances') return send(['mentions', 'cgu', 'cgv', 'confidentialite'].map(doc_type => ({ doc_type, version: '1.0' })))
  if (url.pathname === '/rest/v1/videos') {
    if (fixture.videosFail || (fixture.deleteFails && req.method === 'DELETE')) return send({ message: 'Fixture videos unavailable' }, 503)
    if (req.method === 'DELETE') { fixture.videos = fixture.videos.filter(video => `eq.${video.id}` !== url.searchParams.get('id')); return send(null) }
    let rows = [...fixture.videos]
    const title = url.searchParams.get('title')?.replace(/^ilike.%|%$/g, '').toLowerCase()
    if (title) rows = rows.filter(video => video.title.toLowerCase().includes(title))
    const status = url.searchParams.get('status')?.replace(/^eq./, '')
    if (status) rows = rows.filter(video => video.status === status)
    const count = rows.length, offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || count)
    if (url.searchParams.get('order')?.startsWith('title')) rows.sort((a, b) => a.title.localeCompare(b.title))
    rows = rows.slice(offset, offset + limit)
    const delay = title === 'ancien' ? fixture.staleDelay : fixture.delay
    if (delay) await new Promise(done => setTimeout(done, delay))
    res.setHeader('Content-Range', `${offset}-${Math.max(offset, offset + rows.length - 1)}/${count}`)
    return send(req.headers.accept?.includes('object+json') ? rows[0] ?? null : rows)
  }
  res.setHeader('Content-Range', '0-0/0')
  return send(req.headers.accept?.includes('object+json') ? null : [])
})
fake.listen(0, '127.0.0.1'); await once(fake, 'listening')
const fixtureURL = `http://127.0.0.1:${fake.address().port}`
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening'); const appPort = portProbe.address().port; await new Promise(done => portProbe.close(done))
const base = `http://127.0.0.1:${appPort}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: fixtureURL, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated', VERCEL: '' }
let child, browser
const results = [], browserErrors = [], accessibility = []
const editorOnly = process.argv.includes('--editor-only')
const profileOnly = process.argv.includes('--profile-only')
const widths = editorOnly || profileOnly ? [] : [320, 375, 768, 1280, 1440]
const diagnostic = process.env.SUTRA_UI_DIAGNOSTIC === '1'
const mode = process.env.SUTRA_UI_PRODUCTION === '1' ? 'start' : 'dev'
async function check(name, run) { await run(); results.push(name); process.stdout.write(`PASS ${name}\n`) }
try {
  if (mode === 'start') {
    const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { cwd: root, env, stdio: ['ignore', log.fd, log.fd] })
    const [code] = await once(build, 'exit'); assert.equal(code, 0, 'production build')
    for (const file of ['prerender-manifest.json', 'routes-manifest.json']) JSON.parse(await readFile(resolve('.next', file), 'utf8'))
  }
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, ...(mode === 'dev' ? ['--webpack'] : []), '--hostname', '127.0.0.1', '--port', String(appPort)], { cwd: root, env, stdio: ['ignore', log.fd, log.fd] })
  let ready = false
  for (let i = 0; i < 90; i++) { try { const response = await fetch(`${base}/login`); if (response.ok) { ready = true; break } } catch { /* App booting. */ } await new Promise(done => setTimeout(done, 500)) }
  assert.ok(ready, 'local Next server ready')
  if (process.argv.includes('--legacy')) {
    const legacy = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.offline.config.ts', ...(process.argv.includes('--legacy-regressions') ? ['--grep', 'remember-me label text|karma-defi sans secret|SQL injection in URL'] : [])], {
      cwd: root, env: { ...env, PLAYWRIGHT_BASE_URL: base, E2E_BASE_URL: base }, stdio: 'inherit',
    })
    const [code] = await once(legacy, 'exit')
    process.exitCode = code || 0
  } else {
  browser = await chromium.launch({ ...(process.env.SUTRA_CHROMIUM_PATH ? { executablePath: process.env.SUTRA_CHROMIUM_PATH } : {}), headless: true })
  async function context(width, consent = true) {
    const ctx = await browser.newContext({ viewport: { width, height: 812 }, reducedMotion: 'reduce', locale: 'fr-FR' })
    await ctx.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === fixtureURL) return route.continue()
      if (url.origin !== base) return route.abort()
      // Browser API responses are fixtures; no paid route or real publication can run.
      if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ should_show: false, accounts: [], videos: [], notifications: [], templates: [], data: [], referral_code: null }) })
      return route.continue()
    })
    await ctx.addInitScript(({ consent }) => {
      try {
      if (consent) localStorage.setItem('purama_cookie_consent_v1', JSON.stringify({ necessaire: true, mesure: false, marketing: false, updatedAt: new Date().toISOString() }))
      localStorage.setItem('sutra_intro_seen', '1'); localStorage.setItem('sutra_tutorial_dismissed', 'true')
      } catch { /* about:blank has no storage origin. */ }
    }, { consent })
    ctx.on('page', page => {
      page.on('pageerror', error => browserErrors.push({ url: page.url().replace(base, ''), message: error.message }))
      page.on('console', message => { if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) browserErrors.push({ url: page.url().replace(base, ''), message: message.text() }) })
    })
    return ctx
  }
  async function noOverflow(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow')
    const clipped = await page.locator('main button, main input, main select, main textarea, [role=dialog] button, [role=dialog] input').evaluateAll(elements => elements.filter(el => {
      const box = el.getBoundingClientRect()
      if (!box.width || !box.height || (box.left >= -1 && box.right <= innerWidth + 1)) return false
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth) return false
      }
      return true
    }).map(el => ({ text: el.textContent?.slice(0, 60), testId: el.getAttribute('data-testid') })))
    if (diagnostic && clipped.length) process.stdout.write(`CLIPPED ${JSON.stringify(clipped)}\n`)
    else assert.deepEqual(clipped, [], 'all controls inside viewport or usable scroller')
  }
  async function screenshot(page, name) { await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: false }) }
  async function auditAccessibility(page, name) {
    // Framer opacity transitions can still run with reduced transform motion.
    await page.waitForTimeout(650)
    await noOverflow(page)
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(({ id, impact, nodes }) => ({ id, impact, count: nodes.length, targets: nodes.slice(0, 8).map(node => node.target) })))
    accessibility.push({ name, violations })
    if (!diagnostic) assert.deepEqual(violations, [], `WCAG A/AA checks on ${name}`)
  }
  for (const width of (process.env.SUTRA_UI_FOCUS ? [] : widths)) {
    const ctx = await context(width), page = await ctx.newPage()
    for (const path of ['/', '/login', '/signup', '/pricing', '/forgot-password', '/reset-password', '/how-it-works']) {
      await check(`${width}px ${path}: renders without overflow`, async () => {
        const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60_000 }); assert.equal(response.status(), 200); await noOverflow(page)
      })
      if (path === '/') {
        await check(`${width}px landing CTA remains clickable and separate from previews`, async () => {
          await page.getByTestId('hero-cta-primary').click({ trial: true })
          const cta = await page.getByTestId('hero-cta-primary').boundingBox(), preview = await page.getByLabel('Exemple des étapes de création').boundingBox()
          assert.ok(cta.y + cta.height <= preview.y)
          await expect(page.getByRole('link', { name: 'Se connecter', exact: true }).first()).toBeVisible()
        })
        await screenshot(page, `landing-${width}`)
      }
      if (path === '/login') {
        await check(`${width}px empty login exposes linked field errors`, async () => {
          await page.getByTestId('login-button').click()
          for (const name of ['email-input', 'password-input']) {
            const input = page.getByTestId(name); await expect(input).toHaveAttribute('aria-invalid', 'true')
            const errorId = await input.getAttribute('aria-describedby'); assert.ok(errorId)
            await expect(page.locator(`[id="${errorId}"]`)).toBeVisible()
            const iconBox = await input.locator('..').boundingBox(), inputBox = await input.boundingBox(); assert.ok(Math.abs(iconBox.height - inputBox.height) < 2)
          }
        })
        await screenshot(page, `login-${width}`)

      }
      if (['/login', '/signup', '/forgot-password', '/reset-password'].includes(path)) await auditAccessibility(page, `${path.slice(1)}-${width}`)
    }
    await ctx.close()
  }
  const cookieContext = await context(375, false), cookiePage = await cookieContext.newPage()
  await check('cookie choice works without browser storage', async () => {
    await cookiePage.goto(base + '/login'); await expect(cookiePage.getByTestId('cookie-banner')).toBeVisible()
    await cookiePage.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') } })
    await cookiePage.getByTestId('cookie-refuse').click(); await expect(cookiePage.getByTestId('cookie-banner')).toHaveCount(0)
  }); await cookieContext.close()

  const ctx = await context(375), page = await ctx.newPage()
  await check('protected URL preserves destination and query through login', async () => {
    await page.goto(base + '/settings?tab=apparence'); await expect(page).toHaveURL(/\/login\?next=/)
    assert.equal(new URL(page.url()).searchParams.get('next'), '/settings?tab=apparence')
    await page.getByTestId('email-input').fill(user.email); await page.getByTestId('password-input').fill('fixture-password-42'); await page.getByTestId('login-button').click()
    await expect(page).toHaveURL(base + '/settings?tab=apparence', { timeout: 30_000 })
    await expect(page.getByTestId('header')).toBeVisible()
    const cookies = await ctx.cookies(); const auth = cookies.filter(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))
    assert.ok(auth.length); assert.ok(auth.every(cookie => cookie.expires === -1), 'unchecked remember-me creates session cookies')
  })
  await check('mobile search reaches all navigation items and restores keyboard focus', async () => {
    await page.getByTestId('search-trigger').click(); const modal = page.getByTestId('search-modal'); await expect(modal).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeFocused()
    await page.getByTestId('search-input').fill('production'); await expect(page.getByTestId('search-result-production')).toBeVisible()
    await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(page.getByTestId('search-trigger')).toBeFocused()
    await page.getByTestId('search-trigger').click(); await page.getByTestId('search-input').fill('partenariat'); await page.getByTestId('search-result-partenaire').click()
    await expect(page).toHaveURL(base + '/partenaire'); await noOverflow(page)
  })
  for (const width of (process.env.SUTRA_UI_FOCUS === 'flows' ? [] : widths)) {
    await page.setViewportSize({ width, height: 812 })
    for (const path of ['/dashboard', '/create', '/production', '/library', '/settings']) {
      await check(`${width}px authenticated fixture ${path}`, async () => {
        await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60_000 }); await expect(page.getByTestId('header')).toBeVisible(); await noOverflow(page)
      })
      await auditAccessibility(page, `${path.slice(1)}-${width}`)
      if (path === '/production') await check(`${width}px production navigation`, async () => {
        const buttons = await page.getByRole('navigation', { name: 'Étapes de production' }).getByRole('button').all(); assert.equal(buttons.length, 7)
        for (const button of buttons) { const box = await button.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width) }
      })
      await screenshot(page, `studio-${path.slice(1)}-${width}`)
    }
  }
  if (!profileOnly) await runT07Flows({ page, base, widths, check, noOverflow, auditAccessibility, screenshot, fixture, requests, user })
  const performanceObservations = process.env.SUTRA_UI_FOCUS || editorOnly || profileOnly ? [] : await runT07Runtime({ page, base, check, noOverflow, screenshot })
  if (!editorOnly && !profileOnly) {
  await page.goto(base + '/settings', { waitUntil: 'networkidle' })
  await page.setViewportSize({ width: 375, height: 812 })
  await check('settings logo is uploaded before persisting its durable URL', async () => {
    await page.getByText('Apparence', { exact: true }).click()
    const bytes = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16; canvas.getContext('2d').fillRect(0, 0, 16, 16); return canvas.toDataURL('image/png').split(',')[1] }), 'base64')
    fixtureImage = bytes
    await page.getByTestId('settings-brandkit').locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: bytes })
    await expect(page.getByTestId('settings-brandkit').getByAltText('Logo')).toHaveAttribute('src', /^blob:/)
    const before = uploaded; await page.getByTestId('settings-brandkit').getByRole('button', { name: /sauvegarder/i }).click()
    await expect.poll(() => uploaded).toBe(before + 1)
    await expect.poll(() => profile.brand_kit?.logo_url).toMatch(/\/storage\/v1\/object\/public\/public\/logos\//)
    await page.reload({ waitUntil: 'networkidle' }); await page.getByText('Apparence', { exact: true }).click()
    await expect(page.getByTestId('settings-brandkit').getByAltText('Logo')).toHaveAttribute('src', /^http:/)
  })
  await check('invalid logos and failed profile writes do not become successful saves', async () => {
    const before = uploaded, oldLogo = profile.brand_kit.logo_url
    await page.getByTestId('settings-brandkit').locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('<svg/>') })
    await expect(page.getByText('Format non valide. Choisis une image PNG, JPEG ou WebP.')).toBeVisible()
    assert.equal(uploaded, before)
    updateFails = true; await page.getByTestId('brand-font-input').fill('Fixture font')
    await page.getByTestId('settings-save-brandkit').click(); await expect(page.getByText('Erreur lors de la sauvegarde', { exact: true })).toBeVisible()
    assert.equal(profile.brand_kit.logo_url, oldLogo); assert.notEqual(profile.brand_kit.font, 'Fixture font'); updateFails = false
  })
  await check('theme changes stay synchronized between settings and header', async () => {
    await page.getByTestId('theme-oled').click(); await expect(page.getByTestId('theme-oled')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('theme-toggle').click(); await expect(page.getByTestId('theme-light')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('theme-dark').click()
  })
  await auditAccessibility(page, 'settings-mobile')
  await check('database errors are visible instead of false zero statistics', async () => {
    fixture.videosFail = true; await page.goto(base + '/dashboard', { waitUntil: 'networkidle' }); await expect(page.getByRole('heading', { name: 'Le tableau de bord n’a pas pu être chargé' })).toBeVisible()
    fixture.videosFail = false; await page.getByRole('button', { name: 'Réessayer', exact: true }).click(); await expect(page.getByTestId('dashboard-greeting')).toBeVisible()
  })
  await check('password recovery form updates through the auth service', async () => {
    await page.goto(base + '/reset-password', { waitUntil: 'networkidle' }); await page.getByLabel('Nouveau mot de passe', { exact: true }).fill('fixture-new-password-42'); await page.getByLabel('Confirmer le mot de passe').fill('fixture-new-password-42')
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click(); await expect(page.getByText('Mot de passe modifié.')).toBeVisible(); assert.equal(passwordChanges, 1)
  })
  await check('sign-out clears authentication and preserves unrelated preferences', async () => {
    await page.goto(base + '/dashboard'); await page.evaluate(() => localStorage.setItem('studio-test-draft', 'preserved'))
    await page.getByTestId('user-menu').click(); await page.getByTestId('dropdown-signout').click(); await expect(page).toHaveURL(base + '/login')
    assert.equal(await page.evaluate(() => localStorage.getItem('studio-test-draft')), 'preserved')
    assert.ok(await page.evaluate(() => localStorage.getItem('purama_cookie_consent_v1')))
    assert.equal((await ctx.cookies()).filter(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')).length, 0)
  })
  await check('remember-me creates persistent session cookies', async () => {
    await page.getByTestId('email-input').fill(user.email); await page.getByTestId('password-input').fill('fixture-password-42'); await page.getByTestId('remember-me-checkbox').check(); await page.getByTestId('login-button').click()
    await expect(page).toHaveURL(base + '/dashboard', { timeout: 30_000 })
    const cookies = (await ctx.cookies()).filter(cookie => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'))
    assert.ok(cookies.length); assert.ok(cookies.every(cookie => cookie.expires > Date.now() / 1000 + 29 * 86400))
  })
  await check('desktop navigation and modal remain usable with a collapsed sidebar', async () => {
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(base + '/dashboard', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('quick-action-create')).toBeInViewport(); await page.getByTestId('sidebar-toggle').click()
    await expect(page.getByTestId('sidebar-production')).toHaveAccessibleName('Production')
    await page.getByTestId('search-trigger').click(); await expect(page.getByTestId('search-modal')).toBeVisible()
    await page.getByTestId('search-input').fill('montage'); await expect(page.getByTestId('search-result-production')).toBeVisible()
    await page.keyboard.press('Escape'); await expect(page.getByTestId('search-trigger')).toBeFocused()
    await noOverflow(page); await screenshot(page, 'studio-desktop')
  })
  }
  if (!editorOnly) {
  await check('an unavailable client profile does not masquerade as a free account', async () => {
    // Keep the server's narrow account-access check healthy; fail only client profile loading.
    profilesFail = true; await page.goto(base + '/settings', { waitUntil: 'networkidle' })
    // The auth store has a 12s deadline, including SDK retries of the fixture 503.
    await expect(page.getByRole('button', { name: 'Recharger le profil' })).toBeVisible({ timeout: 20_000 })
    profilesFail = false; await page.getByRole('button', { name: 'Recharger le profil' }).click()
    await expect(page.getByTestId('settings-profil')).toBeVisible()
  })
  await check('an unavailable server account check denies protected page access', async () => {
    accountAccessFails = true
    const response = await ctx.request.get(base + '/settings', { maxRedirects: 0 })
    assert.equal(response.status(), 307)
    const redirect = new URL(response.headers().location, base)
    assert.equal(redirect.pathname, '/login')
    assert.equal(redirect.searchParams.get('next'), '/settings')
    accountAccessFails = false
  })
  }
  await ctx.close()
  assert.deepEqual(browserErrors, [], 'no uncaught browser exceptions')
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ mode, browser: browser.version(), widths, checks: results.length, results, browserErrors, accessibility, performanceObservations, fakeServiceRequests: requests.length }, null, 2))
  process.stdout.write(JSON.stringify({ checks: results.length, browserErrors, accessibility }) + '\n')
  }
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ error: String(error), completed: results, browserErrors, accessibility }, null, 2))
  throw error
} finally {
  await browser?.close(); child?.kill('SIGTERM'); fake.closeAllConnections(); await new Promise(done => fake.close(done)); await log.close()
}
