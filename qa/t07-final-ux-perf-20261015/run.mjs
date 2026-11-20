// Local application, synthetic identity, genuine legal route, loopback database fixture.
import { nativeRuntimeControls } from '../t01-final-20261015/browser-harness/native-controls.mjs'
import { observeRuntimeErrors } from '../t01-final-20261015/browser-harness/runtime-guard.mjs'
import { installFixtureReadBarrier } from '../t01-final-20261015/browser-harness/social-read-barrier-20261015/fixture-read-barrier.mjs'
import { finalChecks } from './checks.mjs'
import { socialChecks } from './social-checks.mjs'
import { extraChecks } from './extra-checks.mjs'
import { editorChecks } from './editor-checks.mjs'
import { visualChecks } from './visual-checks.mjs'
import { navigationChecks } from './navigation-checks.mjs'
import { planningChecks } from './planning-checks.mjs'
import { checks as schedulerCancellationChecks } from '../t07-scheduler-cancel-20261015/checks.mjs'
import { reconcileChecks } from '../t07-scheduler-cancel-20261015/reconcile-checks.mjs'
import { casChecks } from '../t07-final-two-20261015/cas-checks.mjs'
import { socialReloadChecks } from '../t01-closure-20261015/social-reload-checks.mjs'
import { enterTestSession } from './session.mjs'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { access, lstat, mkdir, open, stat, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { get as httpsGet } from 'node:https'
import { dirname, resolve } from 'node:path'
import { chromium, webkit } from '@playwright/test'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { journeyChecks } from '../t07-frontend-journey-20261014/journey-checks.mjs'
import { legalChecks } from '../t07-frontend-journey-20261014/legal-checks.mjs'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeNavigation } from '../../scripts/ui-isolated/navigation-diagnostics.mjs'
import { startProductionServer } from '../../scripts/ui-isolated/production-server.mjs'
import { ciHeapOptions } from '../../tooling/ci-heap.mjs'

const args = process.argv.slice(2)
const nodeOptions = [...ciHeapOptions(process.env.SUTRA_CI_HEAP_MB), `--require=${resolve('qa/t08/offline.cjs')}`].join(' ')
const flags = new Set(['--final-integrated', '--production-legal', '--production-delta', '--production-suite',
  '--baseline', '--private-download', '--webkit', '--editor', '--planning', '--dialog-only', '--social',
  '--schedule-cas', '--social-reload', '--scheduler-cancellation', '--production-reconcile', '--visual',
  '--navigation', '--extra', '--final', '--journeys', '--legal', '--validate-cli'])
