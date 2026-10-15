import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const alice = '16000000-0000-4000-8000-000000000001'
const bob = '16000000-0000-4000-8000-000000000002'
const marker = 'T06_SYNTHETIC_PRIVATE_AUTOPILOT_DIAGNOSTIC'
let identity: string | null = alice
let expired = false, revoked = false, absent = false
let failAt = '', privileged = 0, throwFailure = false
const writes: Array<Record<string, unknown>> = []
const { enforceAccountAccess } = await import('../../src/lib/account-access.ts')
mock.module('../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => {
    if (failAt === 'auth') throw new Error(marker)
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({
      data: { id: identity, subscription_status: 'active', access_revoked_at: revoked ? '2026-01-01' : null }, error: null,
    }) }
    return enforceAccountAccess({
      auth: { getUser: async () => ({ data: { user: identity ? { id: identity } : null }, error: expired ? new Error('expired') : null }) },
      from: () => query,
    } as never)
  },
} })
mock.module('@supabase/supabase-js', { namedExports: { createClient: (_url: unknown, _key: unknown, options: unknown) => {
  privileged++
  assert.deepEqual(options, { db: { schema: 'public' }, auth: { autoRefreshToken: false, persistSession: false } })
  if (failAt === 'service') throw new Error(marker)
  return { from: (table: string) => {
    assert.equal(table, 'social_autopilot_config')
    const result = (point: string, data: unknown) => {
      if (failAt !== point) return { data, error: null }
      if (throwFailure) throw new Error(marker)
      return { data: null, error: { message: marker, details: marker } }
    }
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { assert.equal(key, 'user_id'); assert.equal(value, identity); return query },
      maybeSingle: async () => result('read', absent ? null : { user_id: identity, enabled: true, default_platforms: ['youtube'] }),
      insert: (row: Record<string, unknown>) => { assert.equal(row.user_id, identity); writes.push(row); return query },
      upsert: (row: Record<string, unknown>, opts: unknown) => {
        assert.equal(row.user_id, identity); assert.deepEqual(opts, { onConflict: 'user_id' }); writes.push(row); return query
      },
      single: async () => result('write', writes.at(-1)),
    }
    return query
  } }
} } })
const { GET, POST } = await import('../../src/app/api/social/autopilot/route.ts')
const invoke = (method: string, body: unknown = { enabled: false }) => method === 'GET' ? GET() : POST(new Request('https://sutra.example.test/api/social/autopilot', {
  method: 'POST', body: JSON.stringify(body),
}))
beforeEach(() => { identity = alice; expired = revoked = absent = throwFailure = false; failAt = ''; privileged = 0; writes.length = 0 })

for (const method of ['GET', 'POST']) {
  for (const state of ['anonymous', 'expired', 'revoked']) {
    test(`autopilot ${method} refuses ${state} before privileged access`, async () => {
      if (state === 'anonymous') identity = null
      expired = state === 'expired'; revoked = state === 'revoked'
      assert.equal((await invoke(method)).status, 401); assert.equal(privileged, 0); assert.equal(writes.length, 0)
    })
  }
  for (const point of ['auth', 'service']) {
    test(`autopilot ${method} sanitizes thrown ${point} diagnostics`, async () => {
      failAt = point
      const response = await invoke(method)
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { error: 'Erreur interne' })
    })
  }
  for (const thrown of [false, true]) {
    test(`autopilot ${method} sanitizes ${thrown ? 'thrown' : 'returned'} database diagnostics`, async () => {
      failAt = method === 'GET' ? 'read' : 'write'; throwFailure = thrown
      const response = await invoke(method)
      assert.equal(response.status, 500)
      const body = await response.json()
      assert.equal(JSON.stringify(body).includes(marker), false)
      assert.deepEqual(Object.keys(body), ['error'])
    })
  }
}
for (const thrown of [false, true]) {
  test(`autopilot lazy insertion sanitizes ${thrown ? 'thrown' : 'returned'} diagnostics`, async () => {
    absent = true; failAt = 'write'; throwFailure = thrown
    const response = await GET()
    assert.equal(response.status, 500)
    const body = await response.json()
    assert.equal(JSON.stringify(body).includes(marker), false)
    assert.deepEqual(Object.keys(body), ['error'])
  })
}
test('autopilot preserves saved configuration and user isolation', async () => {
  for (const user of [alice, bob]) {
    identity = user
    assert.deepEqual(await (await GET()).json(), { config: { user_id: user, enabled: true, default_platforms: ['youtube'] } })
  }
  assert.equal(writes.length, 0)
})
test('autopilot lazy defaults never enable publication', async () => {
  absent = true
  const response = await GET()
  assert.equal(response.status, 200)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].user_id, alice)
  assert.equal(writes[0].enabled, false)
  assert.deepEqual(writes[0].default_platforms, [])
})
test('autopilot deduplicates destinations in first-selected order', async () => {
  identity = bob
  const response = await invoke('POST', { enabled: false, default_platforms: ['youtube', 'x', 'youtube', 'x'], user_id: alice, private_field: marker })
  assert.equal(response.status, 200)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].user_id, bob)
  assert.deepEqual(writes[0].default_platforms, ['youtube', 'x'])
  assert.equal('private_field' in writes[0], false)
})
for (const body of [{}, { enabled: 'true' }, { enabled: false, default_platforms: ['unknown'] }, { enabled: false, max_hashtags: 31 }]) {
  test(`autopilot rejects invalid input ${JSON.stringify(body)}`, async () => {
    assert.equal((await invoke('POST', body)).status, 400)
    assert.equal(privileged, 0); assert.equal(writes.length, 0)
  })
}
