import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { once } from 'node:events'
import { prepareTLS } from '../../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeRuntimeErrors, calibrateKeyboard } from './runtime-guard.mjs'

export async function nativeRuntimeControls(browser) {
  const engine = browser.browserType().name(), tls = await prepareTLS()
  const server = createServer(tls.options, (request, response) => {
    if (request.url === '/slow') {
      response.writeHead(200, { 'Content-Type': 'text/plain' }); response.write('partial')
      const timer = setTimeout(() => response.end('complete'), 1000)
      response.on('close', () => clearTimeout(timer))
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<h1>Native HTML engine control</h1><script>if(location.pathname === "/caught") addEventListener("pagehide", () => { fetch("/slow").catch(() => {}) })</script>')
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
    await page.goto(base + '/caught')
    await page.goto(base + '/next')
    await page.waitForTimeout(300)
    const caught = structuredClone(snapshot())
    assert.deepEqual(caught.unexpected, [], 'native caught teardown must have no unexpected application error')
    await page.evaluate(() => { setTimeout(() => { throw new Error('NEGATIVE_CONTROL_REAL_EXCEPTION') }, 0) })
    await page.waitForTimeout(100)
    assert.ok(snapshot().unexpected.some(error => error.message?.includes('NEGATIVE_CONTROL_REAL_EXCEPTION')), 'guard must reject a real exception')
    await page.evaluate(() => { Promise.reject(new Error('NEGATIVE_CONTROL_REAL_REJECTION')) })
    await page.waitForTimeout(100)
    assert.ok(snapshot().unexpected.some(error => error.message?.includes('NEGATIVE_CONTROL_REAL_REJECTION')), 'guard must reject unhandled rejection')
    const all = snapshot()
    return { engine, browserVersion: browser.version(), nativeSafari: false, keyboard,
      caughtUnloadDiagnostic: caught.qualified.length > 0, caught,
      negativeControls: { realExceptionDetected: true, unhandledRejectionDetected: true }, negativeEvidence: all.unexpected }
  } finally {
    await context?.close()
    server.closeAllConnections(); await new Promise(done => server.close(done))
  }
}
