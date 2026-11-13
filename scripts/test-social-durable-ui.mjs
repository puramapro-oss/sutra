import assert from 'node:assert/strict'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

// Real publication components; an isolated browser and simulated local API only.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const started = performance.now()
const id = n => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`
const account = n => ({ id: id(n), platform: 'youtube', external_id: String(n).padStart(24, '0'),
  username: `durable_${n}`, display_name: `Chaîne ${n}`, status: 'connected', token_expires_at: null })
const A = account(1), B = account(2), videoId = id(90), secondVideoId = id(91)
const result = (a, status = 'publishing', deliveryState = 'queued') => ({ platform: a.platform, localAccountId: a.id,
  accountId: a.external_id, status, success: status === 'published', ...(deliveryState ? { deliveryState } : {}),
  ...(status === 'published' ? { postUrl: `https://example.invalid/posts/${a.id}` } : {}) })
const receipt = (results = [result(A), result(B)], hasPending = true, video = videoId) => ({
  videoId: video, batchId: video, durable: true, hasPending, status: hasPending ? 'publishing' : 'published',
  destinations: results.map(r => ({ platform: r.platform, accountId: r.localAccountId })), results,
})
let journal = null, readStatus = 200, accounts = [A, B], accountsStatus = 200
let readGate = null, loseAdmission = false
const reads = [], writes = [], legacyReads = [], failures = [], outbound = [], aborted = [], checks = []
const check = name => { checks.push(name); console.log(JSON.stringify({ check: name, status: 'PASS' })) }
const bundle = await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { PublishEverywhereButton } from './src/components/social/PublishEverywhereButton';
  const root = createRoot(document.getElementById('root'));
  const show = (videoId = '${videoId}') => root.render(<PublishEverywhereButton videoId={videoId} videoTitle="Publication durable" />);
  window.changeVideo = show; window.removePublication = () => root.render(<p>Fermé</p>); show();
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'local-navigation', setup(builder) {
    builder.onResolve({ filter: /^next\/link$/ }, args => ({ path: args.path, namespace: 'local-ui' }))
    builder.onLoad({ filter: /.*/, namespace: 'local-ui' }, () => ({ loader: 'tsx', resolveDir: root,
      contents: `import React from 'react'; export default function Link({href,prefetch,replace,scroll,...props}) {return <a href={href} {...props}/>}` }))
  } }],
})
const server = http.createServer((req, res) => {
  if (req.url === '/app.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(bundle.outputFiles[0].text); return }
  if (req.url?.startsWith('/api/')) { res.writeHead(500); res.end('UNMOCKED_API'); return }
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Suivi durable</title><style>body{font-family:sans-serif}button{margin:4px;min-height:32px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
let browser, release
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.SUTRA_UI_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(() => {
    window.storageWrites = []
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { window.storageWrites.push(key); return setItem.call(this, key, value) }
  })
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { outbound.push(request.url()); await route.abort('blockedbyclient'); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    const reply = (data, status = 200) => route.fulfill({ json: data, status })
    if (url.pathname === '/api/social/accounts') return reply({ accounts }, accountsStatus)
    if (url.pathname === '/api/social/publish' && request.method() === 'GET') {
      reads.push({ videoId: url.searchParams.get('videoId'), method: request.method(), body: request.postData() })
      const answer = journal && url.searchParams.get('videoId') === videoId ? structuredClone(journal) : null
      const status = readStatus
      if (readGate) await readGate
      return reply(answer ?? { error: 'Aucun lot' }, status !== 200 ? status : answer ? 200 : 404)
    }
    if (url.pathname === '/api/social/publish' && request.method() === 'POST') {
      const body = request.postDataJSON()
      if (body.reconcileOnly) { legacyReads.push(body); return reply({ error: 'Unexpected legacy read' }, 500) }
      writes.push(body)
      const selected = new Set(body.destinations.map(destination => destination.accountId))
      journal = receipt([...(journal?.results ?? []).filter(r => !selected.has(r.localAccountId)),
        ...body.destinations.map(destination => result([A, B].find(a => a.id === destination.accountId)))])
      if (loseAdmission) return route.abort('failed')
      return reply(journal, 202)
    }
    failures.push(`Unexpected API ${request.method()} ${url.pathname}`)
    return reply({ error: 'Unexpected API' }, 500)
  })
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  page.on('requestfailed', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/social/publish') aborted.push(request.failure()?.errorText)
  })
  const open = async (video = videoId) => {
    await page.getByTestId(`publish-everywhere-${video}`).click()
    await expect(page.getByTestId('publish-everywhere-modal')).toBeVisible()
  }
  const fresh = async () => { await page.goto(origin); await open() }
  const select = async () => {
    await page.getByTestId(`publish-account-${A.id}`).click()
    await page.getByTestId(`publish-account-${B.id}`).click()
  }
  const visible = async value => page.evaluate(value => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: value ? 'visible' : 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, value)

  await fresh(); await select()
  await page.getByTestId('publish-submit').evaluate(button => { button.click(); button.click() })
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('En file')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  await expect(page.getByText('Envoi enregistré.', { exact: false })).toContainText('arrière-plan')
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].destinations, [{ platform: 'youtube', accountId: A.id }, { platform: 'youtube', accountId: B.id }])
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  check('202 admits two independent destinations once and labels them queued, never published')

  await page.getByTestId('publish-cancel').click()
  await expect(page.getByTestId('publish-everywhere-modal')).toHaveCount(0)
  const closedReads = reads.length
  await page.clock.install()
  await page.clock.fastForward(12_000)
  assert.equal(reads.length, closedReads)
  await page.reload(); await open()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('@durable_2')
  assert.equal(writes.length, 1)
  assert.ok(reads.every(r => r.method === 'GET' && r.body === null && r.videoId === videoId))
  check('Closing stops reads; reloading restores the durable batch by video ID without POST or stored intent')

  journal = receipt([result(A, 'published', null), result(B)], true)
  const pollingReads = reads.length
  await page.clock.fastForward(6_000)
  await expect.poll(() => reads.length).toBeGreaterThan(pollingReads)
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  check('Visible polling advances one destination while the other remains queued')

  for (const [name, bad, status] of [
    ['missing journal', null, 200],
    ['unavailable journal', journal, 503],
    ['wrong batch', { ...journal, batchId: secondVideoId }, 200],
    ['missing destination', receipt([result(B)]), 200],
    ['duplicate destination', receipt([result(A), result(A)]), 200],
    ['changed identity', receipt([{ ...result(A), accountId: B.external_id }, result(B)]), 200],
    ['unfenced unknown retry', receipt([result(A, 'published', null), { ...result(B, 'unknown', null), canRequestRetry: true }]), 200],
  ]) {
    const previousJournal = journal
    journal = bad; readStatus = status
    await page.getByTestId('publish-verify').click()
    await expect(page.getByRole('alert')).toContainText('La vérification n’a pas abouti')
    await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
    await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
    await expect(page.getByTestId('publish-submit')).toBeDisabled()
    assert.equal(writes.length, 1, name)
    journal = previousJournal; readStatus = 200
  }
  check('Missing, unavailable, partial, duplicate and mismatched receipts preserve success and never authorize retry')

  journal = receipt([result(A, 'failed', 'blocked'), result(B, 'failed', 'blocked')], false)
  await page.getByTestId('publish-verify').click()
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('À vérifier')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  assert.equal(writes.length, 1)
  check('A failed worker observation cannot demote published evidence or enable another admission')

  journal = receipt([result(A, 'published', null), { ...result(B, 'unknown', 'blocked'), canRequestRetry: true }], true)
  const beforeExplicitRetry = writes.length
  accounts = [A, { ...B, external_id: A.external_id }]
  await page.reload(); await open()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('À vérifier')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  assert.equal(writes.length, beforeExplicitRetry)
  accounts = [A, B]
  await page.reload(); await open()
  await expect(page.getByTestId('publish-submit')).toHaveText('Reprendre les échecs (1)')
  await expect(page.getByTestId('publish-submit')).toBeEnabled()
  assert.equal(writes.length, beforeExplicitRetry)
  await page.getByTestId('publish-submit').evaluate(button => { button.click(); button.click() })
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  assert.equal(writes.length, beforeExplicitRetry + 1)
  assert.deepEqual(writes.at(-1), { videoId, platforms: ['youtube'], destinations: [{ platform: 'youtube', accountId: B.id }], autoCaption: false })
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  check('Only an explicit server retry capability and a deliberate click admit a failed destination again')

  journal = receipt()
  await page.reload(); await open()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  readGate = new Promise(done => { release = done })
  const beforePending = reads.length, beforeAbort = aborted.length
  await page.getByTestId('publish-verify').click()
  await expect.poll(() => reads.length).toBe(beforePending + 1)
  await expect(page.getByTestId('publish-cancel')).toBeEnabled()
  await page.getByTestId('publish-cancel').click()
  await expect.poll(() => aborted.length).toBe(beforeAbort + 1)
  release(); readGate = null
  await page.clock.fastForward(15_000)
  assert.equal(reads.length, beforePending + 1)
  await open()
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  check('Closing aborts an in-flight GET and prevents late updates or polling while closed')

  readGate = new Promise(done => { release = done })
  const hiddenReads = reads.length, hiddenAborts = aborted.length
  await page.getByTestId('publish-verify').click()
  await expect.poll(() => reads.length).toBe(hiddenReads + 1)
  await visible(false)
  await expect.poll(() => aborted.length).toBe(hiddenAborts + 1)
  release(); readGate = null
  await page.clock.fastForward(20_000)
  assert.equal(reads.length, hiddenReads + 1)
  await visible(true)
  await expect.poll(() => reads.length).toBe(hiddenReads + 2)
  await expect(page.getByTestId(`publish-result-${B.id}`)).toContainText('En file')
  check('Hidden tabs abort and pause reads; visibility resumes a GET without another POST')

  readGate = new Promise(done => { release = done })
  const changingReads = reads.length, changingAborts = aborted.length
  await page.getByTestId('publish-verify').click()
  await expect.poll(() => reads.length).toBe(changingReads + 1)
  await page.evaluate(value => window.changeVideo(value), secondVideoId)
  await expect.poll(() => aborted.length).toBe(changingAborts + 1)
  release(); readGate = null
  await open(secondVideoId)
  await expect(page.getByTestId(`publish-account-${A.id}`)).toBeVisible()
  await expect(page.locator('[data-testid^="publish-result-"]')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  assert.equal(reads.at(-1).videoId, secondVideoId)
  check('Changing video aborts the old read and cannot carry evidence into another production')

  journal = null; loseAdmission = true
  await fresh(); await select()
  const lostWrites = writes.length
  await page.getByTestId('publish-submit').click()
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('A verifier')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  loseAdmission = false
  await page.getByTestId('publish-verify').click()
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('En file')
  assert.equal(writes.length, lostWrites + 1)
  assert.equal(legacyReads.length, 0)
  check('A lost admission response is recovered by GET without another admission or legacy POST')

  accounts = []; accountsStatus = 503
  journal = receipt([result(A, 'published', null), result(B, 'failed', 'blocked')], false)
  await fresh()
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText('Publie')
  await expect(page.getByTestId(`publish-result-${A.id}`)).toContainText(A.id.slice(0, 8))
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  check('Historical destinations remain readable without a live account list and receive no publishing authority')

  accounts = [A, B]; accountsStatus = 200; journal = null; readStatus = 401
  await fresh(); await select()
  await expect(page.getByRole('alert')).toContainText('La vérification n’a pas abouti')
  await expect(page.getByTestId('publish-submit')).toBeDisabled()
  readStatus = 200
  await page.getByTestId('publish-verify').click()
  await expect(page.getByTestId('publish-submit')).toBeEnabled()
  check('An unavailable initial history blocks admission until a confirmed absence is read')

  assert.deepEqual(await page.evaluate(() => window.storageWrites), [])
  assert.deepEqual(legacyReads, [])
  assert.deepEqual(failures, [])
  assert.deepEqual(outbound, [])
  console.log(JSON.stringify({ status: 'PASS', browserVersion: browser.version(), durationMs: Math.round(performance.now() - started),
    checks, requests: { reads: reads.length, admissions: writes.length, legacyReads: legacyReads.length, aborted: aborted.length }, externalRequests: outbound.length }, null, 2))
} finally {
  release?.(); readGate = null
  await browser?.close()
  await new Promise(done => server.close(done))
}
