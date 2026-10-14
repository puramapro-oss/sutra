import test, { afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { socialDatabase, accountId, secondAccount, postId, type Row } from './helpers/social-database.mts'
import type { SocialPlatform } from '../src/lib/zernio.ts'

// Synthetic credentials only. Run with qa/t08/offline.cjs for socket and .env guards.
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NEXT_PUBLIC_APP_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SITE_URL: 'https://sutra-test.invalid', ZERNIO_API_KEY: 'fixture-zernio',
  ZERNIO_BASE_URL: 'https://zernio-test.invalid/api/v1',
})
// tsx's JSX-preserve execution needs React for unbundled component SSR.
Object.assign(globalThis, { React })
const alice = '11111111-1111-4111-8111-111111111111'
const session = '22222222-2222-4222-8222-222222222222'
const profile = 'a'.repeat(24)
const localId = '33333333-3333-4333-8333-333333333333'
let userId: string | null = alice, sessionId = session, db = socialDatabase(), now = Date.now()
let states: Row[] = [], remoteAccounts: Row[] = []
const browser = new Map<string, string>()
type Call = { url: URL; method: string; headers: Headers; body?: string }
let calls: Call[] = [], posts: Call[] = []
let publicationStatus = 'published', loseResponse = false, deleteStatus = 200, wrongRemoteAccount = false
let lastPost: Record<string, unknown> | undefined
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
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
  getClaims: async () => ({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }),
} }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => database } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => database } })
mock.module(createRequire(import.meta.url).resolve('@supabase/supabase-js'), { namedExports: { createClient: () => database } })
mock.module('../src/lib/rate-limit.ts', { namedExports: { enforceRateLimit: () => null } })
mock.module('next/headers', { namedExports: { cookies: async () => ({
  get: (name: string) => browser.has(name) ? { value: browser.get(name) } : undefined,
  set: (name: string, value: string) => { browser.set(name, value) },
}) } })
globalThis.fetch = async () => { throw new Error('T06_UNEXPECTED_NETWORK') }
const { POST: connect } = await import('../src/app/api/social/connect/route.ts')
const { GET: callback } = await import('../src/app/api/social/callback/route.ts')
const { GET: listAccounts, DELETE: revoke } = await import('../src/app/api/social/accounts/route.ts')
const { OAUTH_PLATFORMS } = await import('../src/lib/zernio.ts')
const { publishVideoRecord } = await import('../src/lib/social-publication.ts')
const { publishAutoVideoRecord } = await import('../src/lib/auto-publication.ts')
const { PlatformGrid } = await import('../src/components/settings/social/PlatformGrid.tsx')

