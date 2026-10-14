import test from 'node:test'
import assert from 'node:assert/strict'
import { socialDatabase, postId, type Row } from './helpers/social-database.mts'
import type { PublicationGateway } from '../src/lib/publication-journal.ts'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'
import { createClient } from '@supabase/supabase-js'

const user = '11111111-1111-4111-8111-111111111111'
const profile = 'a'.repeat(24)
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const { publishVideoRecord } = await import('../src/lib/social-publication.ts')
const { publishAutoVideoRecord } = await import('../src/lib/auto-publication.ts')
const { updateSocialOAuthAccount } = await import('../src/lib/social-oauth-account.ts')

function fixture() {
  const db = socialDatabase()
  for (const rows of Object.values(db.tables)) for (const row of rows as Row[]) {
    if (row.user_id === 'u') row.user_id = user
  }
  db.profile.id = user
  for (const row of db.accounts) Object.assign(row, { metadata: { zernio_profile_id: profile, credential_owner: 'zernio' } })
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: profile })
  let now = Date.now(), posts = 0, replays = 0, retries = 0, gets = 0
  let remoteStatus: PublishResult['status'] = 'published', lose = false
  const result = (request: PublishRequest): PublishResult[] => request.platforms.map(platform => ({
    platform, accountId: request.accountIds[platform], postId, status: remoteStatus, success: remoteStatus === 'published',
  }))
  const gateway: PublicationGateway = {
    now: () => now,
    publish: async request => { posts++; if (lose) throw new Error('response lost'); return result(request) },
    replay: async request => { replays++; return result(request) },
    retry: async (_id, request) => { retries++; return result(request) },
    reconcile: async (_id, request) => { gets++; return result(request) },
  }
  const invoke = () => publishVideoRecord(user, { videoId: 'v', platforms: ['youtube'] }, db.client, gateway.publish, gateway.reconcile, gateway)
  return { db, gateway, invoke, counts: () => ({ posts, replays, retries, gets }),
    advance: () => { now += 120001 }, lose: () => { lose = true }, status: (status: PublishResult['status']) => { remoteStatus = status } }
}

for (const mode of ['first', 'replay', 'retry'] as const) {
  for (const reason of ['profile-changed', 'binding-removed', 'metadata-absent', 'revocation-pending'] as const) {
    test(`T06 tenant: ${mode} refuses ${reason}`, async () => {
      const h = fixture()
      if (mode === 'replay') { h.lose(); await h.invoke(); h.advance() }
      if (mode === 'retry') { h.status('failed'); await h.invoke() }
      if (reason === 'profile-changed') process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'b'.repeat(24) })
      if (reason === 'binding-removed') process.env.ZERNIO_PROFILE_BINDINGS = '{}'
      if (reason === 'metadata-absent') Object.assign(h.db.accounts[0], { metadata: null })
      if (reason === 'revocation-pending') Object.assign(h.db.accounts[0], { metadata: {
        zernio_profile_id: profile, credential_owner: 'zernio', sutra_revocation_pending: true,
      } })
      const before = h.counts()
      await h.invoke().catch(error => { assert.match(String(error), /SUTRA_(SOCIAL_PROFILE_RECONNECTION_REQUIRED|ZERNIO_PROFILE_BINDING_REQUIRED|ACCOUNT_REVOKED_OR_DISCONNECTED)/) })
      assert.equal(h.counts().posts, before.posts, 'No create on obsolete tenant authority')
      assert.equal(h.counts().replays, before.replays, 'No replay on obsolete tenant authority')
      assert.equal(h.counts().retries, before.retries, 'No retry on obsolete tenant authority')
      if (mode !== 'first') assert.equal(h.db.tables.social_publication_journals[0].operations.length, 1)
    })
  }
}
test('T06 tenant: binding removed after durable claim prevents first POST', async () => {
  const h = fixture()
  h.db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.length) process.env.ZERNIO_PROFILE_BINDINGS = '{}'
  }
  const result = await h.invoke()
  assert.equal(h.counts().posts, 0)
  assert.match(result.results[0].error!, /PROFILE_BINDING_REQUIRED/)
})
test('T06 tenant: automatic publication uses the same current profile authority', async () => {
  const h = fixture(); process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'b'.repeat(24) })
  await publishAutoVideoRecord(user, 'v', true, h.db.client, undefined, h.gateway)
    .catch(error => assert.match(String(error), /SOCIAL_PROFILE_RECONNECTION_REQUIRED/))
  assert.equal(h.counts().posts, 0)
})
test('T06 tenant: read-only reconciliation preserves historical success after reassignment', async () => {
  const h = fixture(); h.status('publishing')
  await publishAutoVideoRecord(user, 'v', true, h.db.client, undefined, h.gateway)
  process.env.ZERNIO_PROFILE_BINDINGS = '{}'; h.status('published')
  const before = h.counts()
  const result = await publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway, true)
  assert.equal(result.status, 'published'); assert.ok(h.counts().gets > before.gets)
  assert.equal(h.counts().posts, before.posts); assert.equal(h.counts().replays, 0); assert.equal(h.counts().retries, 0)
})
test('T06 tenant: fresh consent in current profile permits one send and no duplicate', async () => {
  const h = fixture()
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'b'.repeat(24) })
  Object.assign(h.db.accounts[0], { metadata: { zernio_profile_id: 'b'.repeat(24), credential_owner: 'zernio' } })
  assert.equal((await h.invoke()).status, 'published'); await h.invoke()
  assert.equal(h.counts().posts, 1); assert.equal(h.db.tables.social_posts.length, 1)
})

for (const metadata of [null, { zernio_profile_id: profile, label: 'quote" comma, braces{} unicode é', sutra_revocation_pending: true }]) {
  test(`T06 CAS: real Supabase serializer preserves ownership and ${metadata ? 'JSONB' : 'NULL'} predicates`, async () => {
    let calls = 0
    const service = createClient('https://sutra-test.invalid', 'fixture-service', { auth: { persistSession: false }, global: {
      fetch: async (input, init) => {
        calls++
        const url = new URL(String(input)), headers = new Headers(init?.headers)
        assert.equal(url.hostname, 'sutra-test.invalid'); assert.equal(init?.method, 'PATCH')
        assert.equal(headers.get('content-profile'), 'public')
        assert.equal(url.searchParams.get('id'), 'eq.local-y'); assert.equal(url.searchParams.get('user_id'), `eq.${user}`)
        assert.equal(url.searchParams.get('status'), 'eq.revoked'); assert.equal(url.searchParams.get('external_id'), 'is.null')
        assert.equal(url.searchParams.get('updated_at'), 'is.null')
        assert.equal(url.searchParams.get('metadata'), metadata ? `eq.${JSON.stringify(metadata)}` : 'is.null')
        assert.equal(url.searchParams.get('select'), 'id')
        assert.deepEqual(JSON.parse(String(init?.body)), { status: 'connected' })
        return Response.json([{ id: 'local-y' }])
      },
    } })
    const saved = await updateSocialOAuthAccount(user, { id: 'local-y', external_id: null, status: 'revoked', updated_at: null, metadata }, { status: 'connected' }, service)
    assert.equal(saved.error, null); assert.equal(saved.data?.id, 'local-y'); assert.equal(calls, 1)
  })
}
