// Exercise the real export handler and account guard; only Supabase is synthetic.
import assert from 'node:assert/strict'
import test, { beforeEach, mock } from 'node:test'
import { enforceAccountAccess } from '../../src/lib/account-access.ts'

const alice = '12000000-0000-4000-8000-000000000001'
const bob = '12000000-0000-4000-8000-000000000002'
let identity: string | null = alice
let state = 'active'
let exportReads = 0
const tables = ['profiles', 'legal_acceptances', 'cookie_consents', 'video_generations', 'subscriptions', 'conversations']
const rows = (table: string) => [alice, bob].map(id => table === 'profiles'
  ? { id, email: `${id}@example.invalid`, subscription_status: state === 'banned' ? 'banned' : 'active',
      access_revoked_at: state === 'revoked' ? '2026-01-01' : null }
  : { user_id: id, marker: `private-${id}`, doc_type: 'cgu', version: 'fixture', accepted_at: '2026-01-01' })
const raw = {
  auth: { getUser: async () => ({
    // Supabase _getUser returns a null user when the session is expired.
    data: { user: identity && state !== 'expired' ? { id: identity, email: `${identity}@example.invalid`, created_at: '2026-01-01' } : null },
    error: state === 'expired' ? new Error('synthetic-session-expired') : null,
  }) },
  from: (table: string) => {
    assert.ok(tables.includes(table))
    let columns = ''
    const filters: Array<[string, unknown]> = []
    const execute = (single: boolean) => {
      const isAccountGuard = columns === 'id, subscription_status, access_revoked_at'
      if (isAccountGuard && state === 'profile-error') return { data: null, error: new Error('PRIVATE_BACKEND_MARKER') }
      if (!isAccountGuard) exportReads++
      const data = rows(table).filter(row => filters.every(([column, value]) => row[column as keyof typeof row] === value))
      return { data: single ? data[0] ?? null : data, error: null }
    }
    const query = {
      select: (value: string) => { columns = value; return query },
      eq: (column: string, value: unknown) => { filters.push([column, value]); return query },
      maybeSingle: async () => execute(true),
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute(false)).then(resolve),
    }
    return query
  },
}
const guarded = enforceAccountAccess(raw as never)
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => guarded } })
const { GET } = await import('../../src/app/api/legal/my-data/route.ts')
beforeEach(() => { identity = alice; state = 'active'; exportReads = 0 })

for (const denied of ['anonymous', 'expired', 'banned', 'revoked', 'profile-error']) {
  test(`export rejects ${denied} before reading personal data`, async () => {
    state = denied
    if (denied === 'anonymous') identity = null
    const response = await GET()
    assert.equal(response.status, 401)
    assert.equal(exportReads, 0)
    assert.deepEqual(await response.json(), { error: 'Connexion requise.' })
  })
}

for (const owner of [alice, bob]) {
  test(`export scopes all six tables to verified user ${owner.slice(-1)} despite forged URL owner`, async () => {
    identity = owner
    const other = owner === alice ? bob : alice
    const response = await Reflect.apply(GET, undefined, [
      new Request(`https://sutra.example.invalid/api/legal/my-data?user_id=${other}&id=${other}`),
    ])
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/json')
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="mes-donnees.json"')
    const body = await response.text(), data = JSON.parse(body)
    assert.equal(data.compte.id, owner)
    assert.equal(data.profile.id, owner)
    assert.equal(data.consentementCookies.user_id, owner)
    for (const key of ['acceptationsLegales', 'video_generations', 'subscriptions', 'conversations']) {
      assert.equal(data[key].length, 1)
      assert.equal(data[key][0].user_id, owner)
    }
    assert.ok(!body.includes(other), 'no cross-account data in exported response')
    assert.equal(exportReads, 6)
  })
}

test('revoking the same session between two exports immediately prevents further reads', async () => {
  assert.equal((await GET()).status, 200)
  exportReads = 0; state = 'revoked'
  assert.equal((await GET()).status, 401)
  assert.equal(exportReads, 0)
})
