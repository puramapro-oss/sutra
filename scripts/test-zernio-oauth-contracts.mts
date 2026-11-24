import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.ZERNIO_API_KEY = 'synthetic-zernio-key'
process.env.ZERNIO_BASE_URL = 'https://zernio.invalid/api/v1'
const { getOAuthUrl, getConnectedAccount, getAuthorizedProfileId } = await import('../src/lib/zernio.ts')
const profileId = 'a'.repeat(24), accountId = 'b'.repeat(24)
const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222'
const privateMarker = 'synthetic-private-provider-diagnostic'
const redirectUri = 'https://sutra.invalid/api/social/callback?state=synthetic-local-state&platform=x'
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
const account = () => ({ _id: accountId, platform: 'twitter', profileId, username: 'verified-user', isActive: true,
  accessToken: 'synthetic-provider-owned-token', refreshToken: 'synthetic-provider-owned-refresh', profilePicture: 'https://media.invalid/avatar.png' })
beforeEach(() => {
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: profileId, [bob]: 'c'.repeat(24) })
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
})

test('Zernio profile binding is exact and server-owned, never the first/default profile', () => {
  assert.equal(getAuthorizedProfileId(alice), profileId)
  assert.equal(getAuthorizedProfileId(bob), 'c'.repeat(24))
  assert.throws(() => getAuthorizedProfileId('unknown'), /^Error: SUTRA_ZERNIO_PROFILE_BINDING_REQUIRED$/)
  for (const bindings of ['{}', '[]', 'null', '{invalid', JSON.stringify({ [alice]: profileId, [bob]: profileId }), JSON.stringify({ [alice]: 'invalid' }), JSON.stringify({ alice: profileId })]) {
    process.env.ZERNIO_PROFILE_BINDINGS = bindings
    assert.throws(() => getAuthorizedProfileId(alice), /^Error: SUTRA_ZERNIO_PROFILE_BINDING_REQUIRED$/)
  }
})

test('Zernio OAuth uses GET, mapped platform, posting-only consent and exact callback correlation', async () => {
  let calls = 0
  globalThis.fetch = async (input, options) => {
    calls++
    const url = new URL(String(input))
    assert.equal(url.origin + url.pathname, 'https://zernio.invalid/api/v1/connect/twitter')
    assert.deepEqual(Object.fromEntries(url.searchParams), { profileId, redirect_url: redirectUri, scopes: 'posting' })
    assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error')
    assert.equal(options?.body, undefined); assert.ok(options?.signal instanceof AbortSignal)
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer synthetic-zernio-key')
    return json({ authUrl: 'https://social.invalid/authorize', state: 'provider-internal-state' })
  }
  assert.deepEqual(await getOAuthUrl('x', profileId, redirectUri), { url: 'https://social.invalid/authorize', state: 'provider-internal-state' })
  assert.equal(calls, 1)
})

test('Zernio refuses unsupported platform, malformed profile and unsafe callback before HTTP', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({}) }
  await assert.rejects(getOAuthUrl('bluesky', profileId, redirectUri), /SUTRA_ZERNIO_CONNECT_UNAVAILABLE/)
  await assert.rejects(getOAuthUrl('x', 'not-a-profile', redirectUri), /SUTRA_ZERNIO_CONNECT_UNAVAILABLE/)
  for (const unsafe of ['http://sutra.invalid/callback', 'https://user:password@sutra.invalid/callback', 'javascript:alert(1)']) {
    await assert.rejects(getOAuthUrl('x', profileId, unsafe), /SUTRA_ZERNIO_CONNECT_UNAVAILABLE/)
  }
  assert.equal(calls, 0)
})

test('Zernio connect failures are bounded, generic and never retried', async () => {
  for (const response of [() => json({ error: privateMarker }, 401), () => json({ error: privateMarker }, 503),
    () => json({ authUrl: 'javascript:alert(1)' }), () => json({ authUrl: 'https://user:password@social.invalid' }),
    () => json({ url: 'https://social.invalid/obsolete' }), () => new Response(privateMarker),
    () => json({ authUrl: `https://social.invalid/${'x'.repeat(20_000)}` })]) {
    let calls = 0
    globalThis.fetch = async () => { calls++; return response() }
    await assert.rejects(getOAuthUrl('x', profileId, redirectUri), /^Error: SUTRA_ZERNIO_CONNECT_UNAVAILABLE$/)
    assert.equal(calls, 1)
  }
  globalThis.fetch = async () => { throw new Error(privateMarker) }
  await assert.rejects(getOAuthUrl('x', profileId, redirectUri), /^Error: SUTRA_ZERNIO_CONNECT_UNAVAILABLE$/)
})

test('Zernio callback identity comes only from a scoped GET and contains no credentials', async () => {
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input))
    assert.equal(url.pathname, '/api/v1/accounts'); assert.deepEqual(Object.fromEntries(url.searchParams), { profileId })
    assert.equal(options?.method, 'GET'); assert.equal(options?.redirect, 'error'); assert.ok(options?.signal instanceof AbortSignal)
    return json({ accounts: [account()] })
  }
  const result = await getConnectedAccount('x', profileId, accountId)
  assert.deepEqual(result, { platform: 'x', externalId: accountId, username: 'verified-user', displayName: 'verified-user', avatarUrl: 'https://media.invalid/avatar.png' })
  assert.doesNotMatch(JSON.stringify(result), /Token|synthetic-provider-owned/)
  globalThis.fetch = async () => json({ accounts: [{ ...account(), profileId: { _id: profileId }, profilePicture: 'javascript:alert(1)' }] })
  assert.equal((await getConnectedAccount('x', profileId, accountId)).avatarUrl, undefined)
})

test('Zernio refuses forged, inactive, duplicate and mismatched account identities', async () => {
  const variants = [[], [{ ...account(), _id: 'c'.repeat(24) }], [account(), account()],
    [{ ...account(), profileId: 'c'.repeat(24) }], [{ ...account(), profileId: undefined }],
    [{ ...account(), platform: 'youtube' }], [{ ...account(), isActive: false }],
    [{ ...account(), username: '' }], [{ ...account(), username: 'x'.repeat(513) }]]
  for (const accounts of variants) {
    globalThis.fetch = async () => json({ accounts })
    await assert.rejects(getConnectedAccount('x', profileId, accountId), /^Error: SUTRA_ZERNIO_ACCOUNT_VERIFICATION_FAILED$/)
  }
})

test('Zernio account verification failures never leak provider diagnostics or retry', async () => {
  for (const response of [() => json({ error: privateMarker }, 403), () => json({ error: privateMarker }, 503),
    () => new Response(privateMarker), () => json({ accounts: privateMarker })]) {
    let calls = 0
    globalThis.fetch = async () => { calls++; return response() }
    await assert.rejects(getConnectedAccount('x', profileId, accountId), /^Error: SUTRA_ZERNIO_ACCOUNT_VERIFICATION_FAILED$/)
    assert.equal(calls, 1)
  }
})