beforeEach(() => {
  userId = alice; sessionId = session; now = Date.now(); db = socialDatabase()
  for (const rows of Object.values(db.tables)) for (const row of rows as Row[]) {
    if (row.user_id === 'u') row.user_id = alice
  }
  db.profile.id = alice; db.accounts.splice(0)
  states = []; remoteAccounts = []; browser.clear(); calls = []; posts = []
  publicationStatus = 'published'; loseResponse = false; deleteStatus = 200; wrongRemoteAccount = false; lastPost = undefined; wireViolations = []
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
      return Response.json({ accounts: remoteAccounts })
    }
    if (call.method === 'DELETE' && url.pathname.startsWith('/api/v1/accounts/')) {
      assert.equal(db.accounts.find(a => a.external_id === url.pathname.split('/').at(-1))?.status, 'revoked')
      return Response.json({}, { status: deleteStatus })
    }
    if (call.method === 'POST' && url.pathname === '/api/v1/posts') {
      posts.push(call)
      assert.ok(call.headers.get('Idempotency-Key'))
      const payload = JSON.parse(call.body!) as { platforms: Row[] }
      assert.ok(db.tables.social_publication_journals[0]?.operations.length, 'Persist intent before HTTP')
      lastPost = { _id: postId, status: publicationStatus, platforms: payload.platforms.map(target => ({ ...target, status: publicationStatus })) }
      if (loseResponse) throw new Error('synthetic-response-lost')
      return Response.json({ post: lastPost })
    }
    if (call.method === 'GET' && url.pathname === `/api/v1/posts/${postId}`) {
      assert.ok(lastPost)
      const targets = lastPost.platforms as Row[]
      return Response.json({ post: { ...lastPost, platforms: targets.map(target => ({ ...target,
        status: publicationStatus, ...(wrongRemoteAccount ? { accountId: secondAccount } : {}),
      })) } })
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
const publish = (extra = {}) => publishVideoRecord(alice, { videoId: 'v', platforms: ['youtube'], autoCaption: false, ...extra }, db.client, undefined, undefined, { now: () => now })
const revokeRequest = () => new Request('https://sutra-test.invalid/api/social/accounts', { method: 'DELETE', body: JSON.stringify({ accountId: localId }) })

for (const platform of OAUTH_PLATFORMS) test(`T06-FINAL OAuth route + adapter + atomic state: ${platform}`, async () => {
  await consent(platform)
  assert.equal(calls[0].url.pathname, `/api/v1/connect/${platform === 'x' ? 'twitter' : platform}`)
  assert.equal(calls.length, 2); assert.equal(states.length, 0)
  const row = db.accounts[0] as unknown as Row
  assert.equal(row.status, 'connected'); assert.equal(row.external_id, accountId)
  assert.equal(row.access_token, null); assert.equal(row.refresh_token, null); assert.equal(row.token_expires_at, null)
  const metadata = row.metadata as Row
  assert.equal(metadata.zernio_profile_id, profile); assert.equal(metadata.credential_owner, 'zernio')
  assert.match(String(metadata.sutra_oauth_revision), /^[a-f0-9-]{36}$/)
  assert.doesNotMatch(JSON.stringify(db.accounts), /must-not-store/)
})

test('T06-FINAL profile binding absent and caller-supplied organisation never reach provider', async () => {
  process.env.ZERNIO_PROFILE_BINDINGS = '{}'
  assert.equal((await begin()).response.status, 503)
  assert.equal((await begin('youtube', { profileId: profile, organisation: 'synthetic' })).response.status, 400)
  assert.equal(calls.length, 0); assert.equal(states.length, 0)
})
test('T06-FINAL session rotation during hosted consent requires fresh state', async () => {
  const started = await begin(); sessionId = '55555555-5555-4555-8555-555555555555'
  const response = await callback(new Request(started.callbackUrl))
  assert.match(response.headers.get('location')!, /invalid_or_expired_state$/)
  assert.equal(calls.length, 1); assert.equal(states.length, 1); assert.equal(db.accounts.length, 0)
})
test('T06-FINAL expired hosted consent never reaches identity lookup', async () => {
  const started = await begin(); states[0].expires_at = '2000-01-01T00:00:00Z'
  const response = await callback(new Request(started.callbackUrl))
  assert.match(response.headers.get('location')!, /invalid_or_expired_state$/)
  assert.equal(calls.length, 1); assert.equal(db.accounts.length, 0)
})
test('T06-FINAL atomic duplicate callback invokes real identity adapter only once', async () => {
  const started = await begin()
  remoteAccounts = [{ _id: accountId, platform: 'youtube', profileId: profile, isActive: true, username: 'synthetic' }]
  const results = await Promise.all([callback(new Request(started.callbackUrl)), callback(new Request(started.callbackUrl))])
  assert.equal(results.filter(r => r.headers.get('location')?.endsWith('connected=youtube')).length, 1)
  assert.equal(calls.filter(c => c.url.pathname === '/api/v1/accounts').length, 1)
  assert.equal(db.accounts.length, 1); assert.equal(states.length, 0)
})
test('T06-FINAL forged remote profile is rejected after real state consumption, never persisted', async () => {
  const started = await begin()
  remoteAccounts = [{ _id: accountId, platform: 'youtube', profileId: 'b'.repeat(24), isActive: true, username: 'synthetic' }]
  assert.match((await callback(new Request(started.callbackUrl))).headers.get('location')!, /oauth_failed$/)
  assert.equal(states.length, 0); assert.equal(db.accounts.length, 0)
  await callback(new Request(started.callbackUrl))
  assert.equal(calls.length, 2)
})
test('T06-FINAL lost POST response uses identical persisted wire request, then GET only', async () => {
  await consent(); loseResponse = true
  assert.equal((await publish()).status, 'publishing')
  await publish(); assert.equal(posts.length, 1, 'No replay before lease expiration')
  now += 120001; loseResponse = false; publicationStatus = 'publishing'
  await publish({ caption: 'must-not-change-original-wire-body' })
  assert.equal(posts.length, 2)
  assert.equal(posts[0].body, posts[1].body)
  assert.equal(posts[0].headers.get('Idempotency-Key'), posts[1].headers.get('Idempotency-Key'))
  publicationStatus = 'published'
  assert.equal((await publish()).status, 'published')
  await publish(); assert.equal(posts.length, 2); assert.equal(db.tables.social_posts.length, 1)
  assert.equal(calls.filter(c => c.method === 'GET' && c.url.pathname.includes('/posts/')).length, 1)
})
test('T06-FINAL missing account preserves partial outcome; next consent sends only missing destination', async () => {
  await consent()
  assert.equal((await publish({ platforms: ['youtube', 'instagram'] })).status, 'partially_published')
  await consent('instagram', secondAccount)
  assert.equal((await publish({ platforms: ['youtube', 'instagram'] })).status, 'published')
  assert.deepEqual(posts.map(p => JSON.parse(p.body!).platforms), [
    [{ platform: 'youtube', accountId }], [{ platform: 'instagram', accountId: secondAccount }],
  ])
  assert.equal(db.tables.social_posts.length, 2)
})
test('T06-FINAL reconnect replaces local identity but requires explicit new account selection', async () => {
  await consent(); await publish(); await consent('youtube', secondAccount)
  assert.equal(db.accounts[0].id, localId)
  const ambiguous = await publish()
  assert.equal(ambiguous.success, false); assert.match(JSON.stringify(ambiguous), /ACCOUNT_CHANGED_SELECTION_REQUIRED/)
  assert.equal(posts.length, 1)
  await publish({ accountIds: { youtube: localId } }); await publish({ accountIds: { youtube: localId } })
  assert.equal(posts.length, 2)
  assert.notEqual(posts[0].headers.get('Idempotency-Key'), posts[1].headers.get('Idempotency-Key'))
  assert.deepEqual(db.tables.social_posts.map(r => (r.metadata as Row).account_id), [accountId, secondAccount])
})
test('T06-FINAL separate productions on same account receive distinct keys and histories', async () => {
  await consent(); await publish()
  db.tables.videos.push({ ...structuredClone(db.video), id: 'v2', status: 'ready', publish_data: null })
  await publish({ videoId: 'v2' }); await publish({ videoId: 'v2' }); await publish()
  assert.equal(posts.length, 2)
  assert.notEqual(posts[0].headers.get('Idempotency-Key'), posts[1].headers.get('Idempotency-Key'))
  assert.equal(db.tables.social_posts.length, 2)
  assert.equal(new Set(db.tables.social_posts.map(r => r.id)).size, 2)
})
test('T06-FINAL another session user cannot revoke the bound account', async () => {
  await consent(); userId = '66666666-6666-4666-8666-666666666666'
  assert.equal((await revoke(revokeRequest())).status, 404)
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 0)
  assert.equal(db.accounts[0].status, 'connected')
})
test('T06-FINAL DELETE 503 retains history, returns 202, and blocks uncertain POST replay', async () => {
  await consent(); loseResponse = true; await publish(); const history = structuredClone(db.tables.social_posts)
  deleteStatus = 503
  const response = await revoke(revokeRequest())
  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { success: false, status: 'revoked', remoteStatus: 'unconfirmed' })
  assert.equal(calls.filter(c => c.method === 'DELETE').length, 1, 'No blind DELETE retry')
  assert.deepEqual(db.tables.social_posts, history)
  now += 120001; await publish(); assert.equal(posts.length, 1)
})
test('T06-FINAL revoked account allows remote GET reconciliation with autonomy disabled', async () => {
  await consent(); db.config.publish_platforms = ['youtube']; publicationStatus = 'publishing'
  await publishAutoVideoRecord(alice, 'v', false, db.client)
  assert.equal((await revoke(revokeRequest())).status, 200); db.config.is_active = false
  publicationStatus = 'published'
  const result = await publishAutoVideoRecord(alice, 'v', false, db.client, undefined, {}, true)
  assert.equal(result.status, 'published'); assert.equal(posts.length, 1)
  assert.equal(calls.filter(c => c.url.pathname.includes('/posts/') && c.method === 'GET').length, 1)
})
test('T06-FINAL wrong remote account cannot confirm or retry a known post', async () => {
  await consent(); publicationStatus = 'publishing'; await publish()
  publicationStatus = 'published'; wrongRemoteAccount = true
  const result = await publish()
  assert.equal(result.success, false); assert.equal(result.status, 'publishing')
  assert.equal(posts.length, 1); assert.equal(calls.filter(c => c.method === 'POST').length, 1)
})
test('T06-FINAL revoked during claim never reaches real POST adapter', async () => {
  await consent()
  db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.length) db.accounts[0].status = 'revoked'
  }
  assert.equal((await publish()).success, false); assert.equal(posts.length, 0)
})
test('T06-FINAL unverified media and missing approval never reach real POST adapter', async () => {
  await consent(); db.video.shotstack_json = null
  await assert.rejects(() => publish(), /MEDIA_VERIFICATION_REQUIRED/)
  db.config.require_approval_before_publish = true
  await assert.rejects(() => publishAutoVideoRecord(alice, 'v', false, db.client), /SUTRA_AUTO_PUBLICATION_NOT_AUTHORIZED/)
  assert.equal(posts.length, 0)
})

