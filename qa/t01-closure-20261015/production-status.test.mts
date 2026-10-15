import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const alice = '12000000-0000-4000-8000-000000000001'
const bob = '12000000-0000-4000-8000-000000000002'
const requestId = '12000000-0000-4000-8000-000000000009'
const jobId = '12000000-0000-4000-8000-000000000008'
const marker = 'T01_SYNTHETIC_PRIVATE_STATUS_DIAGNOSTIC'
let identity: string | null = alice, expired = false, revoked = false, absent = false
let failAt = '', status = 'queued', reads = 0
let filters: Record<string, unknown> = {}
const server = {
  auth: { getUser: async () => ({ data: { user: identity ? { id: identity } : null }, error: expired ? new Error(marker) : null }) },
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({
      data: { id: identity, subscription_status: 'active', access_revoked_at: revoked ? '2026-01-01' : null }, error: null,
    }) }; return query
  },
}
const { enforceAccountAccess } = await import('../../src/lib/account-access.ts')
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => {
  if (failAt === 'session') throw new Error(marker)
  return enforceAccountAccess({ ...server, auth: { ...server.auth } } as never)
} } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  reads++
  if (failAt === 'service') throw new Error(marker)
  return { from: (table: string) => {
    assert.equal(table, 'video_jobs')
    const query = {
      select: (columns: string) => { assert.equal(columns, 'id,status,progress'); return query },
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      maybeSingle: async () => {
        if (failAt === 'throw') throw new Error(marker)
        assert.equal(filters.user_id, identity); assert.equal(filters.kind, 'production')
        return { data: absent ? null : { id: jobId, status, progress: { result: { title: 'fixture' }, private: marker }, private: marker },
          error: failAt === 'database' ? { message: marker } : null }
      },
    }; return query
  }, rpc: () => assert.fail('A lookup must never perform an RPC or mutate quota') }
} } })
mock.module('../../src/lib/video-worker.ts', { namedExports: { runVideoJob: () => assert.fail('A lookup must never run a worker') } })
const route = await import('../../src/app/api/production/route.ts') as unknown as { GET?: (request: Request) => Promise<Response> }
const invoke = (query = `requestId=${requestId}&targetStep=script`) => {
  assert.equal(typeof route.GET, 'function', 'missing read-only reconciliation for original production intent')
  return route.GET!(new Request(`https://sutra.example.test/api/production?${query}`))
}
beforeEach(() => { identity = alice; expired = revoked = absent = false; failAt = ''; status = 'queued'; reads = 0; filters = {} })

for (const state of ['anonymous', 'expired', 'revoked']) test(`lookup denies ${state} before privileged read`, async () => {
  if (state === 'anonymous') identity = null
  expired = state === 'expired'; revoked = state === 'revoked'
  assert.equal((await invoke()).status, 401); assert.equal(reads, 0)
})
for (const query of ['', 'targetStep=script', `requestId=${requestId}`, 'requestId=bad&targetStep=script',
  `requestId=${requestId}&targetStep=cancel`, `requestId=${requestId}&targetStep=thumbnail`,
  `requestId=${requestId}&targetStep=script&targetStep=video`, `requestId=${requestId}&requestId=${requestId}&targetStep=script`]) {
  test(`lookup rejects invalid or ambiguous identity: ${query}`, async () => {
    assert.equal((await invoke(query)).status, 400); assert.equal(reads, 0)
  })
}
for (const step of ['script', 'video', 'voice', 'music', 'assembly', 'all']) test(`lookup scopes ${step} to authenticated owner and production kind`, async () => {
  for (const user of [alice, bob]) {
    identity = user; filters = {}
    const response = await invoke(`requestId=${requestId}&targetStep=${step}&user_id=${alice}`)
    assert.equal(response.status, 200)
    assert.deepEqual(filters, { user_id: user, kind: 'production', idempotency_key: `production-${user}-${step}-${requestId}` })
    assert.deepEqual(await response.json(), { jobId, status: 'queued' })
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  }
})
for (const state of ['queued', 'processing', 'cancelled', 'failed', 'uncertain', 'done']) test(`lookup returns stored ${state} without resubmitting`, async () => {
  status = state
  const response = await invoke()
  assert.deepEqual(await response.json(), { jobId, status: state, ...(state === 'done' ? { data: { title: 'fixture' } } : {}) })
  assert.equal(reads, 1)
})
test('a missing row remains 404, never falsely cancelled or created', async () => {
  absent = true
  const response = await invoke()
  assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'Tache introuvable' })
  assert.equal(reads, 1)
})
for (const point of ['session', 'service', 'throw', 'database']) test(`lookup redacts ${point} failure`, async () => {
  failAt = point
  const response = await invoke()
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'Statut indisponible' })
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})
test('lost submit ACK then unconfirmed cancel can observe terminal completion without a new POST', async () => {
  absent = true; assert.equal((await invoke()).status, 404)
  absent = false; status = 'done'
  assert.deepEqual(await (await invoke()).json(), { jobId, status: 'done', data: { title: 'fixture' } })
  assert.equal(reads, 2)
})
