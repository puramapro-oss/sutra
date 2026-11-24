import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const alice = '12000000-0000-4000-8000-000000000001'
const bob = '12000000-0000-4000-8000-000000000002'
const marker = 'T01_SYNTHETIC_PRIVATE_AUTOCONFIG_DIAGNOSTIC'
let identity: string | null = alice
let expired = false, revoked = false, absent = false
let failAt = '', privileged = 0
let diagnostic: unknown = new Error(marker)
const writes: Array<Record<string, unknown>> = []
const server = {
  auth: { getUser: async () => {
    if (failAt === 'auth') throw diagnostic
    return { data: { user: identity ? { id: identity } : null }, error: expired ? new Error('expired') : null }
  } },
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({
      data: { id: identity, subscription_status: 'active', access_revoked_at: revoked ? '2026-01-01' : null }, error: null,
    }) }; return query
  },
}
const { enforceAccountAccess } = await import('../../src/lib/account-access.ts')
mock.module('../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => {
    if (failAt === 'auth') throw diagnostic
    return enforceAccountAccess({ ...server, auth: { ...server.auth } } as never)
  },
} })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  privileged++
  if (failAt === 'service') throw diagnostic
  return { from: (table: string) => {
    assert.equal(table, 'sutra_auto_config')
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { assert.equal(key, 'user_id'); assert.equal(value, identity); return query },
      maybeSingle: async () => {
        if (failAt === 'read') throw diagnostic
        return { data: absent ? null : { user_id: identity, is_active: false }, error: null }
      },
      insert: (row: Record<string, unknown>) => { assert.equal(row.user_id, identity); writes.push(row); return query },
      upsert: (row: Record<string, unknown>, options: unknown) => {
        assert.equal(row.user_id, identity); assert.deepEqual(options, { onConflict: 'user_id' }); writes.push(row); return query
      },
      single: async () => {
        if (failAt === 'write') throw diagnostic
        return { data: { ...writes.at(-1), is_active: writes.at(-1)?.is_active ?? false }, error: null }
      },
    }; return query
  } }
} } })
const { GET, PATCH } = await import('../../src/app/api/auto/config/route.ts')
const invoke = (method: string, body: unknown = { is_active: false }) => method === 'GET' ? GET() : PATCH(new Request('https://sutra.example.test/api/auto/config', {
  method: 'PATCH', body: JSON.stringify(body),
}))
beforeEach(() => { identity = alice; expired = revoked = absent = false; failAt = ''; privileged = 0; writes.length = 0; diagnostic = new Error(marker) })

for (const method of ['GET', 'PATCH']) {
  for (const state of ['anonymous', 'expired', 'revoked']) {
    test(`${method} rejects ${state} before privileged access`, async () => {
      if (state === 'anonymous') identity = null
      expired = state === 'expired'; revoked = state === 'revoked'
      assert.equal((await invoke(method)).status, 401); assert.equal(privileged, 0); assert.equal(writes.length, 0)
    })
  }
  for (const point of ['auth', 'service', method === 'GET' ? 'read' : 'write']) {
    for (const kind of ['Error', 'object']) {
      test(`${method} redacts ${kind} at ${point}`, async () => {
        failAt = point; diagnostic = kind === 'Error' ? new Error(marker) : { message: marker, details: marker }
        const response = await invoke(method)
        assert.equal(response.status, 500)
        assert.deepEqual(await response.json(), { error: method === 'GET' ? 'Erreur config' : 'Erreur mise a jour config' })
      })
    }
  }
}
test('two identities read only their own configuration', async () => {
  for (const user of [alice, bob]) { identity = user; assert.deepEqual(await (await GET()).json(), { config: { user_id: user, is_active: false } }) }
})
test('lazy configuration creation retains defaults and hides insertion diagnostics', async () => {
  absent = true
  assert.equal((await GET()).status, 200); assert.deepEqual(writes, [{ user_id: alice }])
  failAt = 'write'
  assert.deepEqual(await (await GET()).json(), { error: 'Erreur config' })
})
test('patch uses authenticated owner and accepted fields only', async () => {
  identity = bob
  const response = await invoke('PATCH', { user_id: alice, is_active: false, private_field: marker })
  assert.equal(response.status, 200)
  assert.deepEqual(writes, [{ user_id: bob, is_active: false }])
  assert.deepEqual(await response.json(), { config: { user_id: bob, is_active: false } })
})
test('unknown fields cannot trigger a write', async () => {
  assert.equal((await invoke('PATCH', { user_id: bob })).status, 400)
  assert.equal(privileged, 0); assert.equal(writes.length, 0)
})