test('T06-FINAL UI regression: a revoked account must expose Se connecter again', async () => {
  await consent(); await revoke(revokeRequest())
  const response = await listAccounts()
  const { accounts } = await response.json() as { accounts: Array<{
    id: string; platform: SocialPlatform; username: string; display_name: string;
    avatar_url: string | null; status: string; connected_at: string;
  }> }
  assert.equal(accounts[0].status, 'revoked')
  const html = renderToStaticMarkup(React.createElement(PlatformGrid, {
    loading: false, accountsByPlatform: { youtube: accounts[0] }, connecting: null,
    disconnectingId: null, onConnect: () => {}, onDisconnectClick: () => {},
  }))
  assert.ok(html.includes('data-testid="connect-youtube"'), 'Revoked row retained for history hides Se connecter; PlatformGrid incorrectly treats row existence as connected')
})


test('T06-DELTA denied consent consumes the bound state even without account identity', async () => {
  const started = await begin()
  const denied = new URL(started.callbackUrl)
  denied.searchParams.set('error', 'access_denied')
  for (const key of ['connected', 'accountId', 'profileId']) denied.searchParams.delete(key)
  assert.equal((await callback(new Request(denied))).headers.get('location'), 'https://sutra-test.invalid/settings/social?error=oauth_denied')
  assert.equal(states.length, 0, 'A denied callback must terminate its one-use state')
  assert.ok([...browser.values()].every(value => value === ''))
  remoteAccounts = [{ _id: accountId, platform: 'youtube', profileId: profile, isActive: true, username: 'fixture' }]
  assert.equal((await callback(new Request(started.callbackUrl))).headers.get('location'), 'https://sutra-test.invalid/settings/social?error=invalid_or_expired_state')
  assert.equal(db.accounts.length, 0)
  assert.equal(calls.filter(c => c.url.pathname === '/api/v1/accounts').length, 0)
})

