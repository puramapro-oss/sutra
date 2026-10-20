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
const phase = process.argv.includes('--after') ? 'after' : 'before'
const output = resolve(`qa/t06-recert-1968-20261020/publish-${phase}`)
await mkdir(output, { recursive: true })
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.equal(candidate, 'fcd0559f611831a57909c693694b92ccb81eba45')
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
let child, browser, postMode = 'empty', readError = false
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
      if (url.pathname === '/rest/v1/scheduled_posts') {
        if (readError) return route.fulfill({ status: 503, json: { message: 'private-fixture-diagnostic-not-for-ui' } })
        const scheduled = url.searchParams.get('status') === 'eq.scheduled'
        return route.fulfill({ json: postMode === 'empty' ? [] : [{
          id: '44444444-4444-4444-8444-444444444444', video_id: '33333333-3333-4333-8333-333333333333',
          platform: 'youtube', status: scheduled ? 'scheduled' : 'published',
          scheduled_at: '2026-10-25T08:30:00.000Z', created_at: '2026-10-20T08:30:00.000Z',
        }] })
      }
      return route.continue()
    }
    if (url.origin !== base) { blocked.push({ origin: url.origin, path: url.pathname }); return route.abort() }
    if (url.pathname === '/api/legal/accept') return route.continue()
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
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
  const page = await context.newPage()
  page.on('pageerror', error => errors.push({ message: error.message }))
  const check = async (name, action) => {
    try { const detail = await action(); results.push({ name, status: 'PASS', detail }) }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message.slice(0, 1000) }) }
    process.stdout.write(`${results.at(-1).status} ${name}\n`)
  }
  for (const mode of ['empty', 'populated']) {
    postMode = mode
    await page.goto(base + '/publish', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('publish-title')).toBeVisible()
    await expect(page.getByTestId('publish-loading')).toHaveCount(0)
    await expect(page.getByText(mode === 'empty' ? 'Aucune publication programmee' : 'Programmee', { exact: true })).toBeVisible()
    await page.waitForTimeout(700)
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
    for (const width of [320, 375, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(200)
      await check(`${mode}-${width}-axe-layout`, async () => {
        const violations = await page.evaluate(async () => (await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        })).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })))
        await writeFile(resolve(output, `${mode}-${width}-axe.json`), JSON.stringify(violations, null, 2) + '\n')
        await page.screenshot({ path: resolve(output, `${mode}-${width}.png`) })
        assert.deepEqual(violations, [])
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      })
    }
  }
  await check('read-error-not-empty-and-manual-recovery', async () => {
    readError = true
    await page.goto(base + '/publish', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1600)
    await page.screenshot({ path: resolve(output, 'read-error.png') })
    assert.equal(await page.getByRole('alert').count(), 1, 'failed read requires persistent accessible error')
    assert.equal(await page.getByText('Aucune publication programmee', { exact: true }).count(), 0, 'unknown is not empty')
    assert.equal((await page.locator('body').innerText()).includes('private-fixture-diagnostic-not-for-ui'), false)
    readError = false
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
    await expect(page.getByText('Programmee', { exact: true })).toBeVisible()
  })
  await page.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ candidate, phase, results, errors, blocked, writes,
    realConnections: 0, realPublications: 0, mode: 'development; synthetic empty/populated/503 reads' }, null, 2) + '\n')
  await context.close()
} finally {
  await browser?.close()
  if (child?.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections()
  await new Promise(done => fixture.server.close(done))
  await log.close()
}
process.exitCode = results.some(row => row.status === 'FAIL') || errors.length || writes.length ? 1 : 0
