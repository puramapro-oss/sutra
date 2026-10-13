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
// and public.social_accounts' real (user_id, platform) unique upsert contract.
const database = {
  schema: () => database,
  from(table: string): object {
    if (table !== 'social_oauth_states') {
      const client = db.client as unknown as { from: (name: string) => object }
      const builder = client.from(table)
      if (table !== 'social_accounts') return builder
      return new Proxy(builder, { get(target, key) {
        if (key !== 'upsert') return Reflect.get(target, key)
        return async (row: Row, options: { onConflict: string }) => {
          assert.equal(options.onConflict, 'user_id,platform')
          const old = db.accounts.find(a => a.user_id === row.user_id && a.platform === row.platform)
          if (old) Object.assign(old, row)
          else db.accounts.push({ ...row, id: db.accounts.length ? '44444444-4444-4444-8444-444444444444' : localId } as typeof db.accounts[number])
          return { error: null }
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
      assert.equal(states.length, 1, 'Persist local state before provider URL acquisition')
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
  const response = await connect(new Request('https://sutra-test.invalid/api/social/connect', {
    method: 'POST', body: JSON.stringify({ platform, ...extra }),
  }))
  if (response.status !== 200) return { response, callbackUrl: new URL('https://sutra-test.invalid/unused'), state: '' }
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
  assert.deepEqual(row.metadata, { zernio_profile_id: profile, credential_owner: 'zernio' })
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