test('T06-DELTA a forged denial cannot consume another session state', async () => {
  const started = await begin()
  started.callbackUrl.searchParams.set('error', 'access_denied')
  sessionId = '77777777-7777-4777-8777-777777777777'
  assert.equal((await callback(new Request(started.callbackUrl))).headers.get('location'), 'https://sutra-test.invalid/settings/social?error=invalid_or_expired_state')
  assert.equal(states.length, 1)
  assert.equal(db.accounts.length, 0)
})


test('T06-DELTA consent issued before revocation must not reconnect the revoked account', async () => {
  await consent()
  const pending = await begin()
  assert.equal((await revoke(revokeRequest())).status, 200)
  assert.equal(db.accounts[0].status, 'revoked')
  const response = await callback(new Request(pending.callbackUrl))
  assert.ok(!response.headers.get('location')?.includes('connected=youtube'), 'Old consent must not undo a later revocation')
  assert.equal(db.accounts[0].status, 'revoked')
})

test('T06-DELTA revocation while identity lookup is in flight must win over callback', async () => {
  await consent()
  const pending = await begin()
  const transport = globalThis.fetch
  let release!: () => void
  let reached!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  const waiting = new Promise<void>(resolve => { reached = resolve })
  globalThis.fetch = async (input, init) => {
    const response = await transport(input, init)
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.pathname === '/api/v1/accounts') { reached(); await hold }
    return response
  }
  const returning = callback(new Request(pending.callbackUrl))
  await waiting
  try {
    assert.equal((await revoke(revokeRequest())).status, 200)
    assert.equal(db.accounts[0].status, 'revoked')
  } finally { release() }
  const response = await returning
  assert.ok(!response.headers.get('location')?.includes('connected=youtube'), 'Provider lookup started before revocation cannot restore publication permission')
  assert.equal(db.accounts[0].status, 'revoked')
})


