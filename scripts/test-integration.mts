import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { awaitGeneration, awaitJobResult } from '../src/lib/generation-client'
import { boundedProviderJson as readProviderJson } from '../src/lib/provider-json'

let authenticated = true, row: unknown = null, dbError: unknown = null
const filters: Array<[string, unknown]> = []
const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query },
  maybeSingle: async () => ({ data: row, error: dbError }) }
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: authenticated ? { id: 'alice' } : null }, error: null }) } }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({ from: () => query }) } })
const { GET } = await import('../src/app/api/video/status/[jobId]/route')
const { middleware } = await import('../src/middleware')
const id = '10000000-0000-4000-8000-000000000001'
const status = () => GET(new Request('https://sutra.invalid/api/video/status/' + id), { params: Promise.resolve({ jobId: id }) })

test('202 receipt is polled until done; queued videoId cannot be mistaken for final media', async () => {
  const replies = ['queued', 'processing', 'done']; let polls = 0
  const videoId = await awaitGeneration(Response.json({ jobId: id, videoId: 'premature' }, { status: 202 }), new AbortController().signal, {
    delay: async () => {}, fetch: async (url, options) => {
      assert.equal(url, '/api/video/status/' + id); assert.equal(options?.cache, 'no-store')
      return Response.json({ status: replies[polls++], videoId: polls === 3 ? 'final-video' : 'premature' })
    },
  })
  assert.equal(polls, 3); assert.equal(videoId, 'final-video')
})
test('failed, missing receipt, interrupted and still queued work never becomes UI success', async () => {
  const signal = new AbortController().signal
  await assert.rejects(awaitGeneration(Response.json({}, { status: 202 }), signal), /Identifiant/)
  await assert.rejects(awaitGeneration(Response.json({ jobId: id }, { status: 202 }), signal,
    { delay: async () => {}, fetch: async () => Response.json({ status: 'failed', videoId: 'x' }) }), /interrompue/)
  await assert.rejects(awaitGeneration(Response.json({ jobId: id }, { status: 202 }), signal,
    { delay: async () => {}, fetch: async () => Response.json({ status: 'processing', videoId: 'x' }) }), /toujours en cours/)
  const aborted = new AbortController(); aborted.abort()
  await assert.rejects(awaitGeneration(Response.json({ jobId: id }, { status: 202 }), aborted.signal))
  assert.equal(await awaitGeneration(Response.json({ video: { id: 'ready' } }), signal), 'ready')
})
test('job status is owner-filtered, uncached, and omits progress/provider errors', async () => {
  filters.length = 0; row = { id, video_id: 'v', status: 'done', error: 'private' }
  const response = await status()
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(filters, [['id', id], ['user_id', 'alice']])
  assert.deepEqual(await response.json(), { jobId: id, videoId: 'v', status: 'done' })
  row = null; assert.equal((await status()).status, 404)
  dbError = { message: 'private-provider-marker' }
  const failure = await status(); assert.equal(failure.status, 503); assert.doesNotMatch(await failure.text(), /private-provider-marker/)
  dbError = null; authenticated = false; assert.equal((await status()).status, 401); authenticated = true
})
test('API middleware refuses cross-site mutations and non-JSON generation before side effects', async () => {
  for (const path of ['/api/create', '/api/production', '/api/auto/generate', '/api/video/export']) {
    assert.equal((await middleware(new NextRequest('https://sutra.invalid' + path, { method: 'POST', headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' } }))).status, 403)
    assert.equal((await middleware(new NextRequest('https://sutra.invalid' + path, { method: 'POST', headers: { origin: 'https://sutra.invalid', 'content-type': 'text/plain' } }))).status, 415)
    assert.equal((await middleware(new NextRequest('https://sutra.invalid' + path, { method: 'POST', headers: { origin: 'https://sutra.invalid', 'content-type': 'application/json' } }))).status, 200)
  }
})
test('provider JSON is bounded and object-only', async () => {
  await assert.rejects(readProviderJson(new Response('x'.repeat(65537))))
  await assert.rejects(readProviderJson(Response.json([])))
  assert.deepEqual(await readProviderJson(Response.json({ id: 'j' })), { id: 'j' })
})

test('production 202 exposes only the final result after done, never journal checkpoints', async () => {
  row = { id, video_id: null, kind: 'production', status: 'processing', progress: { steps: { private: true }, result: { url: 'https://final.invalid/v.mp4' } } }
  assert.deepEqual(await (await status()).json(), { jobId: id, videoId: null, status: 'processing' })
  row = { ...row as object, status: 'done' }
  const response = await status()
  const result = await awaitJobResult(Response.json({ jobId: id, status: 'processing' }, { status: 202 }), new AbortController().signal,
    { delay: async () => {}, fetch: async () => response })
  assert.deepEqual(result.data, { url: 'https://final.invalid/v.mp4' })
  assert.equal(result.steps, undefined)
})
