// Local application, synthetic identity, genuine legal route, loopback database fixture.
import { nativeRuntimeControls } from '../t01-final-20261015/browser-harness/native-controls.mjs'
import { observeRuntimeErrors } from '../t01-final-20261015/browser-harness/runtime-guard.mjs'
import { finalChecks } from './checks.mjs'
import { socialChecks } from './social-checks.mjs'
import { extraChecks } from './extra-checks.mjs'
import { editorChecks } from './editor-checks.mjs'
import { visualChecks } from './visual-checks.mjs'
import { navigationChecks } from './navigation-checks.mjs'
import { planningChecks } from './planning-checks.mjs'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { get as httpsGet } from 'node:https'
import { resolve } from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { journeyChecks } from '../t07-frontend-journey-20261014/journey-checks.mjs'
import { legalChecks } from '../t07-frontend-journey-20261014/legal-checks.mjs'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeNavigation } from '../../scripts/ui-isolated/navigation-diagnostics.mjs'
import { startProductionServer } from '../../scripts/ui-isolated/production-server.mjs'

const finalIntegrated = process.argv.includes('--final-integrated')
const productionDelta = process.argv.includes('--production-delta')
const productionSuite = process.argv.includes('--production-suite') || productionDelta || finalIntegrated
const baseline = process.argv.includes('--baseline')
const privateDownload = process.argv.includes('--private-download')
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium'
const output = finalIntegrated ? resolve('qa/t01-final-20261015/browser-final') : resolve('qa/t07-final-ux-perf-20261015', `${productionDelta ? 'delta-' : process.argv.includes('--editor') ? 'editor-' : process.argv.includes('--planning') ? 'planning-' : process.argv.includes('--dialog-only') ? 'dialog-' : process.argv.includes('--social') ? 'social-' : ''}${baseline ? 'before' : productionSuite ? 'production' : 'after'}-${engine}`)
// A final campaign must never overwrite a previous receipt.
await mkdir(output, { recursive: !finalIntegrated })
const tls = privateDownload || productionSuite ? await prepareTLS() : null
const fixture = await startFixture(tls?.options)
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `${tls ? 'https' : 'http'}://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
if (tls) env.NODE_EXTRA_CA_CERTS = tls.cert
const initialState = structuredClone(fixture.state)
let child, proxy, browser, engineControl
const summaries = []
async function runScenario(options, scenarioOutput) {
  Object.assign(fixture.state, structuredClone(initialState))
  const output = scenarioOutput
  const privateDownload = options.includes('--private-download')
  await mkdir(output, { recursive: true })
  const results = [], blocked = [], mutations = [], readOnlyProbes = [], details = []
  let context, page, navigationSnapshot, runtimeSnapshot
  async function check(name, run) {
    try { await run(); results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`) }
    catch (error) {
      if (page) await writeFile(resolve(output, `failure-${results.length}.txt`), await page.locator('body').innerText().catch(() => 'body unavailable'))
      results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1
      process.stdout.write(`FAIL ${name}: ${error.message}\n`)
    }
  }
  try {
  context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce', locale: 'fr-FR', ignoreHTTPSErrors: Boolean(tls) })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/legal/accept') return route.continue()
      if (privateDownload && url.pathname.startsWith('/api/media/') && request.method() === 'GET') return route.continue()
      if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
      if (!['GET', 'HEAD'].includes(request.method())) {
        mutations.push({ path: url.pathname, method: request.method() })
        return route.fulfill({ status: 403, json: { error: 'fixture_forbids_mutation' } })
      }
      if (request.method() === 'HEAD') {
        readOnlyProbes.push({ path: url.pathname, method: 'HEAD' })
        return route.fulfill({ status: 200, body: '' })
      }
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort()
    return route.continue()
  })
  page = await context.newPage()
  navigationSnapshot = observeNavigation(page)
  page.setDefaultTimeout(15000)
  runtimeSnapshot = await observeRuntimeErrors(page, { engine: browser.browserType().name(), nativeControl: engineControl, fixtureOrigin: fixture.url })
  if (options.includes('--visual')) await visualChecks({ page, context, base, fixture, output, check, details })
  else if (options.includes('--navigation')) await navigationChecks({ page, context, base, fixture, output, check, details, runtimeSnapshot })
  else if (options.includes('--editor')) await editorChecks({ page, context, base, fixture, output, check, details })
  else if (options.includes('--extra')) await extraChecks({ page, context, base, fixture, output, check, details })
  else if (options.includes('--planning')) await planningChecks({ page, context, base, fixture, output, check, details })
  else if (options.includes('--social')) await socialChecks({ page, context, base, fixture, output, check, details })
  else if (!productionSuite || options.includes('--final')) await finalChecks({ page, context, base, fixture, output, check, details, options, keyboardKey: engineControl.keyboard.key })
  else if (options.includes('--journeys')) await journeyChecks({ page, context, base, fixture, output, check, details, options })
  else await legalChecks({ page, context, base, fixture, output, baseline, check, details })
  await check('no unexpected mutation, uncaught error or hydration mismatch', async () => {
    assert.deepEqual(runtimeSnapshot().unexpected, []); assert.deepEqual(mutations, [])
  })
  } catch (error) {
    results.push({ name: 'harness', status: 'FAIL', message: error.stack }); process.exitCode = 1
    process.stderr.write(error.stack + '\n')
    if (page) await page.screenshot({ path: resolve(output, 'diagnostic.png'), fullPage: true }).catch(() => {})
  } finally {
    if (navigationSnapshot) await writeFile(resolve(output, 'navigation.json'), JSON.stringify(navigationSnapshot(), null, 2) + '\n')
    const runtime = runtimeSnapshot?.() ?? { errors: [], unexpected: [], qualified: [] }
    if (runtimeSnapshot) await writeFile(resolve(output, 'runtime-errors.json'), JSON.stringify(runtime, null, 2) + '\n')
    await context?.close()
    await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseline, productionSuite, finalIntegrated, results, details, errors: runtime.errors, unexpectedErrors: runtime.unexpected, qualifiedEngineDiagnostics: runtime.qualified, blocked, mutations, readOnlyProbes, writes: fixture.state.writes, acceptances: fixture.state.acceptances.map(({ user_id, doc_type, version }) => ({ user_id, doc_type, version })) }, null, 2) + '\n')
    summaries.push({ engine: browser?.browserType().name(), options, output, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length })
  }
}
try {
  const tlsArgs = tls ? ['--experimental-https', '--experimental-https-key', tls.key, '--experimental-https-cert', tls.cert, '--experimental-https-ca', tls.cert] : []
  if (productionSuite) ({ child, proxy } = await startProductionServer({ env, log, port, tls }))
  else child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port), ...tlsArgs], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  await writeFile(resolve(output, 'owned-server.json'), JSON.stringify({ pid: child.pid, base, cwd: process.cwd() }) + '\n')
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const ok = tls ? await new Promise((done, fail) => {
        const request = httpsGet(`${base}/login`, { rejectUnauthorized: false }, response => { response.resume(); done(response.statusCode === 200) })
        request.setTimeout(3000, () => request.destroy(new Error('local TLS boot timeout'))); request.on('error', fail)
      }) : (await fetch(`${base}/login`, { signal: AbortSignal.timeout(3000) })).ok
      if (ok) { ready = true; break }
    } catch { /* local boot */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'fixture app ready')
  if (productionSuite) {
    // One build, browser engines sequential, isolated database/browser state per scenario.
    for (const browserName of ['chromium', 'webkit']) {
      browser = await ({ chromium, webkit }[browserName]).launch({ headless: true })
      engineControl = await nativeRuntimeControls(browser)
      await writeFile(resolve(output, `native-${browserName}.json`), JSON.stringify(engineControl, null, 2) + '\n')
      const cases = finalIntegrated ? [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']], ['legal', ['--legal']], ['journey', ['--journeys']], ['private-download', ['--journeys', '--private-download']], ['extra', ['--extra']], ['editor', ['--editor']], ['visual', ['--visual']], ['navigation', ['--navigation']]] : productionDelta ? [['editor', ['--editor']], ['visual', ['--visual']], ['navigation', ['--navigation']]] : browserName === 'webkit'
        ? [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']], ['journey', ['--journeys']], ['private-download', ['--journeys', '--private-download']], ['extra', ['--extra']]]
        : [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']]]
      for (const [name, options] of cases) await runScenario(options, resolve(output, browserName, name))
      await browser.close(); browser = null
    }
    if (finalIntegrated) assert.equal(summaries.length, 20, 'all ten scenarios ran in both engines')
  } else {
    browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
    engineControl = await nativeRuntimeControls(browser)
    await writeFile(resolve(output, `native-${engine}.json`), JSON.stringify(engineControl, null, 2) + '\n')
    await runScenario(process.argv, output)
  }
} catch (error) {
  process.exitCode = 1
  summaries.push({ name: 'server', fail: 1, message: error.stack })
  process.stderr.write(error.stack + '\n')
} finally {
  await browser?.close()
  if (proxy) { proxy.closeAllConnections(); await new Promise(done => proxy.close(done)) }
  if (child && child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections(); await new Promise(done => fixture.server.close(done))
  await log.close()
  if (productionSuite) await writeFile(resolve(output, 'summary.json'), JSON.stringify({ productionSuite, finalIntegrated, singleBuild: true, nativeSafari: false, summaries }, null, 2) + '\n')
}
