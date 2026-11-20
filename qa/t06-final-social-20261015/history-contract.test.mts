import test, { afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { socialDatabase, accountId, type Row } from '../../scripts/helpers/social-database.mts'
import type { SocialPlatform } from '../../src/lib/zernio.ts'

// Synthetic credentials only. Run with qa/t08/offline.cjs for socket and .env guards.
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NEXT_PUBLIC_APP_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SITE_URL: 'https://sutra-test.invalid', ZERNIO_API_KEY: 'fixture-zernio',
  ZERNIO_BASE_URL: 'https://zernio-test.invalid/api/v1',
})
const alice = '11111111-1111-4111-8111-111111111111'
const session = '22222222-2222-4222-8222-222222222222'
const profile = 'a'.repeat(24)
const localId = '33333333-3333-4333-8333-333333333333'
let userId: string | null = alice, sessionId = session, db = socialDatabase()
let states: Row[] = [], remoteAccounts: Row[] = []
const browser = new Map<string, string>()
type Call = { url: URL; method: string; headers: Headers; body?: string }
let calls: Call[] = []
let onIdentity: () => void = () => {}, deleteStatus = 200
let wireViolations: string[] = []

// Reuse the canonical publication fixture; bridge only OAuth's atomic state table
// and public.social_accounts' real (user_id, platform) unique insert contract.
const database = {
  schema: () => database,
  from(table: string): object {
    if (table !== 'social_oauth_states') {
      const client = db.client as unknown as { from: (name: string) => object }
      const builder = client.from(table)
      if (table !== 'social_accounts') return builder
      return new Proxy(builder, { get(target, key) {
        if (key !== 'insert') return Reflect.get(target, key)
        return (row: Row) => {
          const query = { select: () => query, maybeSingle: async () => {
            const old = db.accounts.find(a => a.user_id === row.user_id && a.platform === row.platform)
            if (old) return { data: null, error: { code: '23505' } }
            const created = { ...row, id: db.accounts.length ? '44444444-4444-4444-8444-444444444444' : localId }
            db.accounts.push(created as typeof db.accounts[number])
            return { data: { id: created.id }, error: null }
          } }
          return query
        }
      } })
    }
    const filters: Array<(row: Row) => boolean> = []
    let deleting = false
    const builder = {
      async insert(row: Row) { states.push(structuredClone(row)); return { error: null } },
      delete() { deleting = true; return builder },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return builder },
      gt(key: string, value: string) { filters.push(row => String(row[key]) > value); return builder },
      select() { return builder },
      async maybeSingle() {
        const matched = states.filter(row => filters.every(predicate => predicate(row)))
        assert.ok(matched.length <= 1)
        if (deleting) states = states.filter(row => !matched.includes(row))
        return { data: matched[0] ?? null, error: null }
      },
    }
    return builder
  },
}
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
  getClaims: async () => ({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }),
} }) } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => database } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => database } })
mock.module(createRequire(import.meta.url).resolve('@supabase/supabase-js'), { namedExports: { createClient: () => database } })
mock.module('../../src/lib/rate-limit.ts', { namedExports: { enforceRateLimit: () => null } })
mock.module('next/headers', { namedExports: { cookies: async () => ({
  get: (name: string) => browser.has(name) ? { value: browser.get(name) } : undefined,
  set: (name: string, value: string) => { browser.set(name, value) },
}) } })
globalThis.fetch = async () => { throw new Error('T06_UNEXPECTED_NETWORK') }
const { POST: connect } = await import('../../src/app/api/social/connect/route.ts')
const { GET: callback } = await import('../../src/app/api/social/callback/route.ts')
const { DELETE: revoke } = await import('../../src/app/api/social/accounts/route.ts')

