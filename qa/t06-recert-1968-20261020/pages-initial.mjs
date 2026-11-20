// Page inventory in a real browser. Synthetic account; all application APIs mocked.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, expect } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { enterTestSession } from '../t07-final-ux-perf-20261015/session.mjs'
import { capabilitiesCases } from '../t07-modes-20261014/capabilities-fixtures.mjs'

const require = createRequire(import.meta.url)
const output = resolve('qa/t06-recert-1968-20261020/pages')
await mkdir(output, { recursive: true })
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.equal(candidate, 'fcd0559f611831a57909c693694b92ccb81eba45')
const paths = execFileSync('git', ['ls-files', 'src/app'], { encoding: 'utf8' }).split('\n')
  .filter(path => path.endsWith('/page.tsx'))
  .map(file => ({ file, route: '/' + file.slice(8, -9).split('/').filter(s => !s.startsWith('('))
    .map(s => s.startsWith('[') ? s === '[canal]' ? 'test' : '33333333-3333-4333-8333-333333333333' : s).join('/') }))
const core = ['/dashboard', '/create', '/production', '/library', '/settings', '/settings/social', '/auto/schedules', '/publish']
paths.sort((a, b) => Number(core.includes(b.route)) - Number(core.includes(a.route)))
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
const results = [], errors = [], blocked = [], writes = [], apiReads = []
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
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push({ origin: url.origin, path: url.pathname }); return route.abort() }
    if (url.pathname === '/api/legal/accept') return route.continue()
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push({ method: request.method(), path: url.pathname })
        return route.fulfill({ status: 503, json: { error: 'Service indisponible dans cette simulation.' } })
      }
      apiReads.push(url.pathname)
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
    try {
      const response = await page.goto(base + entry.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.locator('body').waitFor()
      await page.waitForTimeout(850)
      const actual = new URL(page.url()).pathname
      if (actual !== entry.route) {
        results.push({ ...entry, status: 'REDIRECT', actual, http: response?.status(),
          scope: 'non-admin synthetic session; destination recorded, source page not visually certified' })
        continue
      }
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
      for (const width of core.includes(entry.route) ? [320, 375, 768, 1280, 1440] : [375, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.waitForTimeout(250)
        const layout = await page.evaluate(() => ({
          viewport: innerWidth, scroll: document.documentElement.scrollWidth,
          headings: [...document.querySelectorAll('h1')].map(el => el.textContent),
          textLength: document.body.innerText.length,
          applicationError: /Application error: a client-side exception/.test(document.body.innerText),
        }))
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        })).violations.map(({ id, impact, nodes }) => ({
          id, impact, count: nodes.length, nodes: nodes.slice(0, 5).map(node => ({ target: node.target, summary: node.failureSummary })),
        })))
        const status = response.status() === 200 && layout.scroll <= width + 1 && !layout.applicationError
          && layout.textLength > 50 && violations.length === 0 ? 'PASS' : 'FAIL'
        const row = { ...entry, width, status, http: response.status(), layout, violations }
        results.push(row)
        if ((core.includes(entry.route) && [320, 1440].includes(width)) || status === 'FAIL') {
          row.capture = entry.route.replaceAll('/', '_') + `-${width}.png`
          await page.screenshot({ path: resolve(output, row.capture), fullPage: false })
        }
        process.stdout.write(`${status} ${width} ${entry.route}\n`)
      }
    } catch (error) {
      results.push({ ...entry, status: 'FAIL', error: String(error.message).slice(0, 1500) })
      process.stdout.write(`FAIL navigation ${entry.route}\n`)
    } finally {
      await page.close()
      await writeFile(resolve(output, 'results.json'), JSON.stringify({ candidate, mode: 'development, local synthetic session, unknown APIs503',
        inventory: paths, results, errors, blocked, writes, apiReads, realConnections: 0, realPublications: 0 }, null, 2) + '\n')
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
process.exitCode = results.some(row => row.status === 'FAIL') || errors.length || writes.length ? 1 : 0
