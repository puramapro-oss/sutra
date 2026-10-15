import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { once } from 'node:events'
import { prepareTLS } from '../../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeRuntimeErrors } from './runtime-guard.mjs'

// Independent HTML, two loopback TLS origins, no application or provider.
export async function crossOriginRuntimeControls(browser) {
  const engine = browser.browserType().name(), tls = await prepareTLS()
  let appOrigin, denyCors = false, context
  const api = createServer(tls.options, (_request, response) => {
    const headers = { 'Content-Type': 'application/json' }
    if (!denyCors) headers['Access-Control-Allow-Origin'] = appOrigin
    response.writeHead(200, headers); response.write('[')
    const timer = setTimeout(() => response.end(']'), 300)
    response.on('close', () => clearTimeout(timer))
  })
  api.listen(0, '127.0.0.1'); await once(api, 'listening')
  const fixtureOrigin = `https://127.0.0.1:${api.address().port}`
  const endpoint = fixtureOrigin + '/rest/v1/profiles?select=*&id=eq.11111111-1111-4111-8111-111111111111'
  const app = createServer(tls.options, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(`<h1>Native cross-origin control</h1><script>
      const endpoint = ${JSON.stringify(endpoint)};
      window.runRead = () => fetch(endpoint).then(r => r.json());
      if (location.pathname === '/caught') {
        for (const lifecycle of ['beforeunload', 'pagehide']) {
          addEventListener(lifecycle, () => { window.runRead().catch(() => {}); });
        }
      }
    </script>`)
  })
  app.listen(0, '127.0.0.1'); await once(app, 'listening')
  appOrigin = `https://127.0.0.1:${app.address().port}`
  try {
    context = await browser.newContext({ ignoreHTTPSErrors: true })
    await context.route('**/*', route => [appOrigin, fixtureOrigin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
    const page = await context.newPage()
    const snapshot = await observeRuntimeErrors(page, { engine, fixtureOrigin,
      nativeControl: { crossOriginCaughtUnloadDiagnostic: true } })
    await page.goto(appOrigin + '/normal')
    assert.deepEqual(await page.evaluate(() => window.runRead()), [])
    assert.deepEqual(snapshot().errors, [], 'ordinary cross-origin read must succeed without a diagnostic')
    const cases = []
    for (const method of ['goto', 'reload']) {
      await page.goto(appOrigin + '/caught')
      if (method === 'goto') await page.goto(appOrigin + '/next')
      else await page.reload()
      await page.waitForTimeout(500)
      const state = snapshot(), navigation = state.navigations.at(-1)
      assert.equal(navigation.method, method)
      // Profile not yet in observer: preserve the original failure.
      if (engine === 'webkit') assert.ok(state.unexpected.some(error => error.stack?.includes(endpoint)), 'profile native diagnostic reproduces original failure')
      cases.push({ method, navigation: navigation.id, qualified: state.qualified.filter(error => error.navigation === navigation.id) })
    }
    await page.goto(appOrigin + '/normal')
    await page.waitForTimeout(500)
    const caught = structuredClone(snapshot())
    // Raw diagnostic kept as failing reproduction, not a passing app verdict.
    // Same endpoint and query, but now a genuinely missing CORS permission.
    denyCors = true
    await page.evaluate(() => { window.runRead() })
    await page.waitForTimeout(600)
    const negative = snapshot()
    assert.ok(negative.unexpected.some(error => error.kind === 'dom-uncaught' && error.message.includes('Load failed')
      || error.kind === 'dom-uncaught' && error.message.includes('Failed to fetch')), 'real CORS rejection must fail the guard')
    return { engine, fixtureOrigin, normalCrossOriginRead: 'PASS', cases, caught,
      reproduced: caught.qualified.length > 0, realCorsDenialDetected: true, negativeEvidence: negative.unexpected }
  } finally {
    await context?.close()
    for (const server of [app, api]) { server.closeAllConnections(); await new Promise(done => server.close(done)) }
  }
}

import { webkit } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await webkit.launch({ headless: true })
try { const result = await crossOriginRuntimeControls(browser); await writeFile(new URL('./profile-reproduction.json', import.meta.url), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); process.stdout.write(JSON.stringify({ normal: result.normalCrossOriginRead, rawErrors: result.caught.unexpected.length, trueCorsDetected: result.realCorsDenialDetected }) + '\n') } finally { await browser.close() }
