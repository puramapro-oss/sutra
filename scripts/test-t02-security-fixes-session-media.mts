import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { AuthApiError, type SupabaseClient, type UserResponse } from '@supabase/supabase-js'
import { enforceAccountAccess } from '../src/lib/account-access.ts'

// Compose the real per-request account guard, media route and ownership check.
// Earlier unit suites exercised these independently with a mocked server client.
let userId = 'alice'
let expired = false
let revoked = false
let profileError = false
let profileReads = 0
const signatures: string[] = []
const raw = {
  auth: { getUser: async () => ({
    data: { user: { id: userId } },
    error: expired ? new AuthApiError('synthetic-expired-session', 401, 'session_expired') : null,
  } as UserResponse) },
  from: () => {
    const query = {
      select: () => query,
      eq: (_column: string, id: string) => { assert.equal(id, userId); return query },
      maybeSingle: async () => {
        profileReads++
        return { data: { id: userId, subscription_status: 'active', access_revoked_at: revoked ? '2026-10-14' : null },
          error: profileError ? { message: 'synthetic-private-diagnostic' } : null }
      },
    }
    return query
  },
}
const client = enforceAccountAccess(raw as unknown as SupabaseClient)
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => client } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  storage: { from: () => ({ createSignedUrl: async (path: string, seconds: number) => {
    assert.equal(seconds, 300); signatures.push(path)
    return { data: { signedUrl: 'https://storage.example/synthetic-signed-object' }, error: null }
  } }) },
}) } })
const { GET } = await import('../src/app/api/media/[reference]/route.ts')
const reference = Buffer.from('owners/alice/clip.mp4').toString('base64url')
const request = () => GET(new Request(`https://sutra.example/api/media/${reference}`), { params: Promise.resolve({ reference }) })
beforeEach(() => { userId = 'alice'; expired = false; revoked = false; profileError = false; profileReads = 0; signatures.length = 0 })

test('media reference: expired session cannot sign even if the auth result retains a user', async () => {
  expired = true
  const response = await request()
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('location'), null)
  assert.equal(await response.text(), '')
  assert.equal(profileReads, 0); assert.deepEqual(signatures, [])
})
test('media reference: valid session belonging to another user cannot sign', async () => {
  userId = 'bob'
  assert.equal((await request()).status, 404)
  assert.equal(profileReads, 1); assert.deepEqual(signatures, [])
})
test('media reference: revocation after a success prevents the next signature', async () => {
  const active = await request()
  assert.equal(active.status, 307)
  assert.equal(active.headers.get('cache-control'), 'private, no-store, max-age=0')
  assert.equal(active.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(active.headers.get('vary'), 'Cookie')
  revoked = true
  assert.equal((await request()).status, 401)
  assert.equal(profileReads, 2)
  assert.deepEqual(signatures, ['owners/alice/clip.mp4'])
})
test('media reference: profile outage never yields a signature or provider diagnostic', async () => {
  profileError = true
  const response = await request()
  assert.equal(response.status, 401)
  assert.equal(await response.text(), '')
  assert.deepEqual(signatures, [])
})
