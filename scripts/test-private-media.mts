import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-media-signing-key'
let signatures = 0
let actor: string | null = 'alice'
let revoked = false
let disconnected = false
let mediaChanged = false
let dbError = false
let operations: unknown[] = []
const service = {
  schema: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [{ id: 'account-1', platform: 'youtube', external_id: 'remote-1', status: disconnected ? 'revoked' : 'connected' }] }) }) }) }),
  storage: { from: () => ({ createSignedUrl: async (path: string, ttl: number) => {
    signatures++; assert.equal(ttl, 300)
    return { data: { signedUrl: `https://storage.test.invalid/${path}?token=fixture-${signatures}` }, error: null }
  } }) },
  from: (table: string) => {
    const eqs: Record<string, string> = {}
    const q = { select: () => q, eq: (key: string, value: string) => { eqs[key] = value; return q }, maybeSingle: async () => {
      if (dbError) return { error: { message: 'fixture-secret' }, data: null }
      if (table === 'profiles') return { data: { id: eqs.id, subscription_status: revoked ? 'banned' : 'active' } }
      if (table === 'videos') return { data: { video_url: mediaChanged ? 'changed' : url, status: 'ready', shotstack_json: { sutraVerification: { sha256: 'a'.repeat(64) } } } }
      if (table === 'social_publication_journals') return { data: { operations: eqs.user_id === 'alice' && eqs.production_id === 'video-1' && eqs.kind === 'video' ? operations : [] } }
      return { data: eqs.object_path === 'legacy/a.mp4' && eqs.user_id === 'alice' ? { user_id: 'alice' } : null }
    } }
    return q
  },
}
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: actor ? { id: actor } : null }, error: null }) } }) } })
const media = await import('../src/lib/private-media.ts')
const { GET } = await import('../src/app/api/media/[reference]/route.ts')
const url = media.durableMediaUrl('owners/alice/video.mp4')
const request = (value = url) => GET(new Request(value), { params: Promise.resolve({ reference: new URL(value).pathname.split('/').at(-1)! }) })
test('private reference stays constant while authorized signatures renew', async () => {
  const first = await media.withMediaOwner('alice', () => media.resolveMediaUrl(url))
  const second = await media.withMediaOwner('alice', () => media.resolveMediaUrl(url))
  assert.notEqual(first, second); assert.equal(media.mediaPath(url), 'owners/alice/video.mp4')
  assert.equal(await media.resolveMediaUrl('https://stock.test.invalid/a.mp4'), 'https://stock.test.invalid/a.mp4')
})
test('missing owner and cross-user access are refused before signing', async () => {
  const before = signatures
  await assert.rejects(media.resolveMediaUrl(url), /OWNER_REQUIRED/)
  await assert.rejects(media.withMediaOwner('bob', () => media.resolveMediaUrl(url)), /ACCESS_DENIED/)
  assert.equal(signatures, before)
  assert.throws(() => media.withMediaOwner('alice', () => media.withMediaOwner('bob', () => 1)), /OWNER_MISMATCH/)
})
test('worker authorities are isolated under concurrency', async () => {
  await Promise.all(['alice', 'bob'].map(user => media.withMediaOwner(user, async () => {
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(media.mediaOwner(), user)
    assert.match(await media.resolveMediaUrl(media.durableMediaUrl(`owners/${user}/v.mp4`)), new RegExp(`/owners/${user}/`))
  })))
})
test('legacy ownership fails closed for ambiguous or missing inventory', async () => {
  await media.assertMediaOwner('legacy/a.mp4', 'alice')
  await assert.rejects(media.assertMediaOwner('legacy/a.mp4', 'bob'), /ACCESS_DENIED/)
  await assert.rejects(media.assertMediaOwner('legacy/missing.mp4', 'alice'), /ACCESS_DENIED/)
})
test('route authenticates the owner and never caches redirects or failures', async () => {
  actor = null; assert.equal((await request()).status, 401)
  actor = 'bob'; assert.equal((await request()).status, 404)
  actor = 'alice'; const response = await request()
  assert.equal(response.status, 307); assert.match(response.headers.get('cache-control')!, /no-store/)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
})
test('publication capability requires exact durable journal, owner and live profile', async () => {
  const expires = Date.now() + 60_000
  const capability = (await media.publicationMediaUrl(url, { userId: 'alice', productionId: 'video-1', kind: 'video', operationId: 'op-1', expires }))!
  const token = new URL(capability).searchParams.get('grant')!
  actor = null
  assert.equal((await request(capability)).status, 404)
  operations = [{ id: 'op-1', accountRows: { youtube: 'account-1' }, request: { videoUrl: url, providerMediaUrl: capability, verifiedSha256: 'a'.repeat(64), platforms: ['youtube'], accountIds: { youtube: 'remote-1' } } }]
  const first = await request(capability); const second = await request(capability)
  assert.equal(first.status, 307); assert.equal(second.status, 307)
  assert.notEqual(first.headers.get('location'), second.headers.get('location'))
  await assert.rejects(media.authorizePublicationMedia(url, token, undefined, expires), /ACCESS_DENIED/)
  assert.equal((await request(capability + 'x')).status, 404)
  revoked = true; assert.equal((await request(capability)).status, 404); revoked = false
  disconnected = true; assert.equal((await request(capability)).status, 404); disconnected = false
  mediaChanged = true; assert.equal((await request(capability)).status, 404); mediaChanged = false
  dbError = true; assert.equal((await request(capability)).status, 404); dbError = false
  operations = []; assert.equal((await request(capability)).status, 404)
})
test('malformed references cannot escape their owner prefix', async () => {
  for (const path of ['owners/alice/../bob/x', 'owners/alice//x', '/owners/alice/x', 'owners/alice/\\x']) {
    assert.throws(() => media.mediaPath(media.durableMediaUrl(path)), /REFERENCE_INVALID/)
  }
  assert.throws(() => media.mediaPath(url + '?grant=anything'), /REFERENCE_INVALID/)
})
