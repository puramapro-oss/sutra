import test, { mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { socialDatabase } from './helpers/social-database.mts'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.CRON_SECRET = 'synthetic-cron-control-0123456789'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
let db = socialDatabase(), authenticated = true, providerCalls = 0
const modes: boolean[] = []
mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'u' } : null }, error: null }) } }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => db.client } })
mock.module('../src/lib/zernio.ts', { namedExports: { disconnectAccount: async () => { providerCalls++; return false } } })
mock.module('../src/lib/sutra-auto.ts', { namedExports: {
  publishAutoVideoRecord: async (_user: string, _video: string, _approval: boolean, _service: unknown, _publish?: unknown, _gateway?: unknown, readOnly = false) => {
    modes.push(readOnly); return { status: 'publishing', success: false }
  },
} })
mock.module('../src/lib/video-queue.ts', { namedExports: {
  reserveQuota: async () => { throw new Error('UNEXPECTED_GENERATION') },
  releaseQuota: async () => { throw new Error('UNEXPECTED_GENERATION') },
  enqueueJob: async () => { throw new Error('UNEXPECTED_GENERATION') },
} })
const { PATCH, DELETE } = await import('../src/app/api/auto/videos/[id]/route.ts')
const { DELETE: revoke } = await import('../src/app/api/social/accounts/route.ts')
const { GET: cron } = await import('../src/app/api/cron/sutra-auto/route.ts')
beforeEach(() => { db = socialDatabase(); authenticated = true; providerCalls = 0; modes.length = 0 })
const params = { params: Promise.resolve({ id: 'v' }) }
const req = (method: string, body = {}) => new Request('https://sutra-test.invalid/api', { method, ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}) })

test('T06 routes: session absente ne modifie ni compte ni production', async () => {
  authenticated = false
  assert.equal((await PATCH(req('PATCH', { status: 'ready' }), params)).status, 401)
  assert.equal((await DELETE(req('DELETE'), params)).status, 401)
  assert.equal((await revoke(req('DELETE', { accountId: crypto.randomUUID() }))).status, 401)
  assert.equal(providerCalls, 0)
})
test('T06 routes: partiel ne peut pas etre remis a ready ou supprime', async () => {
  db.auto.status = 'partially_published'
  assert.equal((await PATCH(req('PATCH', { status: 'ready' }), params)).status, 409)
  assert.equal((await DELETE(req('DELETE'), params)).status, 409)
  assert.equal(db.auto.status, 'partially_published')
})
test('T06 routes: occurrence non publiee conserve son identite de deduplication', async () => {
  Object.assign(db.auto, { schedule_id: 'daily' })
  assert.equal((await DELETE(req('DELETE'), params)).status, 409)
})
test('T06 routes: journal reserve avant projection interdit reset et suppression', async () => {
  db.tables.social_publication_journals.push({ kind: 'auto', production_id: 'v', user_id: 'u', operations: [{} as never] })
  assert.equal((await PATCH(req('PATCH', { status: 'pending_approval' }), params)).status, 409)
  assert.equal((await DELETE(req('DELETE'), params)).status, 409)
})
test('T06 routes: transition concurrente preserve publishing et refuse un faux acquittement', async () => {
  db.settings.hook = (table, mutation) => {
    if (table === 'sutra_auto_videos' && mutation) db.auto.status = 'publishing'
  }
  assert.equal((await PATCH(req('PATCH', { status: 'pending_approval' }), params)).status, 409)
  assert.equal(db.auto.status, 'publishing')
})
test('T06 routes: panne revoke distante rend 202 avec etat local revoque', async () => {
  const accountId = crypto.randomUUID(); db.accounts[0].id = accountId
  const result = await revoke(req('DELETE', { accountId }))
  assert.equal(result.status, 202); assert.equal((await result.json()).remoteStatus, 'unconfirmed')
  assert.equal(db.accounts[0].status, 'revoked'); assert.equal(providerCalls, 1); assert.equal(db.accounts.length, 2)
})
test('T06 routes: compte absent rend 404 et panne DB rend 503 sans revoke distant', async () => {
  const request = () => req('DELETE', { accountId: crypto.randomUUID() })
  assert.equal((await revoke(request())).status, 404)
  db.settings.failRead = true
  assert.equal((await revoke(request())).status, 503)
  assert.equal(providerCalls, 0)
})
test('T06 routes: cron desactive reconcilie en lecture seule sans travail de generation', async () => {
  db.config.is_active = false; db.auto.status = 'partially_published'
  const request = new Request('https://sutra-test.invalid/api/cron/sutra-auto', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
  assert.equal((await cron(request)).status, 200); assert.deepEqual(modes, [true]); assert.equal(providerCalls, 0)
})
test('T06 routes: cron sans autorisation ne lit ni ne soumet rien', async () => {
  assert.equal((await cron(req('GET'))).status, 401); assert.equal(modes.length, 0)
})
