import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Real route, account guard, submission and queue helpers. Only external
// boundaries are fixtures: no provider, database, secrets or generation.
const alice = '12000000-0000-4000-8000-000000000001'
const bob = '12000000-0000-4000-8000-000000000002'
const marker = 'T02_SYNTHETIC_PRIVATE_DIAGNOSTIC'
let identity: string | null = alice
let expired = false
let revoked = false
let failAt = ''
let diagnostic: unknown = new Error(marker)
let claim = false
let workerCalls = 0
let reads = 0
let calls: Array<{ name: string; args: Record<string, unknown> }> = []
const server = {
  auth: { getUser: async () => ({ data: { user: identity ? { id: identity, email: 'fixture@example.test' } : null },
    error: expired ? new Error('expired') : null }) },
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: {
      id: identity, subscription_status: 'active', access_revoked_at: revoked ? '2026-01-01' : null,
    }, error: null }) }; return q
  },
}
const { enforceAccountAccess } = await import('../src/lib/account-access.ts')
const guarded = enforceAccountAccess(server as never)
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => guarded } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: (table: string) => {
    assert.equal(table, 'profiles')
    const q = { select: () => q, eq: (key: string, value: unknown) => {
      assert.equal(key, 'id'); assert.equal(value, identity); return q
    }, single: async () => {
      reads++
      if (failAt === 'profile') throw diagnostic
      return { data: { id: identity, email: 'fixture@example.test', plan: 'free' }, error: null }
    } }; return q
  },
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (failAt === name + ':throw') throw diagnostic
    if (failAt === name) return { data: null, error: diagnostic }
    if (name === 'submit_video_job') {
      assert.equal(args.p_user_id, identity)
      const input = (args.p_payload as { input: Record<string, unknown> }).input
      assert.equal(input.userId, identity); assert.equal(input.userPlan, 'free')
      return { data: { id: 'job-fixture', user_id: identity, kind: 'production',
        idempotency_key: args.p_key, status: 'queued' }, error: null }
    }
    if (name === 'claim_video_job_by_key') {
      assert.ok(String(args.p_key).startsWith(`production-${identity}-script-`))
      return { data: claim ? [{ id: 'job-fixture', user_id: identity }] : [], error: null }
    }
    if (name === 'cancel_video_job') return { data: false, error: null }
    if (name === 'finish_video_job') return { data: args.p_status, error: null }
    assert.fail(`Unexpected fixture RPC: ${name}`)
  },
}) } })
mock.module('../src/lib/video-worker.ts', { namedExports: { runVideoJob: async () => {
  workerCalls++; throw diagnostic
} } })
const { POST } = await import('../src/app/api/production/route.ts')
const request = (body: unknown = { step: 'script', idea: 'offline fixture', requestId: '12000000-0000-4000-8000-000000000009' }) => POST(new Request('https://sutra.example.test/api/production', {
  method: 'POST', body: JSON.stringify(body),
}))
beforeEach(() => {
  identity = alice; expired = revoked = claim = false; failAt = ''; diagnostic = new Error(marker)
  workerCalls = reads = 0; calls = []
})

for (const state of ['anonymous', 'expired', 'revoked']) {
  test(`production denies ${state} before privileged reads and RPCs`, async () => {
    if (state === 'anonymous') identity = null
    if (state === 'expired') expired = true
    if (state === 'revoked') revoked = true
    assert.equal((await request()).status, 401)
    assert.deepEqual([reads, calls.length, workerCalls], [0, 0, 0])
  })
}
test('two users with the same client intent get distinct user-scoped jobs and server-derived plans', async () => {
  assert.equal((await request()).status, 202)
  identity = bob
  assert.equal((await request()).status, 202)
  const submissions = calls.filter(c => c.name === 'submit_video_job')
  assert.notEqual(submissions[0].args.p_key, submissions[1].args.p_key)
  assert.equal(workerCalls, 0)
})
test('client cannot inject another user or an elevated plan', async () => {
  const response = await request({ step: 'script', idea: 'fixture', userId: bob, userPlan: 'empire',
    requestId: '12000000-0000-4000-8000-000000000009' })
  assert.equal(response.status, 202)
  assert.equal(calls.filter(c => c.name === 'submit_video_job').length, 1)
  assert.equal(workerCalls, 0)
})
for (const point of ['submit_video_job', 'submit_video_job:throw', 'claim_video_job_by_key', 'claim_video_job_by_key:throw', 'profile']) {
  test(`diagnostic redaction at ${point}`, async () => {
    failAt = point
    const response = await request()
    assert.equal(response.status, 503)
    assert.equal((await response.text()).includes(marker), false)
    assert.equal(workerCalls, 0)
    assert.equal(calls.filter(c => c.name === 'submit_video_job').length, point === 'profile' ? 0 : 1)
  })
}
for (const [code, status] of [['SUTRA_QUOTA_EXHAUSTED', 403], ['SUTRA_IDEMPOTENCY_CONFLICT', 409], ['SUTRA_INVALID_REQUEST_ID', 400]] as const) {
  test(`exact public submission code remains ${status}: ${code}`, async () => {
    failAt = 'submit_video_job'; diagnostic = new Error(code)
    const response = await request()
    assert.equal(response.status, status); assert.deepEqual(await response.json(), { error: code })
  })
  test(`embedded public code cannot expose a claim diagnostic: ${code}`, async () => {
    failAt = 'claim_video_job_by_key'; diagnostic = new Error(`${code}: ${marker}`)
    const response = await request()
    assert.equal(response.status, 503)
    assert.equal((await response.text()).includes(marker), false)
  })
}
test('worker diagnostic is redacted both from the response and the durable last_error', async () => {
  claim = true
  const response = await request()
  assert.equal(response.status, 503)
  assert.equal((await response.text()).includes(marker), false)
  const finishes = calls.filter(c => c.name === 'finish_video_job')
  assert.equal(finishes.length, 1)
  assert.equal(finishes[0].args.p_status, 'queued')
  assert.equal(String(finishes[0].args.p_error).includes(marker), false)
  assert.equal(workerCalls, 1)
})
test('unconfirmed durable error write stays fail-closed', async () => {
  claim = true; failAt = 'finish_video_job'
  const response = await request()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Generation indisponible', status: 'write_unconfirmed' })
  assert.equal(workerCalls, 1)
})
test('non-Error throw cannot escape diagnostic values', async () => {
  failAt = 'claim_video_job_by_key:throw'; diagnostic = { message: marker, details: marker }
  const response = await request()
  assert.equal(response.status, 503); assert.equal((await response.text()).includes(marker), false)
})