beforeEach(() => {
  userId = alice; sessionId = session; db = socialDatabase()
  for (const rows of Object.values(db.tables)) for (const row of rows as Row[]) {
    if (row.user_id === 'u') row.user_id = alice
  }
  db.profile.id = alice; db.accounts.splice(0)
  states = []; remoteAccounts = []; browser.clear(); calls = []; onIdentity = () => {}; deleteStatus = 200; wireViolations = []
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: profile })
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    assert.equal(url.origin, 'https://zernio-test.invalid', 'All requests must stay in the synthetic transport')
    const call = { url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: init?.body as string | undefined }
    calls.push(call)
    assert.equal(call.headers.get('authorization'), 'Bearer fixture-zernio')
    if (call.method === 'GET' && url.pathname.startsWith('/api/v1/connect/')) {
      assert.ok(states.length >= 1, 'Persist local state before provider URL acquisition')
      assert.equal(url.searchParams.get('profileId'), profile)
      assert.equal(url.searchParams.get('scopes'), 'posting')
      assert.equal(init?.redirect, 'error'); assert.ok(init?.signal)
      return Response.json({ authUrl: 'https://consent.invalid/hosted', state: 'provider-state-must-not-replace-local-state' })
    }
    if (call.method === 'GET' && url.pathname === '/api/v1/accounts') {
      assert.equal(url.searchParams.get('profileId'), profile)
      onIdentity()
      return Response.json({ accounts: remoteAccounts })
    }
    if (call.method === 'DELETE' && url.pathname.startsWith('/api/v1/accounts/')) {
      assert.equal(db.accounts.find(a => a.external_id === url.pathname.split('/').at(-1))?.status, 'revoked')
      return Response.json({}, { status: deleteStatus })
    }
    assert.fail(`Unplanned fixture request: ${call.method} ${url.pathname}`)
  }
  globalThis.fetch = async (input, init) => {
    try { return await transport(input, init) } catch (error) {
      // Production correctly sanitizes transport errors. Never let that swallow
      // a failed harness assertion and accidentally turn a negative case green.
      if (error instanceof assert.AssertionError) wireViolations.push(error.message)
      throw error
    }
  }
})
afterEach(() => { assert.deepEqual(wireViolations, [], 'No swallowed transport assertion') })

async function begin(platform: SocialPlatform = 'youtube', extra = {}) {
  const previousStates = states.length
  const response = await connect(new Request('https://sutra-test.invalid/api/social/connect', {
    method: 'POST', body: JSON.stringify({ platform, ...extra }),
  }))
  if (response.status !== 200) return { response, callbackUrl: new URL('https://sutra-test.invalid/unused'), state: '' }
  assert.equal(states.length, previousStates + 1, 'Each new consent must persist its own bound state')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json() as { state: string; oauthUrl: string }
  assert.match(body.state, /^[a-f0-9]{64}$/)
  assert.equal(body.oauthUrl, 'https://consent.invalid/hosted')
  const cookie = response.headers.get('set-cookie')!
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/api/social', 'Max-Age=600']) assert.ok(cookie.includes(attribute))
  const [name, value] = cookie.split(';')[0].split('='); browser.set(name, value)
  const callbackUrl = new URL(calls.at(-1)!.url.searchParams.get('redirect_url')!)
  assert.equal(callbackUrl.pathname, '/api/social/callback'); assert.equal(callbackUrl.searchParams.get('state'), body.state)
  callbackUrl.searchParams.set('connected', platform === 'x' ? 'twitter' : platform)
  callbackUrl.searchParams.set('profileId', profile); callbackUrl.searchParams.set('accountId', accountId)
  return { response, callbackUrl, state: body.state }
}
async function consent(platform: SocialPlatform = 'youtube', externalId = accountId) {
  const started = await begin(platform); assert.equal(started.response.status, 200)
  remoteAccounts = [{ _id: externalId, platform: platform === 'x' ? 'twitter' : platform,
    profileId: { _id: profile }, isActive: true, username: 'synthetic-account', accessToken: 'must-not-store', refreshToken: 'must-not-store' }]
  started.callbackUrl.searchParams.set('accountId', externalId)
  const response = await callback(new Request(started.callbackUrl))
  assert.equal(response.headers.get('location'), `https://sutra-test.invalid/settings/social?connected=${platform}`)
  return response
}

const revokeRequest = () => new Request('https://sutra-test.invalid/api/social/accounts', { method: 'DELETE', body: JSON.stringify({ accountId: localId }) })
const deleteCalls = () => calls.filter(call => call.method === 'DELETE').length

// Deliberately separate from the fixed-delta gate: open requirement routed to
// T01 (atomic SQL persistence). This assertion is expected to expose the gap.
test('T06 HISTORY successive personal authorizations retain the earlier authorization', async () => {
  await consent()
  const firstRevision = db.accounts[0].metadata!.sutra_oauth_revision as string
  assert.equal((await revoke(revokeRequest())).status, 200)
  await consent()
  assert.equal(deleteCalls(), 1); assert.equal(db.accounts.length, 1); assert.equal(states.length, 0)
  const stored = JSON.stringify({ tables: db.tables, states })
  assert.ok(stored.includes(firstRevision), 'First authorization is lost after reconnect: only current account revision remains')
})
