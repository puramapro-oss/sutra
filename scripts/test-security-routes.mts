import test, { mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://security-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service'
process.env.NEXT_PUBLIC_SITE_URL = 'https://app.invalid'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

let subscription = 'active', userId = 'alice', authUser = true, providerCalls = 0, providerFailure = false
let claimsValid = true
let issued: { userId: string; platform: string; state: string; binding: { profileId: string; sessionId: string } } | undefined
let providerRequest: { platform: string; profileId: string; redirectUri: string } | undefined
let targetError = false, targetExists = true, mutationError = false, mutationExists = true, mutations = 0
const cookies = { getAll: () => [], get: () => undefined, set: () => {} }
const sessionQuery = { select: () => sessionQuery, eq: () => sessionQuery,
  maybeSingle: async () => ({ data: { id: userId, subscription_status: subscription }, error: null }) }
const sessionClient = () => ({ auth: { getUser: async () => ({ data: { user: authUser ? { id: userId, email: 'admin@test.invalid' } : null }, error: null }), getClaims: async () => ({ data: { claims: { sub: claimsValid ? userId : 'another-user', session_id: '11111111-1111-4111-8111-111111111111' } }, error: null }) }, from: () => sessionQuery })
mock.module('@supabase/ssr', { namedExports: { createServerClient: sessionClient } })
mock.module('next/headers', { namedExports: { cookies: async () => cookies } })
const query = { select: () => query, eq: () => query, update: () => { mutations++; return query },
  maybeSingle: async () => mutations
    ? { data: mutationExists ? { id: 'target' } : null, error: mutationError ? { message: 'synthetic-sensitive-marker' } : null }
    : { data: targetExists ? { email: 'target@test.invalid' } : null, error: targetError ? { message: 'synthetic-sensitive-marker' } : null } }
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({ from: () => query }) } })
mock.module('../src/lib/utils.ts', { namedExports: { isSuperAdmin: (email: string) => email === 'admin@test.invalid' } })
mock.module('../src/lib/zernio.ts', { namedExports: {
  getOAuthUrl: async (platform: string, profileId: string, redirectUri: string) => { providerCalls++; providerRequest = { platform, profileId, redirectUri }; if (providerFailure) throw new Error('synthetic-sensitive-marker'); return { url: 'https://oauth.invalid/authorize', state: 'synthetic-state-0123456789' } },
  getConnectedAccount: async () => { throw new Error('UNEXPECTED_EXCHANGE') },
  getAuthorizedProfileId: () => 'a'.repeat(24), OAUTH_PLATFORMS: ['youtube', 'instagram', 'x'],
} })
mock.module('../src/lib/social-oauth-state.ts', { namedExports: {
  issueSocialOAuthState: async (userId: string, platform: string, state: string, binding: { profileId: string; sessionId: string }) => { issued = { userId, platform, state, binding }; return 'a'.repeat(64) }, socialOAuthCookieName: () => 'synthetic-state-cookie',
  consumeSocialOAuthState: async () => false, SOCIAL_OAUTH_TTL_SECONDS: 600,
} })
mock.module('../src/lib/social-oauth-account.ts', { namedExports: {
  readSocialOAuthAccount: async () => null,
  updateSocialOAuthAccount: async () => { throw new Error('UNEXPECTED_ACCOUNT_WRITE') },
} })
const { POST: connect } = await import('../src/app/api/social/connect/route.ts')
const { GET: callback } = await import('../src/app/api/social/callback/route.ts')
const { PATCH: changeUser } = await import('../src/app/api/admin/users/[id]/route.ts')
const { middleware } = await import('../src/middleware.ts')
beforeEach(() => {
  subscription = 'active'; userId = crypto.randomUUID(); authUser = true; providerCalls = 0; providerFailure = false
  claimsValid = true; issued = undefined; providerRequest = undefined
  delete process.env.NEXT_PUBLIC_APP_URL
  targetError = false; targetExists = true; mutationError = false; mutationExists = true; mutations = 0
})
const connectRequest = () => new Request('https://app.invalid/api/social/connect', { method: 'POST', body: JSON.stringify({ platform: 'youtube' }) })
const change = async (action = 'ban') => {
  const response = await changeUser(new Request('https://app.invalid/api/admin/users/target', { method: 'PATCH', body: JSON.stringify({ action, plan: 'free' }) }), { params: Promise.resolve({ id: 'target' }) })
  assert.ok(response); return response
}

