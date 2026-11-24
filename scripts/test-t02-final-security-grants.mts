import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Real route, capability HMAC and tenant resolver. Database rows are filtered,
// not fabricated in response to the requested identity. No provider/network.
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const tenants = { [alice]: 'a'.repeat(24), [bob]: 'b'.repeat(24) }
type Row = Record<string, unknown>
let rows: Record<string, Row[]>
let actor: string | null = null
let failure = ''
const signatures: string[] = []
const service = {
  schema: () => service,
  from(table: string) {
    assert.ok(Object.hasOwn(rows, table), `unexpected table ${table}`)
    const filters: Array<(row: Row) => boolean> = []
    let columns = '*'
    const read = () => {
      if (failure === table) return { data: null, error: { message: 'synthetic-private-diagnostic' } }
      return { error: null, data: rows[table].filter(row => filters.every(f => f(row))).map(row =>
        columns === '*' ? row : Object.fromEntries(columns.split(',').map(key => [key, row[key]]))) }
    }
    const query = {
      select(value: string) { columns = value; return query },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query },
      async maybeSingle() { const result = read(); return { ...result, data: result.data?.[0] ?? null } },
      then(resolve: (result: ReturnType<typeof read>) => unknown) { return Promise.resolve(read()).then(resolve) },
    }
    return query
  },
  storage: { from(bucket: string) {
    assert.equal(bucket, 'sutra-assets')
    return { createSignedUrl: async (path: string, ttl: number) => {
      assert.equal(ttl, 300); signatures.push(path)
      return { data: { signedUrl: `https://storage.example/${path}?token=fixture` }, error: null }
    } }
  } },
}
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: actor ? { id: actor } : null }, error: null }) },
}) } })
const media = await import('../src/lib/private-media.ts')
const { GET } = await import('../src/app/api/media/[reference]/route.ts')
const pathFor = (user: string) => `owners/${user}/video.mp4`
const urlFor = (user: string) => media.durableMediaUrl(pathFor(user))
const accountFor = (user: string) => rows.social_accounts.find(row => row.user_id === user)!
const request = (url: string) => GET(new Request(url), {
  params: Promise.resolve({ reference: new URL(url).pathname.split('/').at(-1)! }),
})
async function grant(user = alice, expires = Date.now() + 60_000) {
  const url = urlFor(user)
  const capability = (await media.publicationMediaUrl(url, {
    userId: user, productionId: `video-${user}`, kind: 'video', operationId: `op-${user}`, expires,
  }))!
  rows.social_publication_journals.push({ user_id: user, production_id: `video-${user}`, kind: 'video', operations: [{
    id: `op-${user}`, accountRows: { youtube: `account-${user}` }, request: {
      videoUrl: url, providerMediaUrl: capability, verifiedSha256: 'a'.repeat(64),
      platforms: ['youtube'], accountIds: { youtube: `remote-${user}` },
    },
  }] })
  return capability
}
async function denied(url: string) {
  signatures.length = 0
  const response = await request(url)
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('location'), null)
  assert.equal(await response.text(), '')
  assert.deepEqual(signatures, [])
}
beforeEach(() => {
  actor = null; failure = ''; signatures.length = 0
  process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.example'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-media-signing-key'
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify(tenants)
  rows = {
    social_publication_journals: [], media_ownership: [],
    profiles: [alice, bob].map(id => ({ id, subscription_status: 'active', access_revoked_at: null })),
    videos: [alice, bob].map(user_id => ({ id: `video-${user_id}`, user_id,
      video_url: urlFor(user_id), status: 'ready', shotstack_json: { sutraVerification: { sha256: 'a'.repeat(64) } } })),
    social_accounts: [alice, bob].map(user_id => ({ user_id, id: `account-${user_id}`, platform: 'youtube',
      external_id: `remote-${user_id}`, status: 'connected', token_expires_at: null,
      metadata: { credential_owner: 'zernio', zernio_profile_id: tenants[user_id as keyof typeof tenants] } })),
  }
})

test('two users and two provider tenants: each exact capability authorizes only its own object', async () => {
  for (const user of [alice, bob]) {
    const response = await request(await grant(user))
    assert.equal(response.status, 307)
    assert.match(response.headers.get('location')!, new RegExp(`/owners/${user}/`))
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0')
  }
  assert.deepEqual(signatures, [pathFor(alice), pathFor(bob)])
})
test('signed capability cannot move to the other user object', async () => {
  const capability = await grant()
  await denied(`${urlFor(bob)}${new URL(capability).search}`)
})
test('journal ownership cannot be replaced by another user', async () => {
  const capability = await grant(); rows.social_publication_journals[0].user_id = bob
  await denied(capability)
})
test('project ownership cannot be replaced by another user', async () => {
  const capability = await grant(); rows.videos[0].user_id = bob
  await denied(capability)
})
test('social account ownership cannot be replaced by another user', async () => {
  const capability = await grant(); accountFor(alice).user_id = bob
  await denied(capability)
})
test('pending revoke closes an already emitted capability before remote revocation finishes', async () => {
  const capability = await grant()
  assert.equal((await request(capability)).status, 307)
  Object.assign(accountFor(alice).metadata!, { sutra_revocation_pending: true })
  await denied(capability)
})
test('changing the live provider tenant invalidates the old capability', async () => {
  const capability = await grant()
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: tenants[bob], [bob]: tenants[alice] })
  await denied(capability)
})
for (const variant of ['foreign-profile', 'missing-profile', 'foreign-credential-owner', 'missing-metadata']) {
  test(`capability refuses ${variant} account provenance`, async () => {
    const capability = await grant()
    accountFor(alice).metadata = variant === 'missing-metadata' ? null : {
      credential_owner: variant === 'foreign-credential-owner' ? 'other' : 'zernio',
      ...(variant === 'missing-profile' ? {} : { zernio_profile_id: variant === 'foreign-profile' ? tenants[bob] : tenants[alice] }),
    }
    await denied(capability)
  })
}
for (const variant of ['absent', 'invalid', 'duplicate']) {
  test(`capability fails closed when tenant bindings are ${variant}`, async () => {
    const capability = await grant()
    if (variant === 'absent') delete process.env.ZERNIO_PROFILE_BINDINGS
    else process.env.ZERNIO_PROFILE_BINDINGS = variant === 'invalid' ? '{' : JSON.stringify({ [alice]: tenants[alice], [bob]: tenants[alice] })
    await denied(capability)
  })
}
test('expired grant refuses before storage signing', async () => { await denied(await grant(alice, Date.now() - 1)) })
test('missing signing secret fails closed', async () => {
  const capability = await grant(); delete process.env.SUPABASE_SERVICE_ROLE_KEY
  await denied(capability)
})
test('social account DB diagnostic is not exposed by media route', async () => {
  const capability = await grant(); failure = 'social_accounts'
  await denied(capability)
})
test('no capability and no authenticated session cannot sign', async () => {
  assert.equal((await request(urlFor(alice))).status, 401); assert.deepEqual(signatures, [])
})
test('another authenticated user cannot sign the owner reference', async () => { actor = bob; await denied(urlFor(alice)) })
