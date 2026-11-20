import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { createServer } from 'node:https'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { prepareTLS } from '../../../t07-frontend-journey-20261014/tls-fixture.mjs'
import { observeRuntimeErrors } from '../runtime-guard.mjs'
import { installFixtureReadBarrier } from './fixture-read-barrier.mjs'

const userId = '11111111-1111-4111-8111-111111111111'
const appOrigin = 'https://127.0.0.1:1234', fixtureOrigin = 'https://127.0.0.1:5678'
const output = await mkdtemp('qa/t01-final-20261015/browser-harness/social-read-barrier-20261015/results-')
for (const scope of ['social', 'library']) {
const documentPath = scope === 'social' ? '/settings/social' : '/library'
const path = scope === 'social'
  ? `/rest/v1/user_notifications?select=*&user_id=eq.${userId}&order=created_at.desc&limit=10`
  : `/rest/v1/videos?select=*&user_id=eq.${userId}&order=created_at.desc&offset=0&limit=12`
function fakePage() {
  const page = new EventEmitter()
  let url = 'about:blank'
  const frame = { url: () => url }
  page.mainFrame = () => frame; page.url = () => url; page.evaluate = async () => {}
  page.goto = async next => { url = next; page.emit('framenavigated', frame) }
  page.reload = async () => { page.emit('framenavigated', frame) }
  return page
}
function read(page, { method = 'GET', url = fixtureOrigin + path, status = 200, finish = true, fail = false } = {}) {
  const request = { url: () => url, method: () => method, frame: () => page.mainFrame(), failure: () => ({ errorText: 'synthetic failure' }) }
  page.emit('request', request)
  page.emit('response', { request: () => request, status: () => status })
  if (fail) page.emit('requestfailed', request)
  else if (finish) page.emit('requestfinished', request)
  return request
}
async function setup() {
  const page = fakePage()
  const snapshot = installFixtureReadBarrier(page, { appOrigin, fixtureOrigin, userId, includeLibrary: scope === 'library', timeout: 40 })
  await page.goto(appOrigin + documentPath)
  return { page, snapshot }
}
test(`${scope}: waits for an exact current-document GET and its complete body, not just response headers`, async () => {
  const { page, snapshot } = await setup()
  const moving = page.goto(appOrigin + '/next')
  const request = read(page, { finish: false })
  await Promise.resolve()
  assert.equal(page.url(), appOrigin + documentPath)
  page.emit('requestfinished', request); await moving
  assert.equal(snapshot().waits[0].status, 'PASS')
})
test(`${scope}: a read completed before goto is retained`, async () => {
  const { page, snapshot } = await setup(); read(page)
  await page.goto(appOrigin + '/next'); assert.equal(snapshot().waits[0].status, 'PASS')
})
for (const method of ['POST', 'PATCH', 'DELETE', 'HEAD']) test(`${scope}: ${method} never satisfies the GET barrier`, async () => {
  const { page, snapshot } = await setup(); read(page, { method })
  await assert.rejects(page.goto(appOrigin + '/next'), /exact GET did not complete/)
  assert.equal(snapshot().waits[0].status, 'FAIL'); assert.ok(page.url().endsWith(documentPath))
})
for (const suffix of ['missing', 'origin', 'query', 'duplicate', 'identity', 'path']) test(`${scope}: ${suffix} read cannot satisfy the barrier`, async () => {
  const { page } = await setup()
  if (suffix !== 'missing') read(page, { url: suffix === 'origin' ? appOrigin + path
    : suffix === 'identity' ? fixtureOrigin + path.replace(userId, '22222222-2222-4222-8222-222222222222')
    : suffix === 'path' ? fixtureOrigin + path.replace('/rest/v1/', '/wrong/v1/')
    : fixtureOrigin + path + (suffix === 'duplicate' ? '&limit=10' : '&extra=1') })
  await assert.rejects(page.goto(appOrigin + '/next'), /exact GET did not complete/)
})
for (const options of [{ status: 503 }, { fail: true }]) test(`${scope}: failed read ${JSON.stringify(options)} prevents navigation`, async () => {
  const { page } = await setup(); read(page, options)
  await assert.rejects(page.goto(appOrigin + '/next'), /read failed/)
})
test(`${scope}: a previous document success cannot satisfy the next document`, async () => {
  const { page } = await setup(); read(page)
  await page.goto(appOrigin + documentPath)
  await assert.rejects(page.goto(appOrigin + '/next'), /exact GET did not complete/)
})
test(`${scope}: completion of an old document request cannot satisfy the new document`, async () => {
  const { page } = await setup(); const request = read(page, { finish: false })
  page.emit('framenavigated', page.mainFrame()); page.emit('requestfinished', request)
  await assert.rejects(page.goto(appOrigin + '/next'), /exact GET did not complete/)
})
test(`${scope}: an exact GET from a child frame cannot satisfy the main-document barrier`, async () => {
  const { page } = await setup()
  const request = { url: () => fixtureOrigin + path, method: () => 'GET', frame: () => ({}) }
  page.emit('request', request)
  page.emit('response', { request: () => request, status: () => 200 })
  page.emit('requestfinished', request)
  await assert.rejects(page.goto(appOrigin + '/next'), /exact GET did not complete/)
})
test(`${scope}: a document change during the wait fails instead of navigating from stale state`, async () => {
  const { page } = await setup()
  const moving = page.goto(appOrigin + '/next')
  const rejected = assert.rejects(moving, /source document changed/)
  page.emit('framenavigated', page.mainFrame()); await rejected
})

test(`${scope}: reload waits for the current exact GET body, then requires a new read in the new document`, async () => {
  const { page, snapshot } = await setup()
  const moving = page.reload()
  const request = read(page, { finish: false })
  await Promise.resolve()
  assert.equal(snapshot().documents.length, 1, 'headers cannot reload the document')
  page.emit('requestfinished', request); await moving
  assert.equal(snapshot().waits[0].status, 'PASS')
  assert.equal(snapshot().documents.length, 2)
  await assert.rejects(page.reload(), /exact GET did not complete/)
})
for (const options of [{ status: 503 }, { fail: true }]) test(`${scope}: reload preserves failed read ${JSON.stringify(options)}`, async () => {
  const { page, snapshot } = await setup(); read(page, options)
  await assert.rejects(page.reload(), /read failed/)
  assert.equal(snapshot().documents.length, 1)
})

for (const engine of ['chromium', 'webkit']) test(`${scope} ${engine}: native deferred read, barrier, genuine CORS and JS failures`, async () => {
  const tls = await prepareTLS(), browser = await ({ chromium, webkit }[engine]).launch({ headless: true })
  let origin, held, denyCors = false
  const api = createServer(tls.options, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', ...(!denyCors ? { 'Access-Control-Allow-Origin': '*' } : {}) })
    if (denyCors) return response.end('[]')
    response.write('['); held = response
  })
  api.listen(0, '127.0.0.1'); await once(api, 'listening')
  const fixture = `https://127.0.0.1:${api.address().port}`, endpoint = fixture + path
  const app = createServer(tls.options, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(`<h1>Native deferred fixture read</h1><script>
      window.settled = false;
      window.runRead = () => fetch(${JSON.stringify(endpoint)}).then(r => r.json()).then(() => { window.settled = true; });
      if (location.pathname === ${JSON.stringify(documentPath)}) for (const lifecycle of ['beforeunload', 'pagehide']) {
        addEventListener(lifecycle, () => { if (!window.settled) window.runRead().catch(() => {}); });
      }
    </script>`)
  })
  app.listen(0, '127.0.0.1'); await once(app, 'listening'); origin = `https://127.0.0.1:${app.address().port}`
  const receipts = { engine, browserVersion: browser.version(), nativeSafari: false, scope: 'HTML scheduling control only, not a reproduction of React effect timing' }
  try {
    async function fresh(barrier = false) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true })
      await context.route('**/*', route => [origin, fixture].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
      const page = await context.newPage()
      const runtime = await observeRuntimeErrors(page, { engine, fixtureOrigin: fixture, nativeControl: {} })
      const reads = barrier ? installFixtureReadBarrier(page, { appOrigin: origin, fixtureOrigin: fixture, userId, includeLibrary: scope === 'library', timeout: 1500 }) : null
      await page.goto(origin + documentPath)
      return { context, page, runtime, reads }
    }
    // Exact unknown query remains blocking if a read starts during teardown.
    const before = await fresh()
    await before.page.goto(origin + '/next'); await before.page.waitForTimeout(150)
    receipts.before = before.runtime()
    assert.equal(receipts.before.qualified.length, 0)
    if (engine === 'webkit') assert.ok(receipts.before.unexpected.some(row => row.stack?.includes(endpoint)), 'WebKit native unknown-query teardown reproduced')
    await before.context.close()

    const after = await fresh(true)
    const moving = after.page.goto(origin + '/next')
    assert.ok(after.page.url().endsWith(documentPath), 'missing read prevents immediate navigation')
    const requestSeen = after.page.waitForRequest(request => request.url() === endpoint)
    await after.page.evaluate(() => { window.runRead().catch(() => {}) })
    const request = await requestSeen; await request.response()
    assert.ok(after.page.url().endsWith(documentPath), 'headers alone do not release the barrier')
    assert.ok(held); held.end(']')
    await moving
    receipts.after = { runtime: after.runtime(), barrier: after.reads() }
    assert.deepEqual(receipts.after.runtime.errors, [])
    assert.equal(receipts.after.barrier.waits[0].status, 'PASS')
    await after.context.close()

    denyCors = true
    const negative = await fresh(true)
    const rejectedNavigation = assert.rejects(negative.page.goto(origin + '/next'), /read failed|exact GET did not complete/)
    await negative.page.evaluate(() => { window.runRead() })
    await rejectedNavigation
    await negative.page.waitForTimeout(100)
    assert.ok(negative.page.url().endsWith(documentPath), 'CORS failure must not navigate away')
    assert.ok(negative.runtime().unexpected.length > 0, 'genuine CORS remains visible')
    await negative.page.evaluate(() => { setTimeout(() => { throw new Error('BARRIER_REAL_EXCEPTION') }, 0); Promise.reject(new Error('BARRIER_REAL_REJECTION')) })
    await negative.page.waitForTimeout(100)
    receipts.negative = { runtime: negative.runtime(), barrier: negative.reads() }
    assert.ok(receipts.negative.runtime.unexpected.some(row => row.message?.includes('BARRIER_REAL_EXCEPTION')))
    assert.ok(receipts.negative.runtime.unexpected.some(row => row.message?.includes('BARRIER_REAL_REJECTION')))
    assert.deepEqual(receipts.negative.runtime.qualified, [])
    await negative.context.close()
  } finally {
    await writeFile(`${output}/${scope}-${engine}.json`, JSON.stringify(receipts, null, 2) + '\n')
    await browser.close()
    for (const server of [app, api]) { server.closeAllConnections(); await new Promise(done => server.close(done)) }
  }
})

}
