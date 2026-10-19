// Real browser, synthetic local session, all publication requests intercepted.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { get } from 'node:https'
import { once } from 'node:events'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium, webkit, expect } from '@playwright/test'
import { startProductionServer } from '../../scripts/ui-isolated/production-server.mjs'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
import { capabilitiesCases } from '../t07-modes-20261014/capabilities-fixtures.mjs'
import { enterTestSession } from '../t07-final-ux-perf-20261015/session.mjs'
import { nativeRuntimeControls } from '../t01-final-20261015/browser-harness/native-controls.mjs'
import { observeRuntimeErrors } from '../t01-final-20261015/browser-harness/runtime-guard.mjs'

const require = createRequire(import.meta.url)
const production = process.argv.includes('--production')
const connectOnly = process.argv.includes('--connect-only')
const engines = process.argv.includes('--both-engines') ? ['chromium', 'webkit'] : [process.argv.includes('--webkit') ? 'webkit' : 'chromium']
let engine = engines[0]
const output = resolve('qa/t06-closure-79cd95b-20261020', process.argv.find(x => x.startsWith('--out='))?.slice(6) ?? 'journeys-before')
await mkdir(output, { recursive: true })
const tls = production ? await prepareTLS() : null
const fixture = await startFixture(tls?.options)
const initialFixtureState = structuredClone(fixture.state)
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
const port = probe.address().port; await new Promise(done => probe.close(done))
const base = `${production ? 'https' : 'http'}://127.0.0.1:${port}`, log = await open(resolve(output, 'server.log'), 'w')
const env = { ...(tls ? { NODE_EXTRA_CA_CERTS: tls.cert } : {}), PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base }
const checks = [], blocked = [], writes = [], snapshots = [], axes = [], observations = [], engineResults = []
let child, proxy, browser, engineControl, capability = capabilitiesCases.find(([name]) => name === 'client'), connectMode = 'error', createMode = 'refused', accountMode = 'empty', connectRelease
const config = { enabled: false, default_platforms: [], auto_caption: true, auto_hashtags: true, caption_style: 'engaging', max_hashtags: 10, include_cta: true }
const account = { id: '11111111-1111-4111-8111-111111111111', platform: 'youtube', username: 'chaine-test', display_name: 'Chaîne test', status: 'revoked', connected_at: '2026-01-01T00:00:00Z', avatar_url: null }
async function check(name, fn) { try { await fn(); checks.push({ name, status: 'PASS' }) } catch(e) { checks.push({ name, status:'FAIL', error: String(e.message).slice(0,2500) }) } process.stdout.write(`${checks.at(-1).status} ${name}\n`) }
try {
  if (production) ({ child, proxy } = await startProductionServer({ env, log, port, tls }))
  else child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...(production ? ['start'] : ['dev', '--webpack']), '--hostname', '127.0.0.1', '--port', String(port)], { cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd] })
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      const ok = production ? await new Promise((done, fail) => {
        const request = get(base + '/login', { ca: tls.options.cert }, res => { res.resume(); done(res.statusCode === 200) })
        request.setTimeout(2500, () => request.destroy(new Error('local boot timeout'))); request.on('error', fail)
      }) : (await fetch(base + '/login', { signal: AbortSignal.timeout(2500) })).ok
      if (ok) { ready = true; break }
    } catch { /* loopback startup */ }
    if (child.exitCode !== null) break
    await new Promise(done => setTimeout(done, 500))
  }
  assert.ok(ready, 'local fixture app ready')
  for (engine of engines) {
  Object.assign(fixture.state, structuredClone(initialFixtureState))
  const firstCheck = checks.length
  blocked.length = writes.length = snapshots.length = axes.length = observations.length = 0
  capability = capabilitiesCases.find(([name]) => name === 'client')
  connectMode = 'error'; createMode = 'refused'; accountMode = 'empty'
  browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' && process.platform === 'darwin' ? { channel: 'chrome' } : {}) })
  engineControl = await nativeRuntimeControls(browser)
  await writeFile(resolve(output, `native-${engine}.json`), JSON.stringify(engineControl, null, 2) + '\n')
  const context = await browser.newContext({ ignoreHTTPSErrors: production, viewport: { width: 375, height: 900 }, timezoneId: 'Pacific/Honolulu', reducedMotion: 'reduce', locale: 'fr-FR' })
  context.setDefaultTimeout(15_000)
  context.setDefaultNavigationTimeout(30_000)
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin === fixture.url) return route.continue()
    if (url.origin !== base) { blocked.push(url.origin); return route.abort() }
    if (url.pathname === '/mock-consent') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Consent fixture</title><h1>Consentement personnel requis</h1><button>Accepter personnellement</button>' })
    if (url.pathname === '/api/legal/accept') return route.continue()
    if (url.pathname === '/api/legal/cookie-consent') return route.fulfill({ json: { success: true } })
    if (url.pathname.startsWith('/api/')) {
      if (!['GET','HEAD'].includes(req.method())) writes.push({ path: url.pathname, method: req.method(), body: req.postDataJSON(), key: req.headers()['idempotency-key'] })
      if (url.pathname === '/api/social/accounts') return route.fulfill({ json: { accounts: accountMode === 'empty' ? [] : [account] } })
      if (url.pathname === '/api/social/autopilot') return route.fulfill({ json: { config } })
      if (url.pathname === '/api/social/connect') {
        const mode = connectMode
        if (mode.startsWith('slow')) await new Promise(done => { connectRelease = done })
        if (mode.endsWith('success')) return route.fulfill({ json: { oauthUrl: base + '/mock-consent' } }).catch(() => {})
        return route.fulfill({ status: 503, json: { error: 'fixture_private_token_never_display' } }).catch(() => {})
      }
      if (url.pathname === '/api/video/capabilities') return route.fulfill({ status: capability[1].status ?? 200, json: capability[1].body })
      if (url.pathname === '/api/create') {
        if (createMode === 'lost') return route.abort()
        if (createMode === 'queued') return route.fulfill({ status:202, json:{ status:'queued', jobId:'33333333-3333-4333-8333-333333333333' } })
        return route.fulfill({ status:503, json:{ submissionState:'not_submitted', error:'fixture_private_token_never_display' } })
      }
      if (url.pathname === '/api/create/status') return route.fulfill({ json:{ status:req.method() === 'DELETE' ? 'cancelled' : 'processing', jobId:'33333333-3333-4333-8333-333333333333' } })
      return route.fulfill({ json: { should_show:false, accounts:[], videos:[], notifications:[], data:[] } })
    }
    if (!['GET','HEAD'].includes(req.method()) && !url.pathname.startsWith('/__nextjs')) { blocked.push(url.pathname); return route.abort() }
    return route.continue()
  })
  await context.addInitScript(() => { localStorage.setItem('sutra_intro_seen','1'); localStorage.setItem('sutra_tutorial_dismissed','true') })
  const login = await context.newPage()
  snapshots.push(await observeRuntimeErrors(login, { engine, nativeControl:engineControl, fixtureOrigin:fixture.url }))
  await enterTestSession({ page:login, base, fixture })
  // Warm routes after fixture authentication; retain errors rather than hiding HMR failures.
  await context.request.get(base+'/create'); await context.request.get(base+'/settings/social')
  await login.close()
  const newPage = async path => {
    const p = await context.newPage()
    snapshots.push(await observeRuntimeErrors(p, { engine, nativeControl:engineControl, fixtureOrigin:fixture.url }))
    await p.goto(base+path); return p
  }
  let page = await newPage('/settings/social')
  await expect(page.getByTestId('connect-youtube')).toBeEnabled()
  if (connectOnly) {
    await check('different platforms in the same turn share one pending OAuth request', async () => {
      connectMode = 'slow'; const before = writes.length
      await page.evaluate(() => {
        document.querySelector('[data-testid="connect-youtube"]').click()
        document.querySelector('[data-testid="connect-instagram"]').click()
      })
      await expect.poll(() => writes.length).toBe(before + 1)
      await page.waitForTimeout(300); assert.equal(writes.length, before + 1)
    })
    await check('timeout is bounded; manual retry sends exactly one fresh request', async () => {
      await expect(page.getByTestId('connect-youtube')).toBeEnabled({ timeout: 11000 })
      await expect(page.getByTestId('social-connect-error')).toContainText('Réessaie manuellement')
      const before = writes.length
      connectRelease?.(); connectMode = 'error'
      await page.getByTestId('connect-instagram').click()
      await expect(page.getByTestId('social-connect-error')).toContainText('Profil social non attribué')
      assert.equal(writes.length, before + 1)
      await page.waitForTimeout(300); assert.equal(writes.length, before + 1)
    })
    await check('SPA unmount aborts a pending connection and prevents its late redirect', async () => {
      connectMode = 'slow-success'; const before = writes.length
      await page.getByTestId('connect-youtube').click()
      await expect.poll(() => writes.length).toBe(before + 1)
      await page.getByTestId('mobile-create').click()
      await expect(page.getByTestId('topic-input')).toBeVisible()
      connectRelease?.(); await page.waitForTimeout(600)
      assert.equal(new URL(page.url()).pathname, '/create')
      await expect(page.getByTestId('social-connect-error')).toHaveCount(0)
    })
    await page.close(); page = await newPage('/settings/social?error=fixture_private_token_never_display')
    await check('callback displays a persistent safe error and removes untrusted URL text', async () => {
      await expect(page.getByTestId('social-connect-error')).toHaveText('Connexion indisponible. Relance la connexion depuis cette page.')
      await expect(page.getByText('fixture_private_token_never_display', { exact: false })).toHaveCount(0)
      assert.equal(new URL(page.url()).search, '')
    })
    await page.close(); accountMode = 'revoked'; page = await newPage('/settings/social')
    await expect(page.getByTestId('connect-youtube')).toHaveText('Se reconnecter')
    await check('reconnection opens only simulated consent once, with no automatic acceptance', async () => {
      connectMode = 'success'; const before = writes.length
      await page.getByTestId('connect-youtube').evaluate(b => { b.click(); b.click() })
      await expect(page.getByRole('heading', { name: 'Consentement personnel requis' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Accepter personnellement' })).toBeVisible()
      assert.equal(writes.length, before + 1)
      assert.equal(new URL(page.url()).pathname, '/mock-consent')
    })
    await page.close()
  } else {
  await check('social empty: nine consent buttons, five unavailable platforms, no automatic writes', async () => {
    assert.equal(await page.locator('[data-testid^="connect-"]:enabled').count(),9)
    assert.equal(await page.locator('[data-testid^="connect-"]:disabled').count(),5)
    assert.equal(writes.length,0)
  })
  await check('connect refuses safely, actionable administrator message, no raw provider body', async () => {
    await page.getByTestId('connect-youtube').click()
    await expect(page.getByTestId('social-connect-error')).toHaveText('Profil social non attribué. Contactez votre administrateur.')
    await expect(page.getByText('fixture_private_token_never_display',{exact:false})).toHaveCount(0)
  })
  await check('connect rapid double activation creates only one OAuth state request', async () => {
    const before = writes.length; connectMode='slow'
    await page.getByTestId('connect-youtube').evaluate(b=>{ b.click(); b.click() })
    await page.waitForTimeout(300)
    assert.equal(writes.length-before,1)
  })
  await check('connect pending request expires and offers manual recovery within 11 seconds', async () => {
    await expect(page.getByTestId('connect-youtube')).toBeEnabled({timeout:11000})
    await expect(page.getByTestId('social-connect-error')).toContainText('Réessaie manuellement')
  })
  connectRelease?.(); connectMode='error'; await page.close()
  page = await newPage('/settings/social?error=fixture_private_token_never_display')
  await check('callback error never reflects untrusted diagnostics and removes the query parameter', async () => {
    await expect.poll(()=>page.url()).toBe(base+'/settings/social')
    await expect(page.getByText('fixture_private_token_never_display',{exact:false})).toHaveCount(0)
  })
  await page.close(); accountMode='revoked'; page=await newPage('/settings/social')
  await check('revoked account offers reconnection with personal consent, no connected badge', async () => {
    await expect(page.getByTestId('connect-youtube')).toHaveText('Se reconnecter')
    await expect(page.getByTestId('platform-card-youtube')).toContainText('Connexion à renouveler')
    await expect(page.getByTestId('disconnect-youtube')).toHaveCount(0)
  })
  for (const width of [375,1440]) {
    await page.setViewportSize({width,height:900})
    await check(`social ${width}px: no overflow and axe WCAG AA`,async()=>{
      await page.waitForTimeout(700)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')})
      const violations=await page.evaluate(async()=>(await window.axe.run('main',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)})))
      axes.push({page:'social',width,violations}); await page.screenshot({path:resolve(output,`${engine}-social-${width}.png`)})
      assert.deepEqual(violations,[])
    })
  }
  await page.close()
  for (const mode of ['client','unavailable','ready']) {
    capability=capabilitiesCases.find(([name])=>name===mode)
    page=await newPage('/create')
    await page.setViewportSize({width:mode==='ready'?1440:375,height:900})
    await check(`create ${mode}: explicit costs and remote capability, no personal WanGP control`,async()=>{
      const notice=page.getByRole('complementary',{name:'Modes de génération'})
      await expect(notice).toContainText(capability[2]); await notice.locator('summary').click()
      await expect(notice).toContainText('API client'); await expect(notice).toContainText('Personnel open source distant')
      assert.equal(await notice.locator('button,input,select').count(),0)
      await expect(page.getByText('fixture-private-reason-never-display',{exact:false})).toHaveCount(0)
      await page.waitForTimeout(700); await page.screenshot({path:resolve(output,`${engine}-create-${mode}.png`)})
      assert.equal(writes.filter(w=>/create|wangp|personal/.test(w.path)).length,0)
    })
    await page.close()
  }
  capability=capabilitiesCases.find(([name])=>name==='client'); page=await newPage('/create')
  await check('create form: empty blocked, named topic, submission refused without raw diagnostics',async()=>{
    await expect(page.getByTestId('create-button')).toBeDisabled()
    await expect(page.getByTestId('topic-input')).toHaveAccessibleName(/sujet/i)
    await page.getByTestId('topic-input').fill('Sujet synthétique, aucun média réel')
    await page.getByTestId('create-button').click()
    await expect(page.getByTestId('production-request-status')).toContainText('Demande refusée avant exécution.')
    await expect(page.getByText('fixture_private_token_never_display',{exact:false})).toHaveCount(0)
    const body=writes.find(w=>w.path==='/api/create').body
    assert.equal(body.mode,'auto'); assert.ok(!('executionMode' in body)); assert.ok(!('personal' in body))
  })
  await check('lost create response preserves intent; resume GET and cancel DELETE use same request, no new generation',async()=>{
    createMode='lost'; await page.getByTestId('create-button').click()
    await expect(page.getByTestId('production-request-status')).toContainText('État non confirmé')
    const posts=writes.filter(w=>w.path==='/api/create').length
    await page.reload(); await page.getByTestId('production-resume').click()
    await expect(page.getByTestId('production-request-status')).toContainText('Tâche en cours sur le serveur')
    await page.getByTestId('production-cancel').click()
    await expect(page.getByTestId('production-request-status')).toContainText('Annulation confirmée par le serveur')
    assert.equal(writes.filter(w=>w.path==='/api/create').length,posts)
    assert.equal(writes.filter(w=>w.path==='/api/create/status'&&w.method==='DELETE').length,1)
  })
  await page.close()
  await context.addCookies([{name:'sutra_locale',value:'en',url:base}]); page=await newPage('/create')
  await check('English locale: translated creation heading',async()=>{
    await expect(page.locator('html')).toHaveAttribute('lang','en')
    await expect(page.getByRole('heading',{level:1})).toHaveText(/create.*video/i)
  })
  observations.push({locale:await page.locator('html').getAttribute('lang'),heading:await page.getByRole('heading',{level:1}).textContent()})
  await page.close()
  }
  await check('runtime: zero unexpected hydration/client errors; no external or real publication',async()=>{
    assert.deepEqual(snapshots.flatMap(s=>s().unexpected),[]); assert.deepEqual(blocked,[])
    assert.ok(writes.every(w=>['/api/social/connect','/api/create','/api/create/status'].includes(w.path)))
  })
  engineResults.push({ engine, checks: checks.slice(firstCheck), axes: [...axes], observations: [...observations],
    runtime: snapshots.map(s => s()), blocked: [...blocked], writes: [...writes] })
  await browser.close(); browser = null
  }
} finally {
  connectRelease?.()
  await writeFile(resolve(output,'results.json'),JSON.stringify({production,connectOnly,candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),engine,engineResults,checks,axes,observations,runtime:snapshots.map(s=>s()),blocked,writes,realPublications:0,realConnections:0},null,2)+'\n')
  await browser?.close()
  if(child&&child.exitCode===null){process.kill(-child.pid,'SIGTERM');await once(child,'exit')}
  if(proxy){proxy.closeAllConnections();await new Promise(done=>proxy.close(done))}
  fixture.server.closeAllConnections();await new Promise(done=>fixture.server.close(done));await log.close()
}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1
