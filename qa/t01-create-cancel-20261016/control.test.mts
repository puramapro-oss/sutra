import assert from 'node:assert/strict'
import { test, mock, beforeEach } from 'node:test'

const actor = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'
const jobId = '33333333-3333-4333-8333-333333333333'
const marker = 'SYNTHETIC_PRIVATE_PROVIDER_DIAGNOSTIC'
let user: { id: string } | null, authError: Error | null, readError: boolean, cancelError: boolean
let job: Record<string, unknown> | null, reads: number, cancellations: string[]
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user }, error: authError }) },
}) } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({ from: (name: string) => {
  assert.equal(name, 'video_jobs')
  const filters: Record<string, unknown> = {}
  const query = {
    select: (columns: string) => { assert.equal(columns, 'id,status,video_id'); return query },
    eq: (key: string, value: unknown) => { filters[key] = value; return query },
    maybeSingle: async () => {
      reads++
      assert.deepEqual(Object.keys(filters).sort(), ['idempotency_key', 'kind', 'user_id'])
      return { data: job && Object.entries(filters).every(([key, value]) => job?.[key] === value) ? job : null, error: readError ? new Error(marker) : null }
    },
  }
  return query
} }) } })
mock.module('../../src/lib/video-queue.ts', { namedExports: { cancelJobByKey: async (key: string) => {
  cancellations.push(key)
  if (cancelError) throw new Error(marker)
  if (job?.status === 'done') return false
  if (job) job.status = 'cancelled'
  return true
} } })
const route = await import('../../src/app/api/create/status/route.ts')
const request = (query = `requestId=${requestId}`) => new Request(`https://sutra.example.test/api/create/status?${query}`)
beforeEach(() => {
  user = { id: actor }; authError = null; readError = cancelError = false; reads = 0; cancellations = []
  job = { id: jobId, user_id: actor, kind: 'create', idempotency_key: `create-${actor}-${requestId}`, status: 'queued',
    video_id: '44444444-4444-4444-8444-444444444444', payload: { secret: marker } }
})
test('unauthenticated and auth error never read or cancel; no-store', async () => {
  for (const method of ['GET', 'DELETE'] as const) {
    user = null
    const denied = await route[method](request()); assert.equal(denied.status, 401)
    assert.match(denied.headers.get('cache-control')!, /no-store/)
    user = { id: actor }; authError = new Error(marker)
    assert.equal((await route[method](request())).status, 401)
  }
  assert.equal(reads, 0); assert.deepEqual(cancellations, [])
})
test('invalid, absent, duplicate or oversized identity rejected before DB', async () => {
  for (const query of ['', 'requestId=', 'requestId=%20', 'requestId=' + 'x'.repeat(201), `requestId=${requestId}&requestId=${requestId}`]) {
    assert.equal((await route.GET(request(query))).status, 400)
    assert.equal((await route.DELETE(request(query))).status, 400)
  }
  assert.equal(reads, 0); assert.deepEqual(cancellations, [])
})
test('other owner, other kind and other key are absent, never cancelled', async () => {
  const original = { ...job }
  for (const override of [{ user_id: 'other' }, { kind: 'production' }, { idempotency_key: 'other' }]) {
    job = { ...original, ...override }
    assert.equal((await route.GET(request())).status, 404)
    assert.equal((await route.DELETE(request())).status, 404)
  }
  assert.deepEqual(cancellations, [])
})
test('GET exposes only owner status; does not execute cancellation or return payload/video while queued', async () => {
  const response = await route.GET(request())
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { jobId, status: 'queued' })
  assert.deepEqual(cancellations, [])
})
test('DELETE confirms canonical state; completed job cannot be reported cancelled', async () => {
  assert.deepEqual(await (await route.DELETE(request())).json(), { jobId, status: 'cancelled' })
  assert.deepEqual(cancellations, [`create-${actor}-${requestId}`])
  job!.status = 'done'
  const response = await route.DELETE(request())
  assert.deepEqual(await response.json(), { jobId, status: 'done', videoId: job!.video_id })
})
test('missing early cancellation is unconfirmed and performs no mutation', async () => {
  job = null
  assert.equal((await route.DELETE(request())).status, 404); assert.deepEqual(cancellations, [])
})
test('read failures and uncertain cancel ACK are 503 without private diagnostic', async () => {
  for (const fault of ['read', 'cancel']) {
    readError = fault === 'read'; cancelError = fault === 'cancel'
    const response = await route.DELETE(request())
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), new RegExp(marker))
  }
})