for (const arg of args) {
  if (!flags.has(arg) && !arg.startsWith('--engine=') && !arg.startsWith('--out=') && !arg.startsWith('--scenarios=')) throw new Error(`Unknown argument: ${arg.split('=')[0]}`)
}
function singleOption(name) {
  const values = args.filter(arg => arg.startsWith(`${name}=`))
  assert.ok(values.length <= 1, `${name} must be supplied at most once`)
  return values.length ? values[0].slice(name.length + 1) : undefined
}
const finalIntegrated = args.includes('--final-integrated')
const productionLegal = args.includes('--production-legal')
const productionDelta = args.includes('--production-delta')
assert.ok([finalIntegrated, productionLegal, productionDelta].filter(Boolean).length <= 1, 'Choose one specialised production suite')
const productionSuite = args.includes('--production-suite') || productionDelta || productionLegal || finalIntegrated
const baseline = args.includes('--baseline')
const privateDownload = args.includes('--private-download')
const selectedEngine = singleOption('--engine')
assert.ok(selectedEngine === undefined || ['chromium', 'webkit', 'all'].includes(selectedEngine), '--engine must be chromium, webkit or all')
assert.ok(!(selectedEngine && args.includes('--webkit')), 'Use --engine or the legacy --webkit alias, not both')
const engine = selectedEngine ?? (args.includes('--webkit') ? 'webkit' : productionSuite ? 'all' : 'chromium')
const enginesRequested = engine === 'all' ? ['chromium', 'webkit'] : [engine]
const enginesExecuted = []
const explicitScenarios = singleOption('--scenarios')
assert.ok(explicitScenarios === undefined || productionSuite, '--scenarios is available only for a production suite')
const scenarioSelection = explicitScenarios === undefined ? null : explicitScenarios.split(',').map(name => name.trim())
if (scenarioSelection) {
  assert.ok(scenarioSelection.every(Boolean), '--scenarios must not contain empty names')
  assert.equal(new Set(scenarioSelection).size, scenarioSelection.length, '--scenarios must not contain duplicate names')
}
const explicitOutput = singleOption('--out')
// Preserve historical default receipt paths; explicit --engine and --out opt in to new paths.
const outputEngine = selectedEngine ?? (args.includes('--webkit') ? 'webkit' : 'chromium')
function localPath(value, option) {
  assert.ok(value.trim() && !value.includes('\0') && !/^[a-z][a-z0-9+.-]*:/i.test(value), `${option} requires a local filesystem path`)
  return resolve(value)
}
const output = explicitOutput !== undefined ? localPath(explicitOutput, '--out') : finalIntegrated ? resolve('qa/t01-final-20261015/browser-final') : resolve('qa/t07-final-ux-perf-20261015', `${productionLegal ? 'legal-' : productionDelta ? 'delta-' : args.includes('--editor') ? 'editor-' : args.includes('--planning') ? 'planning-' : args.includes('--dialog-only') ? 'dialog-' : args.includes('--social') ? 'social-' : ''}${baseline ? 'before' : productionSuite ? 'production' : 'after'}-${outputEngine}`)
const protectedOutput = finalIntegrated || productionLegal || explicitOutput !== undefined || scenarioSelection !== null
if (protectedOutput) {
  const existing = await lstat(output).catch(error => { if (error.code === 'ENOENT') return null; throw error })
  assert.equal(existing, null, 'Output already exists; choose a new receipt directory')
  assert.ok((await lstat(dirname(output))).isDirectory(), 'Output parent must be an existing directory')
}
const chromiumPath = enginesRequested.includes('chromium') && process.env.SUTRA_CHROMIUM_PATH
  ? localPath(process.env.SUTRA_CHROMIUM_PATH, 'SUTRA_CHROMIUM_PATH') : undefined
if (chromiumPath) {
  assert.ok((await stat(chromiumPath)).isFile(), 'SUTRA_CHROMIUM_PATH must point to an executable file')
  await access(chromiumPath, constants.X_OK)
}
const launchOptions = browserName => ({ headless: true,
  ...(browserName === 'chromium' && chromiumPath ? { executablePath: chromiumPath } : {}) })
