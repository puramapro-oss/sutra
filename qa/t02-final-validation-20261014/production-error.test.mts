import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Regression contract for T03/T01: keep this failing until the owned API boundary
// is fixed. The actual route, account guard and submission helper run together.
// No provider, worker, database, secret or real publication is used.
const marker = 'T02_SYNTHETIC_DATABASE_DIAGNOSTIC'
let authenticated = true
let expired = false
let rpcFailure = false
let submissions = 0
let serviceReads = 0
let profileReads = 0
const server = {
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'alice', email: 'alice@example.test' } : null },
    error: expired ? new Error('synthetic-expired-session') : null }) },
  from: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => {
      profileReads++; return { data: { id: 'alice', subscription_status: 'active', access_revoked_at: null }, error: null }
    } }; return q
  },
}
const { enforceAccountAccess } = await import('../../src/lib/account-access.ts')
const guarded = enforceAccountAccess(server as never)
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => guarded } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: () => {
    const q = { select: () => q, eq: (key: string, value: string) => {
      assert.equal(key, 'id'); assert.equal(value, 'alice'); return q
    }, single: async () => { serviceReads++; return { data: { id: 'alice', email: 'alice@example.test', plan: 'free' }, error: null } } }
    return q
  },
  rpc: async (name: string, input: Record<string, unknown>) => {
    submissions++; assert.equal(name, 'submit_video_job'); assert.equal(input.p_user_id, 'alice')
    return rpcFailure ? { data: null, error: { message: marker } } : { data: {
      id: 'job-fixture', user_id: 'alice', kind: 'production', idempotency_key: input.p_key, status: 'queued',
    }, error: null }
  },
}) } })
mock.module('../../src/lib/video-worker.ts', { namedExports: { runVideoJob: () => { throw new Error('WORKER_FORBIDDEN') } } })
mock.module('../../src/lib/video-queue.ts', { namedExports: {
  claimJobByKey: async () => null, cancelJobByKey: async () => false,
  completeQuotaForFinishedJob: async () => false, finishJob: async () => { throw new Error('WRITE_FORBIDDEN') },
} })
const { POST } = await import('../../src/app/api/production/route.ts')
const request = () => POST(new Request('https://sutra.example.test/api/production', {
  method: 'POST', body: JSON.stringify({ step: 'script', idea: 'offline fixture' }),
}))
beforeEach(() => { authenticated = true; expired = rpcFailure = false; submissions = serviceReads = profileReads = 0 })
test('production: unauthenticated request cannot read service data or submit work', async () => {
  authenticated = false
  assert.equal((await request()).status, 401)
  assert.deepEqual([submissions, serviceReads, profileReads], [0, 0, 0])
})
test('production: expired session cannot proceed even if SDK retains user data', async () => {
  expired = true
  assert.equal((await request()).status, 401)
  assert.deepEqual([submissions, serviceReads, profileReads], [0, 0, 0])
})
test('production: active session reaches a queued receipt without executing a worker', async () => {
  assert.equal((await request()).status, 202)
  assert.deepEqual([submissions, serviceReads, profileReads], [1, 1, 1])
})
test('T02-FINAL-01: production must not return raw submission RPC diagnostics', async () => {
  rpcFailure = true
  const response = await request()
  assert.equal(response.status, 503)
  assert.equal(submissions, 1)
  const body = await response.text()
  assert.equal(body.includes(marker), false, 'Raw backend diagnostic crossed the authenticated HTTP boundary')
})
