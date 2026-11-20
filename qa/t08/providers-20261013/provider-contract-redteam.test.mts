// Audit-only acceptance checks. Known product failures must stay FAIL until fixed by owners.
// All HTTP is stubbed; invoke with offline.cjs and the fixture-only runner.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.ZERNIO_API_KEY = 't08-fixture-key'
process.env.ZERNIO_BASE_URL = 'https://zernio.invalid/api/v1'
process.env.SUNO_API_KEY = 't08-fixture-key'
process.env.SUNO_API_BASE_URL = 'https://api.sunoapi.org/api/v1'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 't08-fixture-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 't08-fixture-service'
process.env.NEXT_PUBLIC_SITE_URL = 'https://sutra.invalid'
globalThis.fetch = async () => { throw new Error('T08_UNEXPECTED_NETWORK') }

let authenticated = true, sessionChecks = 0
mock.module('../../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => {
    sessionChecks++
    return { data: { user: authenticated ? { id: 't08-user' } : null }, error: null }
  } } }),
} })
mock.module('../../../src/lib/logger.ts', { namedExports: {
  logApiCall: async () => { throw new Error('T08_UNEXPECTED_SUCCESS_LOG') },
} })
mock.module('next/headers', { namedExports: {
  cookies: async () => ({ get: () => undefined, set: () => {} }),
} })

const { getOAuthUrl } = await import('../../../src/lib/zernio.ts')
const { GET: callback } = await import('../../../src/app/api/social/callback/route.ts')
const { POST: music } = await import('../../../src/app/api/music/generate/route.ts')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})
const authUrl = 'https://oauth.invalid/authorize'
const state = 't08-fixture-unpredictable-state'
const redirectUri = 'https://sutra.invalid/api/social/callback'
// Synthetic Zernio profile owned by the fixture user; never a real provider identifier.
const profileId = 'a'.repeat(24)

test('T08-Z01 current connect endpoint must replace undocumented /oauth/url', async () => {
  let requestedPath = ''
  globalThis.fetch = async (input) => {
    requestedPath = new URL(String(input)).pathname
    return requestedPath === '/api/v1/connect/youtube'
      ? json({ authUrl, state }) : json({ error: 'route_not_found' }, 404)
  }
  const result = await getOAuthUrl('youtube', profileId, redirectUri)
  assert.equal(requestedPath, '/api/v1/connect/youtube')
  assert.equal(result.url, authUrl)
})

test('T08-Z02 initiation must carry owned profileId, redirect_url and posting scopes', async () => {
  let query: URLSearchParams | undefined
  globalThis.fetch = async (input) => {
    query = new URL(String(input)).searchParams
    return json({ authUrl, state })
  }
  await getOAuthUrl('youtube', profileId, redirectUri)
  assert.deepEqual({ profileId: query?.get('profileId'), redirect: query?.get('redirect_url'), scopes: query?.get('scopes') },
    { profileId, redirect: redirectUri, scopes: 'posting' })
})

test('T08-Z03 documented authUrl response must survive adapter parsing', async () => {
  globalThis.fetch = async () => json({ authUrl, state })
  assert.deepEqual(await getOAuthUrl('youtube', profileId, redirectUri), { url: authUrl, state })
})

test('T08-Z04 hosted callback must reach session verification without requiring an obsolete code', async () => {
  authenticated = false; sessionChecks = 0
  // Correlation is retained in redirect_url by Zernio. It still needs one-use DB validation.
  const query = new URLSearchParams({ connected: 'youtube', profileId, accountId: 'b'.repeat(24),
    username: 'fixture', state, platform: 'youtube' })
  const response = await callback(new Request(`${redirectUri}?${query}`))
  assert.equal(sessionChecks, 1, 'current callback is rejected as missing_params before authentication')
  assert.equal(new URL(response.headers.get('location')!).searchParams.get('error'), 'session_required')
})

test('T08-S01 provider 2xx error payload must never reach the music API caller', async () => {
  authenticated = true
  const marker = 'T08_SYNTHETIC_PRIVATE_PROVIDER_BODY'
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({ error: marker }) }
  const response = await music(new Request('https://sutra.invalid/api/music/generate', {
    method: 'POST', body: JSON.stringify({ prompt: 'fixture music', style: 'ambient', duration: 10 }),
  }))
  assert.equal(calls, 1)
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})

test('T08-S02 provider 401 payload stays redacted at the same music API boundary', async () => {
  authenticated = true
  const marker = 'T08_SYNTHETIC_PRIVATE_HTTP_ERROR'
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({ error: marker }, 401) }
  const response = await music(new Request('https://sutra.invalid/api/music/generate', {
    method: 'POST', body: JSON.stringify({ prompt: 'fixture music', style: 'ambient', duration: 10 }),
  }))
  assert.equal(calls, 1)
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
