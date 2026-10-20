// R121 regression. Reuses the existing T07 fixture/session; loopback only.
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

const require = createRequire(import.meta.url)
const phase = process.argv[2]
assert.ok(['before', 'after'].includes(phase))
const output = resolve(`qa/t02-final-memoire-20261020/${phase}`)
await mkdir(output)
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const source = 'src/lib/legal/components/MaMemoirePage.tsx'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sourceSha256 = sha(await readFile(source))
const harnessSha256 = sha(await readFile(new URL(import.meta.url)))
const fixture = await startFixture()
const probe = createServer()
probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port
await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const environment = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base,
}
const results = [], errors = [], blocked = [], writes = []
let child, browser, exportStatus = 200, exportRequests = 0, downloads = 0
const check = async (name, run) => {
  try { await run(); results.push({ name, status: 'PASS' }) }
  catch (error) { results.push({ name, status: 'FAIL', error: String(error.message).slice(0, 1500) }) }
}
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
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
    if (url.pathname === '/api/legal/my-data' && request.method() === 'GET') {
      exportRequests++
      if (exportStatus === 200) return route.continue()
      return route.fulfill({ status: exportStatus, json: { error: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' } })
    }
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(request.method())) writes.push({ method: request.method(), path: url.pathname })
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
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('download', () => downloads++)
  await enterTestSession({ page, base, fixture })
  const response = await page.goto(base + '/ma-memoire', { waitUntil: 'networkidle', timeout: 60000 })
  assert.equal(response.status(), 200)
  const button = page.getByRole('button', { name: 'Exporter mes données (JSON)', exact: true })
  await expect(button).toBeVisible()
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') })
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(250)
    const violations = await page.evaluate(async () => (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    })).violations.map(({ id, impact, nodes }) => ({
      id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })))
    const colors = await button.evaluate(el => ({
      foreground: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor,
      fontSize: getComputedStyle(el).fontSize,
    }))
    results.push({ name: `WCAG AA ${width}px`, status: violations.length ? 'FAIL' : 'PASS', colors, violations })
    await check(`No horizontal overflow ${width}px`, async () => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    })
    await page.screenshot({ path: resolve(output, `ma-memoire-${width}.png`) })
  }
  if (phase === 'after') {
    for (const status of [401, 403, 503]) {
      await check(`Export ${status}: visible refusal, no download or private diagnostic`, async () => {
        exportStatus = status
        const before = downloads, requests = exportRequests
        await button.focus(); await expect(button).toBeFocused(); await button.press('Enter')
        await expect(page.getByText(`Export impossible (${status})`, { exact: true })).toBeVisible()
        await expect(button).toBeEnabled()
        assert.equal(exportRequests, requests + 1)
        assert.equal(downloads, before)
        assert.ok(!(await page.locator('body').innerText()).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'))
      })
    }
    await check('Successful retry downloads real local API JSON for the session owner', async () => {
      exportStatus = 200
      const pending = page.waitForEvent('download')
      await button.press('Enter')
      const download = await pending
      assert.equal(download.suggestedFilename(), 'mes-donnees.json')
      const data = JSON.parse(await readFile(await download.path(), 'utf8'))
      assert.equal(data.compte.id, fixture.user.id)
      assert.equal(data.profile.id, fixture.user.id)
      assert.equal(data.acceptationsLegales.length, 4)
      await expect(button).toBeEnabled()
      await expect(page.getByText(/Export impossible/)).toHaveCount(0)
    })
  }
  await check('No unexpected mutation or uncaught browser error', async () => {
    assert.deepEqual(writes, []); assert.deepEqual(errors, [])
    assert.equal(fixture.state.writes.length, 4, 'only four explicit synthetic legal acceptances')
  })
  await context.close()
} catch (error) {
  results.push({ name: 'Browser setup/runtime', status: 'FAIL', error: String(error.message).slice(0, 1500) })
} finally {
  await browser?.close()
  if (child?.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections()
  await new Promise(done => fixture.server.close(done))
  await log.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({
    candidate, source, sourceSha256, harnessSha256, phase, mode: 'DEV loopback synthetic identity; no production proof',
    results, errors, writes, blocked, exportRequests, downloads, remoteCalls: 0,
  }, null, 2) + '\n')
}
for (const result of results) process.stdout.write(`${result.status} ${result.name}\n`)
process.exitCode = results.some(result => result.status === 'FAIL') ? 1 : 0