function scenarioCases(browserName) {
  const cases = productionLegal ? [['legal', ['--legal']]] : finalIntegrated ? [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']], ['legal', ['--legal']], ['journey', ['--journeys']], ['private-download', ['--journeys', '--private-download']], ['extra', ['--extra']], ['editor', ['--editor']], ['visual', ['--visual']], ['navigation', ['--navigation']]] : productionDelta ? [['editor', ['--editor']], ['visual', ['--visual']], ['navigation', ['--navigation']]] : browserName === 'webkit'
    ? [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']], ['journey', ['--journeys']], ['private-download', ['--journeys', '--private-download']], ['extra', ['--extra']]]
    : [['final', ['--final']], ['social', ['--social']], ['planning', ['--planning']]]
  if (finalIntegrated && browserName === 'chromium') cases.push(
    ['scheduler-cancellation', ['--scheduler-cancellation']],
    ['production-reconcile', ['--production-reconcile']],
  )
  if (finalIntegrated) cases.push(['schedule-cas', ['--schedule-cas']], ['social-reload', ['--social-reload']])
  return cases
}
const catalogScenarios = productionSuite ? ['chromium', 'webkit'].flatMap(browserName =>
  scenarioCases(browserName).map(([name]) => ({ engine: browserName, name }))) : []
if (scenarioSelection) {
  const available = new Set(catalogScenarios.filter(item => enginesRequested.includes(item.engine)).map(item => item.name))
  assert.ok(scenarioSelection.every(name => available.has(name)), 'Unknown scenario for the requested production suite or engines')
}
const selectedScenarioCases = browserName => scenarioCases(browserName)
  .filter(([name]) => scenarioSelection === null || scenarioSelection.includes(name))
const scenariosRequested = productionSuite ? enginesRequested.flatMap(browserName =>
  selectedScenarioCases(browserName).map(([name]) => ({ engine: browserName, name }))) : []
const expectedScenarios = productionSuite ? scenariosRequested.length : enginesRequested.length
if (finalIntegrated) {
  assert.equal(scenarioCases('chromium').length, 14, 'fourteen integrated Chromium scenarios')
  assert.equal(scenarioCases('webkit').length, 12, 'twelve integrated WebKit scenarios')
  assert.equal(catalogScenarios.length, 26, 'twenty-six integrated scenarios in the complete catalogue')
}
if (args.includes('--validate-cli')) {
  process.stdout.write(JSON.stringify({ cliValidation: 'PASS', enginesRequested, enginesExecuted, expectedScenarios, output,
    scenarioSelection: scenarioSelection ?? 'all', scenariosRequested, scenariosExecuted: [], scenariosNotExecuted: catalogScenarios,
    chromiumExecutable: chromiumPath ?? null, nodeOptions, coverage: 'NON_TESTÉ', nativeSafari: false }) + '\n')
  process.exit(0)
}
// A final campaign must never overwrite a previous receipt.
await mkdir(output, { recursive: !protectedOutput })
const tls = privateDownload || productionSuite ? await prepareTLS() : null
const fixture = await startFixture(tls?.options)
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `${tls ? 'https' : 'http'}://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: nodeOptions, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
if (tls) env.NODE_EXTRA_CA_CERTS = tls.cert
const initialState = structuredClone(fixture.state)
let child, proxy, browser, engineControl
const summaries = []
async function runScenario(options, scenarioOutput, scenarioName) {
  Object.assign(fixture.state, structuredClone(initialState))
  const output = scenarioOutput
  const privateDownload = options.includes('--private-download')
  await mkdir(output, { recursive: true })
  const results = [], blocked = [], mutations = [], readOnlyProbes = [], details = []
  let context, page, navigationSnapshot, runtimeSnapshot, fixtureReadSnapshot
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
      if (url.pathname === '/api/social/autopilot') return route.fulfill({ json: { config: {
        enabled: false, default_platforms: [], auto_caption: true, auto_hashtags: true,
        caption_style: 'professional', max_hashtags: 5, include_cta: false,
      } } })
      return route.fulfill({ json: { should_show: false, accounts: [], videos: [], notifications: [], data: [] } })
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort()
    return route.continue()
  })
  page = await context.newPage()
  navigationSnapshot = observeNavigation(page)
  page.setDefaultTimeout(15000)
  runtimeSnapshot = await observeRuntimeErrors(page, { engine: browser.browserType().name(), nativeControl: engineControl, fixtureOrigin: fixture.url })
  if (options.includes('--social') || options.includes('--social-reload') || options.includes('--legal')) fixtureReadSnapshot = installFixtureReadBarrier(page, { appOrigin: base, fixtureOrigin: fixture.url, userId: fixture.user.id, includeLibrary: options.includes('--legal') })
  if (options.includes('--schedule-cas') || options.includes('--social-reload')) {
    await enterTestSession({ page, base, fixture })
    const run = options.includes('--schedule-cas') ? casChecks : socialReloadChecks
    await run({ page, context, base, fixture, output, check, details, production: productionSuite })
  }
  else if (options.includes('--scheduler-cancellation') || options.includes('--production-reconcile')) {
    await enterTestSession({ page, base, fixture })
    const run = options.includes('--production-reconcile') ? reconcileChecks : schedulerCancellationChecks
    await run({ page, context, base, fixture, output, check, details, before: false })
  }
  else if (options.includes('--visual')) await visualChecks({ page, context, base, fixture, output, check, details })
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
    if (fixtureReadSnapshot) await writeFile(resolve(output, 'fixture-read-barrier.json'), JSON.stringify(fixtureReadSnapshot(), null, 2) + '\n')
    const runtime = runtimeSnapshot?.() ?? { errors: [], unexpected: [], qualified: [] }
    if (runtimeSnapshot) await writeFile(resolve(output, 'runtime-errors.json'), JSON.stringify(runtime, null, 2) + '\n')
    await context?.close()
    await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseline, productionSuite, finalIntegrated, results, details, errors: runtime.errors, unexpectedErrors: runtime.unexpected, qualifiedEngineDiagnostics: runtime.qualified, blocked, mutations, readOnlyProbes, writes: fixture.state.writes, acceptances: fixture.state.acceptances.map(({ user_id, doc_type, version }) => ({ user_id, doc_type, version })) }, null, 2) + '\n')
    summaries.push({ engine: browser?.browserType().name(), scenario: scenarioName, options, output, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length })
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
    for (const browserName of enginesRequested) {
      const cases = selectedScenarioCases(browserName)
      if (cases.length === 0) continue
      browser = await ({ chromium, webkit }[browserName]).launch(launchOptions(browserName))
      engineControl = await nativeRuntimeControls(browser)
      enginesExecuted.push(browserName)
      await writeFile(resolve(output, `native-${browserName}.json`), JSON.stringify(engineControl, null, 2) + '\n')
      for (const [name, options] of cases) await runScenario(options, resolve(output, browserName, name), name)
      await browser.close(); browser = null
    }
    if (finalIntegrated && scenarioSelection === null) assert.equal(summaries.length, engine === 'all' ? 26 : engine === 'chromium' ? 14 : 12,
      'twelve scenarios per selected engine and two additional Chromium closure scenarios')
    assert.equal(summaries.length, expectedScenarios, 'every requested production scenario must execute exactly once')
  } else {
    for (const browserName of enginesRequested) {
      browser = await ({ chromium, webkit }[browserName]).launch(launchOptions(browserName))
      engineControl = await nativeRuntimeControls(browser)
      enginesExecuted.push(browserName)
      await writeFile(resolve(output, `native-${browserName}.json`), JSON.stringify(engineControl, null, 2) + '\n')
      await runScenario(process.argv, enginesRequested.length > 1 ? resolve(output, browserName) : output)
      await browser.close(); browser = null
    }
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
  const scenariosExecuted = summaries.filter(summary => summary.scenario)
    .map(summary => ({ engine: summary.engine, name: summary.scenario }))
  const scenariosNotExecuted = catalogScenarios.filter(item => !scenariosExecuted.some(executed =>
    executed.engine === item.engine && executed.name === item.name))
  const coverage = ['chromium', 'webkit'].every(name => enginesExecuted.includes(name)) && scenariosNotExecuted.length === 0 ? 'COMPLETE' : 'PARTIEL'
  const failed = Boolean(process.exitCode) || summaries.some(summary => summary.fail > 0)
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ status: failed ? 'FAIL' : coverage === 'COMPLETE' ? 'PASS' : 'PARTIEL',
    coverage, enginesRequested, enginesExecuted, enginesNotExecuted: ['chromium', 'webkit'].filter(name => !enginesExecuted.includes(name)),
    scenarioSelection: scenarioSelection ?? 'all', scenariosRequested, scenariosExecuted, scenariosNotExecuted,
    expectedScenarios, productionSuite, finalIntegrated, singleBuild: productionSuite, nativeSafari: false, summaries }, null, 2) + '\n')
}
