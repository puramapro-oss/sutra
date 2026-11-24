// Actual React hooks, SSR, hydration and Chromium. Every API reply is synthetic;
// requests never leave this local fixture or invoke a generation provider.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { DurableHooksProbe } from './durable-hooks-fixture.tsx'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const requestId = '33333333-3333-4333-8333-333333333333'
const jobId = '44444444-4444-4444-8444-444444444444'
const videoId = '55555555-5555-4555-8555-555555555555'
const key = (kind, user = owner) => `sutra:${kind === 'create' ? 'create' : 'production'}-intent:v1:${user}`
const receipt = (kind, extra = {}) => ({
  version: 1, userId: owner, requestId, cancelRequested: false,
  ...(kind === 'production' ? { step: 'video' } : {}),
  body: JSON.stringify(kind === 'create' ? { topic: 'Synthetic local recovery test' }
    : { step: 'video', idea: 'Synthetic local recovery test', requestId, previousData: { script: { title: 'Preserved result' } } }),
  ...extra,
})
let server, browser, base, script
const errors = []

before(async () => {
  const compiled = await build({
    plugins: process.env.SUTRA_DURABLE_HOOKS_BASELINE ? [{
      name: 'exact-committed-hook-counterexample',
      setup(builder) {
        const commit = execFileSync('git', ['rev-parse', '--verify', `${process.env.SUTRA_DURABLE_HOOKS_BASELINE}^{commit}`], { encoding: 'utf8' }).trim()
        builder.onLoad({ filter: /\/src\/hooks\/use(CreateRequest|ProductionGeneration)\.ts$/ }, args => ({
          contents: execFileSync('git', ['show', `${commit}:${relative(process.cwd(), args.path)}`], { encoding: 'utf8' }), loader: 'ts',
        }))
      },
    }] : [],
    stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
      import { createElement, StrictMode } from 'react';
      import { hydrateRoot } from 'react-dom/client';
      import { DurableHooksProbe } from './scripts/durable-hooks-fixture.tsx';
      const params = new URLSearchParams(location.search);
      const kind = params.get('kind'); const ownerId = params.get('owner');
      window.durableHooks = {
        frame: null, frames: [], actions: {}, restores: [], calls: [], releases: [],
        reply: { status: 503, body: {}, hold: false },
        record(view, actions) { this.frame = view; this.frames.push(view); this.actions = actions; },
        restored(body, step, revision) { this.restores.push({ body, step, revision }); },
      };
      window.fetch = async (url, init = {}) => {
        const h = window.durableHooks;
        const call = { url: String(url), method: init.method || 'GET', body: init.body,
          stored: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])), aborted: false };
        h.calls.push(call);
        init.signal?.addEventListener('abort', () => { call.aborted = true; }, { once: true });
        const response = () => new Response(JSON.stringify(h.reply.body), { status: h.reply.status, headers: { 'Content-Type': 'application/json' } });
        return h.reply.hold ? new Promise(resolve => h.releases.push(() => resolve(response()))) : response();
      };
      const element = (ownerId, revision = 0) => createElement(StrictMode, null,
        createElement(DurableHooksProbe, { ownerId, kind, revision }));
      const root = hydrateRoot(document.getElementById('root'), element(ownerId));
      window.durableHooks.mount = (ownerId, revision = 0) => root.render(element(ownerId, revision));
    ` },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"' }, tsconfig: 'tsconfig.json',
  })
  script = compiled.outputFiles[0].contents
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.invalid')
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return }
    const kind = url.searchParams.get('kind') === 'production' ? 'production' : 'create'
    const html = renderToString(createElement(DurableHooksProbe, { kind, ownerId: owner, revision: 0 }))
    res.setHeader('Content-Type', 'text/html')
    res.end(`<!doctype html><html><body><div id="root">${html}</div><script src="/fixture.js"></script></body></html>`)
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  base = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ headless: true, ...(process.env.SUTRA_CHROMIUM_PATH ? { executablePath: process.env.SUTRA_CHROMIUM_PATH } : {}) })
})
after(async () => { await browser?.close(); server?.close(); assert.deepEqual(errors, []) })

async function open(kind, stored = {}) {
  const page = await browser.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /hydration|did not match|server rendered/i.test(message.text())) errors.push(message.text()) })
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  await page.addInitScript(values => { for (const [name, value] of Object.entries(values)) sessionStorage.setItem(name, value) }, stored)
  await page.goto(`${base}/?kind=${kind}&owner=${owner}`)
  await page.waitForFunction(() => Boolean(window.durableHooks?.frame))
  return page
}

for (const kind of ['create', 'production']) {
  test(`${kind}: hydrate a cancellation receipt without submitting, then resume its exact identity`, async () => {
    const page = await open(kind, { [key(kind)]: JSON.stringify(receipt(kind, { cancelRequested: true })) })
    try {
      await page.waitForFunction(() => Boolean(window.durableHooks.frame.intent))
      let result = await page.evaluate(() => ({ frame: window.durableHooks.frame, calls: window.durableHooks.calls, restores: window.durableHooks.restores }))
      assert.equal(result.frame.requestLocked, true); assert.equal(result.frame.intent.requestId, requestId)
      assert.equal(result.calls.length, 0)
      if (kind === 'production') {
        assert.equal(result.frame.generatedData.script.title, 'Preserved result')
        assert.equal(result.frame.stepStatus.script, 'done')
        assert.ok(result.restores.length >= 1)
      }
      await page.evaluate(() => { window.durableHooks.reply.status = 404; window.durableHooks.actions.resume() })
      await page.waitForFunction(() => Boolean(window.durableHooks.frame.error))
      result = await page.evaluate(() => ({ frame: window.durableHooks.frame, calls: window.durableHooks.calls }))
      assert.equal(result.calls.length, 1); assert.equal(result.calls[0].method, 'GET')
      assert.match(result.calls[0].url, new RegExp(requestId))
      assert.equal(result.frame.intent.requestId, requestId); assert.equal(result.frame.intent.cancelRequested, true)
    } finally { await page.close() }
  })

  test(`${kind}: account changes never commit the previous owner's receipt and abort its observer`, async () => {
    const page = await open(kind, { [key(kind)]: JSON.stringify(receipt(kind)) })
    try {
      await page.waitForFunction(() => Boolean(window.durableHooks.frame.intent))
      await page.evaluate(() => { window.durableHooks.reply.hold = true; window.durableHooks.actions.resume() })
      await page.waitForFunction(() => window.durableHooks.calls.length === 1)
      await page.evaluate(user => window.durableHooks.mount(user), other)
      await page.waitForFunction(user => window.durableHooks.frame.ownerId === user && !window.durableHooks.frame.requestLocked, other)
      const result = await page.evaluate(user => ({ frame: window.durableHooks.frame, frames: window.durableHooks.frames.filter(frame => frame.ownerId === user), calls: window.durableHooks.calls }), other)
      assert.ok(result.frames.length >= 1)
      assert.equal(result.frames.some(frame => frame.intent !== null), false, 'No committed frame may expose the former owner')
      assert.equal(result.calls[0].aborted, true)
      await page.evaluate(({ jobId, videoId }) => {
        window.durableHooks.reply = { status: 200, body: { status: 'done', jobId, videoId, data: { title: 'Stale result' } } }
        window.durableHooks.releases.forEach(release => release())
      }, { jobId, videoId })
      await page.waitForTimeout(30)
      const final = await page.evaluate(kind => ({ frame: window.durableHooks.frame, receipt: sessionStorage.getItem(`sutra:${kind}-intent:v1:11111111-1111-4111-8111-111111111111`) }), kind)
      assert.equal(final.frame.intent, null); assert.ok(final.receipt)
      assert.equal(final.frame.videoId ?? null, null)
      if (kind === 'production') assert.deepEqual(final.frame.generatedData, {})
    } finally { await page.close() }
  })

  test(`${kind}: corrupt recovery remains locked and a storage write failure cannot submit`, async () => {
    const broken = await open(kind, { [key(kind)]: 'invalid-json' })
    try {
      await broken.waitForFunction(() => Boolean(window.durableHooks.frame.error))
      await broken.evaluate(() => window.durableHooks.actions.submit(JSON.stringify({ topic: 'Synthetic local test' })))
      assert.equal(await broken.evaluate(() => window.durableHooks.frame.requestLocked), true)
      assert.equal(await broken.evaluate(() => window.durableHooks.calls.length), 0)
    } finally { await broken.close() }
    const empty = await open(kind)
    try {
      await empty.waitForFunction(() => !window.durableHooks.frame.requestLocked)
      await empty.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Synthetic storage failure') }; return window.durableHooks.actions.submit(JSON.stringify({ topic: 'Synthetic local test' })) })
      assert.ok(await empty.evaluate(() => window.durableHooks.frame.error))
      assert.equal(await empty.evaluate(() => window.durableHooks.calls.length), 0)
    } finally { await empty.close() }
  })

  test(`${kind}: double submission persists one identity and a reload only resumes that identity`, async () => {
    const page = await open(kind)
    try {
      await page.waitForFunction(() => !window.durableHooks.frame.requestLocked)
      await page.evaluate(() => {
        window.durableHooks.reply.hold = true
        const body = JSON.stringify({ topic: 'Synthetic local test' })
        window.durableHooks.actions.submit(body); window.durableHooks.actions.submit(body)
      })
      await page.waitForFunction(() => window.durableHooks.calls.length === 1 && Boolean(window.durableHooks.frame.intent))
      const sent = await page.evaluate(() => ({ call: window.durableHooks.calls[0], intent: window.durableHooks.frame.intent, count: window.durableHooks.calls.length }))
      assert.equal(sent.count, 1); assert.equal(sent.call.method, 'POST')
      assert.equal(JSON.parse(sent.call.stored[key(kind)]).requestId, sent.intent.requestId)
      assert.equal(sent.call.body, sent.intent.body)
      await page.reload()
      await page.waitForFunction(() => Boolean(window.durableHooks?.frame?.intent))
      assert.equal(await page.evaluate(() => window.durableHooks.calls.length), 0)
      assert.equal(await page.evaluate(() => window.durableHooks.frame.intent.requestId), sent.intent.requestId)
      await page.evaluate(() => window.durableHooks.actions.resume())
      await page.waitForFunction(() => Boolean(window.durableHooks.frame.error))
      const resumed = await page.evaluate(() => window.durableHooks.calls)
      assert.equal(resumed.length, 1); assert.equal(resumed[0].method, 'GET')
      assert.match(resumed[0].url, new RegExp(sent.intent.requestId))
    } finally { await page.close() }
  })
}

for (const status of ['done', 'cancelled']) {
test(`production: a ${status} restored request cannot restore an obsolete form after callback replacement`, async () => {
  const page = await open('production', { [key('production')]: JSON.stringify(receipt('production', { jobId })) })
  try {
    await page.waitForFunction(() => Boolean(window.durableHooks.frame.intent))
    await page.evaluate(({ jobId, status }) => {
      window.durableHooks.reply = { status: 200, body: { status, jobId, data: { url: 'https://fixture.invalid/video.mp4' } } }
      window.durableHooks.actions.resume()
    }, { jobId, status })
    await page.waitForFunction(() => window.durableHooks.frame.intent === null && !window.durableHooks.frame.requestLocked)
    const restoredBefore = await page.evaluate(() => window.durableHooks.restores.length)
    await page.evaluate(user => window.durableHooks.mount(user, 1), owner)
    await page.waitForTimeout(30)
    assert.equal(await page.evaluate(() => window.durableHooks.restores.length), restoredBefore)
  } finally { await page.close() }
})
}
