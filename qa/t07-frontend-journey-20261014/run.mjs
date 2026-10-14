// Local application, synthetic identity, genuine legal route, loopback database fixture.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { get as httpsGet } from 'node:https'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { startFixture } from './fixture.mjs'
import { journeyChecks } from './journey-checks.mjs'
import { legalChecks } from './legal-checks.mjs'
import { prepareTLS } from './tls-fixture.mjs'

const journeys = process.argv.includes('--journeys')
const baseline = process.argv.includes('--baseline')
const privateDownload = process.argv.includes('--private-download')
const output = resolve('qa/t07-frontend-journey-20261014', privateDownload ? 'private-download-after' : process.argv.includes('--player') ? 'player-regression' : process.argv.includes('--visual-download') ? 'visual-download' : process.argv.includes('--visual') ? 'visual' : process.argv.includes('--retry') ? 'journey-retry' : journeys ? (process.argv.includes('--repro') ? 'journey-before' : 'journey-after') : baseline ? 'before' : 'after')
await mkdir(output, { recursive: true })
const tls = privateDownload ? await prepareTLS() : null
const fixture = await startFixture(tls?.options)
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `${privateDownload ? 'https' : 'http'}://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
if (tls) env.NODE_EXTRA_CA_CERTS = tls.cert
const results = [], errors = [], blocked = [], mutations = [], details = []
let child, browser, page
async function check(name, run) {
  try { await run(); results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`) }
  catch (error) { if (page) { await writeFile(resolve(output, `failure-${results.length}.txt`), await page.locator('body').innerText().catch(() => 'body unavailable')); } results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1; process.stdout.write(`FAIL ${name}: ${error.message}\n`) }
}
try {
  browser = await chromium.launch({ headless: true })
  const tlsArgs = tls ? ['--experimental-https', '--experimental-https-key', tls.key, '--experimental-https-cert', tls.cert, '--experimental-https-ca', tls.cert] : []
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port), ...tlsArgs], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  await writeFile(resolve(output, 'owned-server.json'), JSON.stringify({ pid: child.pid, base, cwd: process.cwd() }) + '\n')
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const ok = privateDownload ? await new Promise((done, fail) => {
        const request = httpsGet(`${base}/login`, { rejectUnauthorized: false }, response => { response.resume(); done(response.statusCode === 200) })
        request.setTimeout(3000, () => request.destroy(new Error('local TLS boot timeout'))); request.on('error', fail)
      }) : (await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok
      if (ok) { ready = true; break }
    } catch { /* local boot */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'fixture app ready')
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', locale: 'fr-FR', ignoreHTTPSErrors: privateDownload })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/legal/accept') return route.continue()
      if (privateDownload && url.pathname.startsWith('/api/media/') && request.method() === 'GET') return route.continue()
      if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
      if (request.method() !== 'GET') {
        mutations.push({ path: url.pathname, method: request.method() })
        return route.fulfill({ status: 403, json: { error: 'fixture_forbids_mutation' } })
      }
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort()
    return route.continue()
  })
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /hydration|did not match|server rendered/i.test(m.text())) errors.push(m.text()) })
  if (journeys) await journeyChecks({ page, context, base, fixture, output, check, details })
  else await legalChecks({ page, context, base, fixture, output, baseline, check, details })
  await check('no unexpected mutation, uncaught error or hydration mismatch', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(mutations, [])
  })
} catch (error) {
  results.push({ name: 'harness', status: 'FAIL', message: error.stack }); process.exitCode = 1
  process.stderr.write(error.stack + '\n')
  if (page) await page.screenshot({ path: resolve(output, 'diagnostic.png'), fullPage: true }).catch(() => {})
} finally {
  await browser?.close()
  if (child && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections(); await new Promise(done => fixture.server.close(done))
  await log.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseline, results, details, errors, blocked, mutations, writes: fixture.state.writes, acceptances: fixture.state.acceptances.map(({ user_id, doc_type, version }) => ({ user_id, doc_type, version })) }, null, 2) + '\n')
}
