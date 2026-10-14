import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const marker = 'synthetic-private-provider-detail'
const videoId = '00000000-0000-4000-8000-000000000001'
const proof = {
  id: 'proof-fixture', content_sha256: 'a'.repeat(64), ots_proof_base64: 'fixture', ots_upgraded_proof: null,
  storage_path: 'proofs/fixture.ots', storage_public_url: 'https://public.example/fixture.ots', blockchain: 'bitcoin',
  status: 'pending', created_at: '2026-10-14', upgraded_at: null, verified_at: null,
}
let mode = 'pending'
let dbCalls = 0
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  if (mode === 'service-exception') throw new Error(marker)
  const query = {
    from: () => query, select: () => query,
    eq: (key: string, value: string) => { assert.equal(key, 'video_id'); assert.equal(value, videoId); return query },
    maybeSingle: async () => { dbCalls++; return { data: mode === 'missing' ? null : proof, error: mode === 'db-error' ? { message: marker } : null } },
  }
  return query
} } })
mock.module('../src/lib/opentimestamps.ts', { namedExports: { verifyProof: async () => {
  if (mode === 'verify-exception') throw new Error(marker)
  if (mode === 'verified') return { verified: true, bitcoinBlockHeight: 123, bitcoinTimestamp: new Date('2026-10-14T00:00:00Z') }
  return { verified: false, reason: mode === 'pending' ? 'not_anchored' : mode === 'mismatch' ? 'sha_mismatch' : 'parse_error', detail: marker }
} } })
const { GET } = await import('../src/app/api/verify/[videoId]/route.ts')
const request = (id = videoId) => GET(new Request(`https://sutra.example/api/verify/${id}`), { params: Promise.resolve({ videoId: id }) })
beforeEach(() => { mode = 'pending'; dbCalls = 0 })

for (const failure of ['service-exception', 'db-error', 'verify-exception', 'parse-error', 'mismatch']) {
  test(`public proof: ${failure} never exposes internal details`, async () => {
    mode = failure
    const response = await request()
    assert.equal(response.status, failure === 'mismatch' ? 409 : 500)
    const body = await response.text()
    assert.equal(body.includes(marker), false)
    assert.equal(Object.hasOwn(JSON.parse(body), 'detail'), false)
  })
}
test('public proof: pending and verified responses keep the public proof contract', async () => {
  const pending = await request()
  assert.equal(pending.status, 200)
  assert.equal((await pending.json()).status, 'pending')
  mode = 'verified'
  const verified = await request()
  assert.equal(verified.status, 200)
  const body = await verified.json()
  assert.equal(body.status, 'verified')
  assert.equal(body.sha256, proof.content_sha256)
  assert.equal(body.bitcoinBlockHeight, 123)
  assert.equal(body.storagePublicUrl, proof.storage_public_url)
})
test('public proof: malformed IDs fail before querying, missing rows remain 404', async () => {
  assert.equal((await request('../private')).status, 400)
  assert.equal(dbCalls, 0)
  mode = 'missing'
  assert.equal((await request()).status, 404)
})