test('banned session fails in the actual OAuth and admin handlers before side effects', async () => {
  subscription = 'banned'
  assert.equal((await connect(connectRequest())).status, 401)
  assert.equal((await change()).status, 401)
  assert.equal(providerCalls, 0); assert.equal(mutations, 0)
})
test('OAuth initiation is limited per authenticated user before contacting provider', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await connect(connectRequest())).status, 200)
  const blocked = await connect(connectRequest())
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0)
  assert.equal(providerCalls, 10)
  userId = 'another-user'; assert.equal((await connect(connectRequest())).status, 200)
})
test('OAuth provider exception is not returned to the browser', async () => {
  providerFailure = true
  const response = await connect(connectRequest())
  assert.equal(response.status, 500); assert.doesNotMatch(await response.text(), /synthetic-sensitive-marker/)
})
test('OAuth initiation binds its own state to user, profile and verified session on the canonical public origin', async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://canonical.invalid'
  const response = await connect(connectRequest())
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.match(body.state, /^[a-f0-9]{64}$/); assert.notEqual(body.state, 'synthetic-state-0123456789')
  assert.deepEqual(issued, { userId, platform: 'youtube', state: body.state,
    binding: { profileId: 'a'.repeat(24), sessionId: '11111111-1111-4111-8111-111111111111' } })
  const redirect = new URL(providerRequest!.redirectUri)
  assert.equal(redirect.origin, 'https://canonical.invalid'); assert.equal(redirect.searchParams.get('state'), body.state)
  assert.equal(redirect.searchParams.get('platform'), 'youtube'); assert.equal(providerRequest?.profileId, issued!.binding.profileId)
  const cookie = response.headers.get('set-cookie')!
  for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=lax/i, /Max-Age=600/i, /Path=\/api\/social/i]) assert.match(cookie, attribute)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const next = await (await connect(connectRequest())).json(); assert.notEqual(next.state, body.state)
  const denied = await callback(new Request('https://internal.invalid/api/social/callback?error=denied'))
  assert.equal(new URL(denied.headers.get('location')!).origin, 'https://canonical.invalid')
})
test('OAuth initiation rejects a mismatched verified session or client-chosen tenant before side effects', async () => {
  claimsValid = false
  assert.equal((await connect(connectRequest())).status, 401)
  claimsValid = true
  const forged = new Request('https://app.invalid/api/social/connect', { method: 'POST', body: JSON.stringify({ platform: 'youtube', profileId: 'b'.repeat(24) }) })
  assert.equal((await connect(forged)).status, 400)
  assert.equal(providerCalls, 0); assert.equal(issued, undefined)
})
test('OAuth callback never reflects untrusted provider errors into a redirect URL', async () => {
  const response = await callback(new Request('https://app.invalid/api/social/callback?error=synthetic-sensitive-marker'))
  assert.equal(response.headers.get('location'), 'https://app.invalid/settings/social?error=missing_params')
  assert.doesNotMatch(response.headers.get('location')!, /synthetic-sensitive-marker/)
  assert.equal(providerCalls, 0); assert.equal(mutations, 0)
})
test('OAuth callback rejects missing one-use state before exchanging code', async () => {
  const response = await callback(new Request('https://app.invalid/api/social/callback?connected=youtube&profileId=aaaaaaaaaaaaaaaaaaaaaaaa&accountId=bbbbbbbbbbbbbbbbbbbbbbbb&platform=youtube&state=synthetic-state-0123456789'))
  assert.equal(new URL(response.headers.get('location')!).searchParams.get('error'), 'invalid_or_expired_state')
})
test('failed/missing target lookup cannot authorize a ban', async () => {
  targetError = true; assert.equal((await change()).status, 503); assert.equal(mutations, 0)
  targetError = false; targetExists = false; assert.equal((await change()).status, 404); assert.equal(mutations, 0)
})
test('ban, unban and plan changes require a confirmed database row', async () => {
  for (const action of ['ban', 'unban', 'set_plan']) {
    mutations = 0; mutationError = true
    const failed = await change(action); assert.equal(failed.status, 503)
    assert.doesNotMatch(await failed.text(), /synthetic-sensitive-marker|"success":true/)
    mutations = 0; mutationError = false; mutationExists = false
    assert.equal((await change(action)).status, 503)
    mutations = 0; mutationExists = true
    assert.equal((await change(action)).status, 200)
  }
})
test('middleware blocks a banned dashboard session without a login redirect loop', async () => {
  subscription = 'banned'
  const protectedResponse = await middleware(new NextRequest('https://app.invalid/dashboard'))
  assert.equal(new URL(protectedResponse.headers.get('location')!).pathname, '/login')
  assert.equal((await middleware(new NextRequest('https://app.invalid/login'))).headers.get('location'), null)
  subscription = 'active'
  assert.equal((await middleware(new NextRequest('https://app.invalid/dashboard'))).headers.get('location'), null)
})
