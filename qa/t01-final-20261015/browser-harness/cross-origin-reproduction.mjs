// Standalone synthetic reproduction only; does not classify application errors.
import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { once } from 'node:events'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, webkit } from 'playwright'
import { prepareTLS } from '../../t07-frontend-journey-20261014/tls-fixture.mjs'

const output = await mkdtemp(resolve(import.meta.dirname, 'cross-origin-results-'))
const tls = await prepareTLS(), requests = []
let appOrigin
const api = createServer(tls.options, (request, response) => {
  const url = new URL(request.url, 'https://fixture.invalid')
  requests.push({ path: url.pathname, at: Date.now() })
  const headers = { 'Content-Type': 'application/json' }
  if (url.pathname !== '/denied') headers['Access-Control-Allow-Origin'] = appOrigin
  response.writeHead(200, headers)
  response.write('[')
  const timer = setTimeout(() => response.end(']'), 300)
  response.on('close', () => clearTimeout(timer))
})
api.listen(0, '127.0.0.1'); await once(api, 'listening')
const apiOrigin = `https://127.0.0.1:${api.address().port}`
const app = createServer(tls.options, (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' })
  response.end(`<h1>Native cross-origin control</h1><script>
    const endpoint = ${JSON.stringify(apiOrigin)} + '/rest/v1/affirmations?select=*&category=eq.wisdom';
    window.completed = false;
    window.runNormal = async () => { await fetch(endpoint).then(r => r.json()); window.completed = true; };
    window.runDenied = () => fetch(${JSON.stringify(apiOrigin)} + '/denied');
    if (location.pathname === '/caught') {
      for (const lifecycle of ['beforeunload', 'pagehide']) addEventListener(lifecycle, () => {
        console.warn('synthetic-event:' + lifecycle);
        fetch(endpoint).then(r => r.json()).catch(() => {});
      });
    }
  </script>`)
})
app.listen(0, '127.0.0.1'); await once(app, 'listening')
appOrigin = `https://127.0.0.1:${app.address().port}`
const reports = []
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true })
    try {
      const context = await browser.newContext({ ignoreHTTPSErrors: true })
      await context.route('**/*', route => [appOrigin, apiOrigin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
      const page = await context.newPage(), events = []
      let phase = 'normal'
      page.on('pageerror', error => events.push({ phase, kind: 'pageerror', message: error.message, stack: error.stack, at: Date.now() }))
      page.on('console', message => events.push({ phase, kind: 'console-' + message.type(), message: message.text(), at: Date.now() }))
      await page.addInitScript(() => {
        addEventListener('error', event => { if (event.error) console.warn('synthetic-dom-error:' + event.message) })
        addEventListener('unhandledrejection', event => console.warn('synthetic-dom-rejection:' + String(event.reason)))
      })
      await page.goto(appOrigin + '/normal')
      await page.evaluate(() => window.runNormal())
      assert.equal(await page.evaluate(() => window.completed), true)
      assert.equal(events.filter(event => event.kind === 'pageerror').length, 0)
      for (const method of ['goto', 'reload']) {
        phase = 'caught-' + method
        await page.goto(appOrigin + '/caught')
        if (method === 'goto') await page.goto(appOrigin + '/next')
        else await page.reload()
        await page.waitForTimeout(500)
      }
      phase = 'true-cors-denial'
      await page.goto(appOrigin + '/normal')
      await page.evaluate(() => { window.runDenied() })
      await page.waitForTimeout(600)
      const denialDetected = events.some(event => event.phase === phase && event.message.startsWith('synthetic-dom-rejection:'))
      assert.ok(denialDetected, 'real CORS denial must remain visible as an unhandled rejection')
      const report = { engine: browserType.name(), browserVersion: browser.version(), normalCrossOriginGet: 'PASS', denialDetected,
        caughtTeardownDiagnostics: events.filter(event => event.phase.startsWith('caught-') && event.kind === 'pageerror'), events, requests }
      reports.push(report)
      await writeFile(resolve(output, browserType.name() + '.json'), JSON.stringify(report, null, 2) + '\n')
      await context.close()
    } finally { await browser.close() }
  }
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(reports.map(({ engine, normalCrossOriginGet, denialDetected, caughtTeardownDiagnostics }) => ({ engine, normalCrossOriginGet, denialDetected, caughtTeardownDiagnostics: caughtTeardownDiagnostics.length })), null, 2) + '\n')
  console.warn('Synthetic cross-origin receipts: ' + output)
} finally {
  for (const server of [app, api]) { server.closeAllConnections(); await new Promise(done => server.close(done)) }
}
