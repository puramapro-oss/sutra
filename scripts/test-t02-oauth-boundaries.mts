import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service'
process.env.NEXT_PUBLIC_SITE_URL = 'https://sutra-test.invalid'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

type Row = Record<string, unknown>
const sensitive = 'synthetic-private-diagnostic'
const profileId = 'a'.repeat(24)
const binding = { profileId, sessionId: '11111111-1111-4111-8111-111111111111' }
let sessionId = binding.sessionId
let userId: string | null = 'alice', dbFailure = '', providerFailure = false
let reads = 0, exchanges = 0, writes = 0
let states: Row[] = [], accounts: Row[] = []
const browser = new Map<string, string>()

// Relational fixture exercises the real route + real atomic state consumer.
const database = { schema: () => database, from(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let columns = '', deleting = false
  let mutation: Row | undefined
  const rows = () => table === 'social_oauth_states' ? states : accounts
  const read = () => {
    reads++
    if (dbFailure === 'throw') throw new Error(sensitive)
    if (dbFailure === 'error') return { data: null, error: { message: sensitive } }
    const matching = rows().filter(row => filters.every(filter => filter(row)))
    if (deleting) states = states.filter(row => !matching.includes(row))
    if (mutation) { for (const row of matching) { Object.assign(row, mutation); writes++ } }
    const selected = columns.split(',').map(column => column.trim())
    return { data: matching.map(row => Object.fromEntries(selected.map(column => [column, row[column]]))), error: null }
  }
  const query = {
    select(value: string) { columns = value; return query },
    eq(key: string, value: unknown) {
      filters.push(row => isDeepStrictEqual(row[key], key === 'metadata' && typeof value === 'string' ? JSON.parse(value) : value))
      return query
    },
    is(key: string, value: unknown) { filters.push(row => (row[key] ?? null) === value); return query },
    gt(key: string, value: string) { filters.push(row => String(row[key]) > value); return query },
    delete() { deleting = true; return query },
    update(row: Row) { mutation = row; return query },
    async insert(row: Row) { states.push({ ...row }); return { error: null } },
    async upsert(row: Row) { writes++; accounts.push({ ...row }); return { error: null } },
    async maybeSingle() { const result = read(); return { ...result, data: result.data?.[0] ?? null } },
    async order() { return read() },
  }
  assert.ok(['social_oauth_states', 'social_accounts'].includes(table))
  return query
} }
mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }), getClaims: async () => ({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }) } }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => database } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => database } })
// tsx compiles app .ts files as CJS; Supabase exposes different require/import entries.
mock.module(createRequire(import.meta.url).resolve('@supabase/supabase-js'), { namedExports: { createClient: () => database } })
mock.module('next/headers', { namedExports: { cookies: async () => ({
  get: (name: string) => browser.has(name) ? { value: browser.get(name) } : undefined,
  set: (name: string, value: string) => { browser.set(name, value) },
}) } })
mock.module('../src/lib/zernio.ts', { namedExports: {
  OAUTH_PLATFORMS: ['youtube', 'instagram', 'x'],
  getAuthorizedProfileId: (user: string) => user === 'alice' ? profileId : 'b'.repeat(24),
  getConnectedAccount: async () => {
    exchanges++
    if (providerFailure) throw new Error(sensitive)
    return { externalId: '66b2e19d8c3f5a7e9d0b1c2d', username: 'fixture', accessToken: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token' }
  },
  disconnectAccount: async () => { throw new Error('UNEXPECTED_REMOTE_REVOKE') },
} })
const { GET: listAccounts } = await import('../src/app/api/social/accounts/route.ts')
const { GET: callback } = await import('../src/app/api/social/callback/route.ts')
const { issueSocialOAuthState, socialOAuthCookieName } = await import('../src/lib/social-oauth-state.ts')

beforeEach(() => {
  userId = 'alice'; sessionId = binding.sessionId; dbFailure = ''; providerFailure = false
  reads = 0; exchanges = 0; writes = 0; states = []; browser.clear()
  accounts = ['alice', 'bob'].map(user_id => ({ id: user_id, user_id, platform: 'youtube', username: user_id,
    status: 'connected', metadata: { privateDiagnostic: sensitive }, access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token' }))
})
const state = 'synthetic-provider-state-0123456789'
async function begin() {
  const secret = await issueSocialOAuthState('alice', 'youtube', state, binding)
  browser.set(socialOAuthCookieName(state), secret)
  reads = 0 // assertions below count callback reads, after issuing its account-bound state
}
function request(platform = 'youtube') {
  return new Request(`https://sutra-test.invalid/api/social/callback?connected=${platform}&profileId=${profileId}&accountId=${'b'.repeat(24)}&state=${state}&platform=${platform}`)
}
function assertRejected(response: Response, reason: string) {
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), `https://sutra-test.invalid/settings/social?error=${reason}`)
  assert.equal(exchanges, 0); assert.equal(writes, 0)
}

test('T02 account list omits private metadata/tokens and another user account', async () => {
  const response = await listAccounts()
  assert.equal(response.status, 200)
  const body = await response.text()
  assert.doesNotMatch(body, /synthetic-private-diagnostic|synthetic-access-token|synthetic-refresh-token|metadata|bob/)
  assert.equal(JSON.parse(body).accounts[0].username, 'alice')
})
for (const failure of ['error', 'throw']) {
  test(`T02 account list redacts ${failure} diagnostics`, async () => {
    dbFailure = failure
    const response = await listAccounts()
    assert.equal(response.status, 500)
    assert.doesNotMatch(await response.text(), /synthetic-private-diagnostic|details/)
  })
}
test('T02 anonymous account list does not reach the privileged database', async () => {
  userId = null
  assert.equal((await listAccounts()).status, 401); assert.equal(reads, 0)
})
test('T02 callback without verified session never consumes or exchanges state', async () => {
  await begin(); userId = null
  assertRejected(await callback(request()), 'session_required')
  assert.equal(states.length, 1); assert.equal(reads, 0)
})
test('T02 callback rejects a different user without burning the owner state', async () => {
  await begin(); userId = 'bob'
  assertRejected(await callback(request()), 'invalid_or_expired_state')
  assert.equal(states.length, 1)
  userId = 'alice'
  assert.equal((await callback(request())).headers.get('location'), 'https://sutra-test.invalid/settings/social?connected=youtube')
  assert.equal(exchanges, 1); assert.equal(writes, 1)
})
test('T02 callback rejects a platform switch', async () => {
  await begin()
  assertRejected(await callback(request('instagram')), 'invalid_or_expired_state')
  assert.equal(states.length, 1)
})
test('T02 callback rejects a missing or forged browser secret', async () => {
  await begin(); browser.clear()
  assertRejected(await callback(request()), 'invalid_or_expired_state')
  browser.set(socialOAuthCookieName(state), '0'.repeat(64))
  assertRejected(await callback(request()), 'invalid_or_expired_state')
  assert.equal(states.length, 1)
})
test('T02 callback rejects an expired state before token exchange', async () => {
  await begin(); states[0].expires_at = '2000-01-01T00:00:00Z'
  assertRejected(await callback(request()), 'invalid_or_expired_state')
})
test('T02 concurrent callbacks verify only once and never store or expose tokens', async () => {
  await begin()
  const responses = await Promise.all([callback(request()), callback(request())])
  const locations = responses.map(response => response.headers.get('location'))
  assert.equal(locations.filter(location => location?.includes('connected=youtube')).length, 1)
  assert.equal(locations.filter(location => location?.includes('invalid_or_expired_state')).length, 1)
  assert.equal(exchanges, 1); assert.equal(writes, 1); assert.equal(states.length, 0)
  assert.equal(browser.get(socialOAuthCookieName(state)), '')
  assert.doesNotMatch(JSON.stringify(locations), /synthetic-access-token|synthetic-refresh-token/)
  assert.equal(accounts.find(row => row.user_id === 'alice')?.access_token, null)
  assert.equal(accounts.find(row => row.user_id === 'alice')?.refresh_token, null)
  assert.equal(accounts.find(row => row.user_id === 'bob')?.access_token, 'synthetic-access-token')
})
test('T02 database outage during callback cannot authorize an exchange', async () => {
  await begin(); dbFailure = 'error'
  assertRejected(await callback(request()), 'oauth_failed')
  assert.equal(states.length, 1)
})
test('T02 uncertain exchange is sanitized and consumed state cannot be replayed', async () => {
  await begin(); providerFailure = true
  const response = await callback(request())
  assert.equal(response.headers.get('location'), 'https://sutra-test.invalid/settings/social?error=oauth_failed')
  assert.equal(exchanges, 1); assert.equal(writes, 0); assert.equal(states.length, 0)
  await callback(request()); assert.equal(exchanges, 1)
})

test('T02 callback from another login session cannot consume the current state', async () => {
  await begin(); sessionId = '22222222-2222-4222-8222-222222222222'
  assertRejected(await callback(request()), 'invalid_or_expired_state'); assert.equal(states.length, 1)
})
test('T02 callback cannot change server profile or use an unrelated provider account without verification', async () => {
  await begin()
  const url = new URL(request().url); url.searchParams.set('profileId', 'c'.repeat(24))
  assertRejected(await callback(new Request(url)), 'invalid_or_expired_state'); assert.equal(states.length, 1)
})