test('T06-DELTA X denial accepts the documented provider platform alias and consumes state', async () => {
  const started = await begin('x')
  const denied = new URL(started.callbackUrl)
  denied.searchParams.set('platform', 'twitter'); denied.searchParams.set('error', 'oauth_denied')
  for (const key of ['connected', 'accountId', 'profileId']) denied.searchParams.delete(key)
  assert.equal((await callback(new Request(denied))).headers.get('location'), 'https://sutra-test.invalid/settings/social?error=oauth_denied')
  assert.equal(states.length, 0); assert.equal(db.accounts.length, 0)
})

test('T06-DELTA unknown provider error remains generic and still consumes state', async () => {
  const started = await begin()
  started.callbackUrl.searchParams.set('error', 'future_error_private_diagnostic')
  assert.equal((await callback(new Request(started.callbackUrl))).headers.get('location'), 'https://sutra-test.invalid/settings/social?error=oauth_failed')
  assert.equal(states.length, 0); assert.equal(db.accounts.length, 0)
})


test('T06-DELTA fresh consent after completed revoke can reconnect without reviving old state', async () => {
  await consent()
  const old = await begin()
  await revoke(revokeRequest())
  await consent('youtube', secondAccount)
  assert.equal(db.accounts[0].external_id, secondAccount)
  assert.equal(db.accounts[0].status, 'connected')
  const response = await callback(new Request(old.callbackUrl))
  assert.match(response.headers.get('location')!, /invalid_or_expired_state$/)
  assert.equal(db.accounts[0].external_id, secondAccount)
})

