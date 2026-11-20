// Independent HTTP -> real queue RPC boundary. Persistence only is simulated.
// No worker, network, secrets or paid provider is reachable.
import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'

const session = new AsyncLocalStorage<string | null>()
const alice = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const bob = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const marker = 'T08_SYNTHETIC_PRIVATE_SQL_DIAGNOSTIC'
const aliceKey = `production-${alice}-video-${requestId}`
let keys: string[] = []
let released = 0
let cancelled = false
let rpcFailure = false
mock.module('../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: {
    user: session.getStore() ? { id: session.getStore(), email: 'fixture@example.invalid' } : null,
  }, error: null }) } }),
} })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: () => { throw new Error('UNEXPECTED_SERVICE_READ') },
  rpc: async (name: string, input: Record<string, unknown>) => {
    assert.equal(name, 'cancel_video_job')
    assert.deepEqual(Object.keys(input), ['p_key'])
    const key = String(input.p_key)
    keys.push(key)
    if (rpcFailure) return { data: null, error: { message: marker } }
    if (key !== aliceKey || cancelled) return { data: false, error: null }
    cancelled = true; released++
    return { data: true, error: null }
  },
}) } })
mock.module('../../src/lib/video-worker.ts', { namedExports: {
  runVideoJob: () => { throw new Error('WORKER_FORBIDDEN') },
} })
const { POST } = await import('../../src/app/api/production/route.ts')
const call = (user: string | null, extra: Record<string, unknown> = {}) => session.run(user, async () => {
  const response = await POST(new Request('https://sutra.fixture.invalid/api/production', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'cancel', idea: 'T08 cancellation fixture', requestId, targetStep: 'video', ...extra }),
  }))
  return { status: response.status, body: await response.json() }
})
beforeEach(() => { keys = []; released = 0; cancelled = rpcFailure = false })

test('C01 cancellation requires a session and complete identity before RPC', async () => {
  assert.equal((await call(null)).status, 401)
  assert.equal((await call(alice, { targetStep: undefined })).status, 400)
  assert.deepEqual(keys, [])
})
test('C02 foreign user cannot cancel the owner job even with its request UUID', async () => {
  const result = await call(bob, { userId: alice })
  assert.equal(result.status, 200)
  assert.equal(result.body.data.cancelled, false)
  assert.deepEqual(keys, [`production-${bob}-video-${requestId}`])
  assert.equal(released, 0)
})
test('C03 double click reaches the same cancel key; fixture releases once', async () => {
  const results = await Promise.all([call(alice), call(alice)])
  assert.deepEqual(results.map(result => result.status), [200, 200])
  assert.deepEqual(results.map(result => result.body.data.cancelled).sort(), [false, true])
  assert.deepEqual(keys, [aliceKey, aliceKey]); assert.equal(released, 1)
})
test('C04 T08-CANCEL-01: SQL failure must not leak backend diagnostics through cancel response', async () => {
  rpcFailure = true
  const result = await call(alice)
  assert.ok(result.status >= 500 && result.status < 600)
  assert.equal(JSON.stringify(result.body).includes(marker), false,
    'Raw cancel RPC diagnostic crossed authenticated HTTP boundary')
  assert.equal(released, 0)
})
