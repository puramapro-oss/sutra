import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { once } from 'node:events'
import { prepareTLS } from '../../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeRuntimeErrors, calibrateKeyboard } from './runtime-guard.mjs'
import { crossOriginRuntimeControls } from './cross-origin-controls.mjs'

export async function nativeRuntimeControls(browser) {
  const engine = browser.browserType().name(), tls = await prepareTLS()
  const server = createServer(tls.options, (request, response) => {
    if (new URL(request.url, 'https://fixture.invalid').pathname === '/slow') {
      response.writeHead(200, { 'Content-Type': 'text/plain' }); response.write('partial')
      const timer = setTimeout(() => response.end('complete'), 1000)
      response.on('close', () => clearTimeout(timer))
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end(`<h1>Native HTML engine control</h1><script>
        if (location.pathname.startsWith('/caught')) {
          const resource = location.pathname.endsWith('-rsc') ? '/slow?_rsc=fixture_token' : '/slow';
          for (const lifecycle of ['beforeunload', 'pagehide']) {
            addEventListener(lifecycle, () => { fetch(resource).catch(() => {}) });
          }
        }
      </script>`)
    }
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `https://127.0.0.1:${server.address().port}`
  let context
  try {
    const keyboard = await calibrateKeyboard(browser)
    context = await browser.newContext({ ignoreHTTPSErrors: true })
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    const snapshot = await observeRuntimeErrors(page, { engine, nativeControl: { caughtUnloadDiagnostic: true } })
    const cases = []
    for (const method of ['goto', 'reload']) for (const query of [false, true]) {
      await page.goto(base + (query ? '/caught-rsc' : '/caught'))
      const before = snapshot().errors.length
      if (method === 'goto') await page.goto(base + '/next')
      else await page.reload()
      await page.waitForTimeout(300)
      const state = snapshot(), navigation = state.navigations.at(-1)
      assert.equal(navigation.method, method)
      assert.ok(state.events.some(event => event.kind === 'unload-fetch' && event.navigation === navigation.id && event.url === base + '/slow' + (query ? '?_rsc=fixture_token' : '')), 'native unload fetch must be observed exactly')
      assert.deepEqual(state.unexpected, [], 'native caught teardown must have no unexpected application error')
      cases.push({ method, query, errors: state.errors.slice(before), qualified: state.qualified.filter(error => error.navigation === navigation.id) })
    }
    const caught = structuredClone(snapshot())
    assert.deepEqual(caught.unexpected, [], 'native caught teardown must have no unexpected application error')
    await page.evaluate(() => { setTimeout(() => { throw new Error('NEGATIVE_CONTROL_REAL_EXCEPTION') }, 0) })
    await page.waitForTimeout(100)
    assert.ok(snapshot().unexpected.some(error => error.message?.includes('NEGATIVE_CONTROL_REAL_EXCEPTION')), 'guard must reject a real exception')
    await page.evaluate(() => { Promise.reject(new Error('NEGATIVE_CONTROL_REAL_REJECTION')) })
    await page.waitForTimeout(100)
    assert.ok(snapshot().unexpected.some(error => error.message?.includes('NEGATIVE_CONTROL_REAL_REJECTION')), 'guard must reject unhandled rejection')
    const all = snapshot()
    const crossOrigin = await crossOriginRuntimeControls(browser)
    const crossOriginProfile = await crossOriginRuntimeControls(browser, 'profiles')
    return { engine, browserVersion: browser.version(), nativeSafari: false, keyboard,
      caughtUnloadDiagnostic: caught.qualified.length > 0, cases, caught,
      crossOriginCaughtUnloadDiagnostic: crossOrigin.reproduced, crossOrigin,
      crossOriginProfileCaughtUnloadDiagnostic: crossOriginProfile.reproduced, crossOriginProfile,
      negativeControls: { realExceptionDetected: true, unhandledRejectionDetected: true }, negativeEvidence: all.unexpected }
  } finally {
    await context?.close()
    server.closeAllConnections(); await new Promise(done => server.close(done))
  }
}