test('T06-DELTA concurrent revoke sends one DELETE and blocks new consent until completion', async () => {
  await consent()
  const transport = globalThis.fetch
  let release!: () => void
  let reached!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  const waiting = new Promise<void>(resolve => { reached = resolve })
  globalThis.fetch = async (input, init) => {
    const response = await transport(input, init)
    if (init?.method === 'DELETE') { reached(); await hold }
    return response
  }
  const first = revoke(revokeRequest())
  await waiting
  try {
    const second = await revoke(revokeRequest())
    assert.equal(second.status, 202)
    assert.equal(calls.filter(c => c.method === 'DELETE').length, 1)
    const blocked = await begin()
    assert.equal(blocked.response.status, 409)
    assert.match((await blocked.response.json() as { error: string }).error, /[Dd]éconnexion/)
    assert.equal(states.length, 0)
    assert.equal(calls.filter(c => c.url.pathname.startsWith('/api/v1/connect')).length, 1)
  } finally { release(); await first }
  assert.equal((db.accounts[0] as unknown as Row).metadata && ((db.accounts[0] as unknown as Row).metadata as Row).sutra_revocation_pending, false)
  await consent()
})

test('T06-DELTA two initial consent callbacks cannot overwrite the winning account', async () => {
  const a = await begin(), b = await begin()
  b.callbackUrl.searchParams.set('accountId', secondAccount)
  remoteAccounts = [accountId, secondAccount].map(_id => ({ _id, platform: 'youtube', profileId: profile, isActive: true, username: 'synthetic' }))
  const responses = await Promise.all([callback(new Request(a.callbackUrl)), callback(new Request(b.callbackUrl))])
  assert.equal(responses.filter(r => r.headers.get('location')?.includes('connected=youtube')).length, 1)
  assert.equal(db.accounts.length, 1)
  const winner = db.accounts[0].external_id
  await callback(new Request(a.callbackUrl)); await callback(new Request(b.callbackUrl))
  assert.equal(db.accounts[0].external_id, winner)
})

test('T06-DELTA account snapshot read error fails closed before state consumption or provider GET', async () => {
  const started = await begin()
  db.settings.failRead = true
  const response = await callback(new Request(started.callbackUrl))
  assert.match(response.headers.get('location')!, /oauth_failed$/)
  assert.equal(states.length, 1); assert.equal(db.accounts.length, 0)
  assert.equal(calls.length, 1)
})

test('T06-DELTA interrupted revoke retains a fence and cannot silently reconnect or publish', async () => {
  await consent()
  const account = db.accounts[0] as unknown as Row
  account.status = 'revoked'
  account.metadata = { ...(account.metadata as Row), sutra_revocation_pending: true }
  assert.equal((await begin()).response.status, 409)
  assert.equal((await revoke(revokeRequest())).status, 202)
  assert.equal((await publish()).success, false)
  assert.equal(calls.filter(c => c.method === 'DELETE' || c.method === 'POST').length, 0)
})

for (const failure of ['timeout', '503'] as const) test(`T06-DELTA unconfirmed DELETE ${failure} keeps the reconnect fence against a late remote revoke`, async () => {
  await consent()
  const transport = globalThis.fetch
  let lateRemoteRevoke!: () => void
  let remotelyRevoked = false
  globalThis.fetch = async (input, init) => {
    if (init?.method === 'DELETE') {
      lateRemoteRevoke = () => { remotelyRevoked = true }
      if (failure === 'timeout') {
        // The remote operation may still finish after the caller loses its response.
        throw new DOMException('synthetic-timeout', 'TimeoutError')
      }
      deleteStatus = 503
    }
    return transport(input, init)
  }
  assert.equal((await revoke(revokeRequest())).status, 202)
  assert.equal(remotelyRevoked, false)
  const before = calls.length
  assert.equal((await begin()).response.status, 409, 'Unknown DELETE outcome cannot authorize a replacement consent')
  assert.equal((await revoke(revokeRequest())).status, 202)
  assert.equal(calls.length, before, 'No new connect or blind DELETE while remote result is unknown')
  assert.equal(((db.accounts[0] as unknown as Row).metadata as Row).sutra_revocation_pending, true)
  lateRemoteRevoke()
  assert.equal((await begin()).response.status, 409, 'A local guess about a late completion cannot release the durable fence')
  assert.equal((await publish()).success, false)
  assert.equal(posts.length, 0)
})
