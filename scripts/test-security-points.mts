import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://points-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
let authenticated = true, status = 'active', revoked: string | null = null, authFailure = false
let serviceClients = 0, walletCredits = 0
const writes: unknown[] = [], filters: Array<[string, string, unknown]> = []
const sessionQuery = {
  select: () => sessionQuery, eq: () => sessionQuery,
  maybeSingle: async () => ({ data: { id: 'alice', subscription_status: status, access_revoked_at: revoked }, error: null }),
}
mock.module('@supabase/ssr', { namedExports: { createServerClient: () => ({
  auth: { getUser: async () => {
    if (authFailure) throw new Error('synthetic-sensitive-marker')
    return { data: { user: authenticated ? { id: 'alice' } : null }, error: null }
  } }, from: () => sessionQuery,
}) } })
mock.module('next/headers', { namedExports: { cookies: async () => ({ getAll: () => [], set: () => {} }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  serviceClients++
  return { from: (table: string) => {
    const result = () => ({ data: table === 'point_milestones' ? null : table === 'purama_points'
      ? { balance: 10, lifetime_earned: 10 } : table === 'point_transactions' ? [] : { wallet_balance: 0, streak: 2, level: 1, xp: 10 }, error: null })
    const query = {
      select: () => query, eq: (column: string, value: unknown) => { filters.push([table, column, value]); return query },
      order: () => query, limit: () => query,
      insert: (value: unknown) => { writes.push({ table, value }); return query },
      update: (value: unknown) => { writes.push({ table, value }); return query },
      single: async () => result(),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    }
    return query
  } }
} } })
mock.module('../src/lib/smart-split.ts', { namedExports: { creditWallet: async () => { walletCredits++ } } })
const { GET, POST } = await import('../src/app/api/points/route.ts')
const post: (request: Request) => Promise<Response> = POST
const request = (body: unknown) => new Request('https://app.invalid/api/points', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  authenticated = true; status = 'active'; revoked = null; authFailure = false
  serviceClients = 0; walletCredits = 0; writes.length = 0; filters.length = 0
})
function noEffects() {
  assert.equal(serviceClients, 0); assert.equal(walletCredits, 0); assert.deepEqual(writes, [])
}

for (const body of [
  { action: 'earn', amount: 1000000, source: 'forged' },
  { action: 'earn', amount: 50, source: 'breathe_session' },
  { action: 'earn', amount: 25000, source: 'daily_gift', user_id: 'bob', role: 'service_role' },
  { action: 'spend', amount: 1, source: 'forged' },
]) test(`client cannot mutate points or credit wallet: ${JSON.stringify(body)}`, async () => {
  const response = await post(request(body))
  // Diagnostic counts also prove the original handler reached privileged writes.
  assert.equal(response.status, 403, `status=${response.status}; writes=${writes.length}; walletCredits=${walletCredits}`)
  noEffects()
})
test('malformed/replayed client requests cannot authorize point mutations', async () => {
  for (let i = 0; i < 3; i++) {
    const response = await post(new Request('https://app.invalid/api/points', { method: 'POST', body: '{' }))
    assert.equal(response.status, 403)
  }
  noEffects()
})
for (const identity of ['anonymous', 'banned', 'revoked']) test(`${identity} session cannot read or mutate points`, async () => {
  authenticated = identity !== 'anonymous'; status = identity === 'banned' ? 'banned' : 'active'
  revoked = identity === 'revoked' ? '2026-10-12T00:00:00Z' : null
  assert.equal((await post(request({ action: 'earn', amount: 1, source: 'forged' }))).status, 401)
  assert.equal((await GET()).status, 401)
  noEffects()
})
test('authentication failure is closed without leaking diagnostics or creating a service client', async () => {
  authFailure = true
  const response = await post(request({ action: 'earn', amount: 1, source: 'forged' }))
  assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), /synthetic-sensitive-marker/)
  noEffects()
})
test('active user can still read only their own points and history', async () => {
  const response = await GET()
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).points, { balance: 10, lifetime_earned: 10 })
  assert.deepEqual(filters, [['purama_points', 'user_id', 'alice'], ['point_transactions', 'user_id', 'alice'], ['profiles', 'id', 'alice']])
  assert.deepEqual(writes, []); assert.equal(walletCredits, 0)
})
