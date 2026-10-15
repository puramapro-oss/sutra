import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { get } from 'node:https'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
import { enterTestSession } from '../t07-final-ux-perf-20261015/session.mjs'
import { wireChecks } from './checks.mjs'
import { startWire } from './wire.mjs'
import { startProductionServer } from '../../scripts/ui-isolated/production-server.mjs'

const output = resolve('qa/t07-final-wire-20261016', process.env.T07_OUTPUT)
await mkdir(output) // Preserve every previous receipt, including failures.
const tls = await prepareTLS(), fixture = await startFixture(tls.options)
const wire = await startWire(fixture.user)
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `https://127.0.0.1:${port}`, log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NODE_EXTRA_CA_CERTS: tls.cert, NEXT_PUBLIC_SUPABASE_URL: fixture.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', NEXT_PUBLIC_APP_URL: base,
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture' }
let child, proxy
if (process.argv.includes('--production')) ({ child, proxy } = await startProductionServer({ env, log, port, tls }))
else child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack',
  '--hostname', '127.0.0.1', '--port', String(port), '--experimental-https',
  '--experimental-https-key', tls.key, '--experimental-https-cert', tls.cert,
  '--experimental-https-ca', tls.cert], { env, detached: true, stdio: ['ignore', log.fd, log.fd] })
const results = [], details = [], blocked = [], mutations = [], errors = []
let browser, page
async function check(name, fn) {
  const cancelScenario = /lost submit ACK|already submitted provider/.test(name)
  if (process.env.T07_CANCEL_ONLY === '1' && !cancelScenario && !name.startsWith('loopback only')) return
  try {
    await fn()
    if (process.env.T07_CANCEL_ONLY === '1' && cancelScenario) {
      const jobs = (await wire.sql("SELECT id,kind,provider_job_ids,progress FROM video_jobs WHERE status='cancelled'")).rows
      const events = (await wire.sql("SELECT * FROM activity_logs WHERE type='video_cancelled'")).rows
      assert.equal(events.length, jobs.length, 'one canonical audit event for each UI cancellation')
      for (const job of jobs) {
        const matches = events.filter(event => event.metadata.job_id === job.id)
        assert.equal(matches.length, 1)
        assert.equal(matches[0].user_id, fixture.user.id)
        assert.equal(job.progress.effects['activity_logs:cancelled'], matches[0].id)
        assert.equal(matches[0].metadata.provider_submitted, Object.keys(job.provider_job_ids).length > 0)
      }
    }
    results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`)
  }
  catch (error) {
    results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1
    process.stdout.write(`FAIL ${name}: ${error.message}\n`)
    await page.screenshot({ path: resolve(output, `fail-${results.length}.png`), fullPage: true }).catch(() => {})
  }
}
try {
  let ready = false
  for (let i = 0; i < 90 && child.exitCode === null; i++) {
    try {
      ready = await new Promise((done, fail) => {
        const request = get(base + '/login', { rejectUnauthorized: false }, res => { res.resume(); done(res.statusCode === 200) })
        request.setTimeout(3000, () => request.destroy(new Error('local boot timeout'))); request.on('error', fail)
      })
    } catch { /* local boot */ }
    if (ready) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready)
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce', locale: 'fr-FR', ignoreHTTPSErrors: true })
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (wire.accepts(url.pathname)) {
      const response = await wire.handle(new Request(req.url(), { method: req.method(), ...(req.postData() ? { body: req.postData(), headers: { 'content-type': 'application/json' } } : {}) }))
      return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() }).catch(() => {})
    }
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/legal/accept') {
      if (!['GET', 'HEAD'].includes(req.method())) mutations.push({ path: url.pathname, method: req.method() })
      return route.fulfill({ status: ['GET', 'HEAD'].includes(req.method()) ? 200 : 403, json: {} })
    }
    return route.continue()
  })
  page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error' && /hydration|uncaught/i.test(msg.text())) errors.push(msg.text()) })
  await enterTestSession({ page, base, fixture })
  await wireChecks({ page, context, base, fixture, output, check, details, wire })
  await check('loopback only; no unexpected mutation, runtime or hydration error', async () => {
    assert.deepEqual(blocked, []); assert.deepEqual(mutations, []); assert.deepEqual(errors, [])
  })
} catch (error) { results.push({ name: 'harness', status: 'FAIL', message: error.stack, url: page?.url() }); process.exitCode = 1; await page?.screenshot({ path: resolve(output, 'harness.png'), fullPage: true }).catch(() => {}) }
finally {
  await wire.close(output)
  await browser?.close()
  proxy?.closeAllConnections(); await new Promise(done => proxy ? proxy.close(done) : done())
  try { process.kill(-child.pid, 'SIGTERM') } catch { /* already stopped */ }
  fixture.server.closeAllConnections(); await new Promise(done => fixture.server.close(done)); await log.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseCommit: process.env.T07_CANDIDATE_SHA, cancelOnly: process.env.T07_CANCEL_ONLY === '1', serverMode: process.argv.includes('--production') ? 'production' : 'dev', results, details, blocked, mutations, errors, legalAcceptances: fixture.state.acceptances.map(({ doc_type }) => doc_type) }, null, 2) + '\n')
}
