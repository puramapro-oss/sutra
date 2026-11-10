import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { socialDatabase } from './helpers/social-database.mts'
import type { VideoPublicationInput } from '../src/lib/social-publication.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
const user = '11111111-1111-4111-8111-111111111111'
const localA = '22222222-2222-4222-8222-222222222222'
const localB = '33333333-3333-4333-8333-333333333333'
const videoId = '44444444-4444-4444-8444-444444444444'
const destinations = [{ platform: 'youtube', accountId: localA }, { platform: 'youtube', accountId: localB }]
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
let db = socialDatabase(user), authenticated = true
let publicConfig: Record<string, unknown> = {}, configWrites = 0
const requests: Array<{ userId: string; input: VideoPublicationInput }> = []

// Reuse the account/ownership database fixture. Only config upserts need a small
// adapter because the existing journal fixture models array upserts by row id.
function configTable(table: string) {
  const row = table === 'social_autopilot_config' ? publicConfig : db.config as unknown as Record<string, unknown>
  const filters: Array<(candidate: Record<string, unknown>) => boolean> = []
  let changes: Record<string, unknown> | undefined
  const execute = () => {
    const matches = filters.every(filter => filter(row))
    if (!matches) return { data: null, error: null }
    if (changes) { configWrites++; Object.assign(row, structuredClone(changes)) }
    return { data: structuredClone(row), error: null }
  }
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push(candidate => candidate[key] === value); return builder },
    upsert: (value: Record<string, unknown>) => { changes = value; return builder },
    update: (value: Record<string, unknown>) => { changes = value; return builder },
    insert: (value: Record<string, unknown>) => { changes = value; return builder },
    single: async () => execute(), maybeSingle: async () => execute(),
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(execute).then(resolve, reject),
  }
  return builder
}
const service = {
  schema: () => service,
  from: (table: string) => ['social_autopilot_config', 'sutra_auto_config'].includes(table)
    ? configTable(table)
    : (db.client as unknown as { from: (name: string) => unknown }).from(table),
}
mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authenticated ? { id: user } : null }, error: null }) } }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => service } })
mock.module('../src/lib/social-publication.ts', { namedExports: {
  publishVideoRecord: async (userId: string, input: VideoPublicationInput) => {
    requests.push({ userId, input }); return { success: false, status: 'publishing', results: [] }
  },
} })
const { POST: publish } = await import('../src/app/api/social/publish/route.ts')
const { POST: socialConfig } = await import('../src/app/api/social/autopilot/route.ts')
const { PATCH: autoConfig } = await import('../src/app/api/auto/config/route.ts')

beforeEach(() => {
  db = socialDatabase(user); authenticated = true; requests.length = 0; configWrites = 0
  Object.assign(db.accounts[0], { id: localA })
  Object.assign(db.accounts[1], { id: localB, platform: 'youtube' })
  Object.assign(db.config, { publish_platforms: ['youtube'], publish_account_ids: [localA, localB] })
  publicConfig = { user_id: user, enabled: false, default_platforms: ['youtube'], publish_account_ids: [localA, localB] }
})
const request = (body: unknown, method = 'POST') => new Request('https://sutra-test.invalid/api', { method, body: JSON.stringify(body) })
const body = { videoId, platforms: ['youtube'], destinations }

test('API multicomptes : transmet les deux UUID d un meme reseau sans les ecraser', async () => {
  assert.equal((await publish(request(body))).status, 202)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].userId, user)
  assert.deepEqual(requests[0].input.destinations, destinations)
})

test('API multicomptes : conserve la selection legacy explicite d un seul compte', async () => {
  assert.equal((await publish(request({ videoId, platforms: ['youtube'], accountIds: { youtube: localA } }))).status, 202)
  assert.deepEqual(requests[0].input.accountIds, { youtube: localA })
})

for (const [name, invalid] of [
  ['deux modes de selection', { ...body, accountIds: { youtube: localA } }],
  ['plateforme ajoutee sans destination', { ...body, platforms: ['youtube', 'instagram'] }],
  ['destination hors des plateformes choisies', { ...body, platforms: ['instagram'] }],
  ['destination dupliquee', { ...body, destinations: [destinations[0], destinations[0]] }],
  ['liste vide', { ...body, destinations: [] }],
  ['identifiant fournisseur au lieu d UUID local', { ...body, destinations: [{ platform: 'youtube', accountId: '66b2e19d8c3f5a7e9d0b1c2d' }] }],
  ['plus de 50 comptes', { ...body, destinations: Array.from({ length: 51 }, (_, index) => ({ platform: 'youtube', accountId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` })) }],
] as const) {
  test(`API multicomptes : refuse ${name} avant publication`, async () => {
    assert.equal((await publish(request(invalid))).status, 400)
    assert.equal(requests.length, 0)
  })
}

test('API multicomptes : session absente ne publie ni ne modifie les deux configurations', async () => {
  authenticated = false
  assert.equal((await publish(request(body))).status, 401)
  assert.equal((await socialConfig(request({ enabled: true, default_platforms: ['youtube'], publish_account_ids: [localA] }))).status, 401)
  assert.equal((await autoConfig(request({ auto_publish: true, publish_platforms: ['youtube'], publish_account_ids: [localA] }, 'PATCH'))).status, 401)
  assert.equal(requests.length + configWrites, 0)
})

test('Configuration social : arret possible apres disparition d un compte, reactivation controlee', async () => {
  db.accounts.pop()
  const config = { default_platforms: ['youtube'], publish_account_ids: [localA, localB] }
  assert.equal((await socialConfig(request({ ...config, enabled: false }))).status, 200)
  assert.equal(publicConfig.enabled, false)
  assert.equal((await socialConfig(request({ ...config, enabled: true }))).status, 400)
  assert.equal(publicConfig.enabled, false)
  assert.equal(configWrites, 1)
})

for (const flag of ['auto_publish', 'is_active'] as const) {
  test(`Configuration auto : arret ${flag} possible apres disparition d un compte, reactivation controlee`, async () => {
    db.accounts.pop()
    const config = { publish_platforms: ['youtube'], publish_account_ids: [localA, localB] }
    assert.equal((await autoConfig(request({ ...config, [flag]: false }, 'PATCH'))).status, 200)
    assert.equal(db.config[flag], false)
    assert.equal((await autoConfig(request({ [flag]: true }, 'PATCH'))).status, 400)
    assert.equal(db.config[flag], false)
    assert.equal(configWrites, 1)
  })
}

for (const target of ['social', 'auto'] as const) {
  const save = (ids: string[], platforms = ['youtube']) => target === 'social'
    ? socialConfig(request({ enabled: true, default_platforms: platforms, publish_account_ids: ids }))
    : autoConfig(request({ auto_publish: true, publish_platforms: platforms, publish_account_ids: ids }, 'PATCH'))

  test(`Configuration ${target} : enregistre les deux comptes possedes du meme reseau`, async () => {
    assert.equal((await save([localA, localB])).status, 200)
    const current = target === 'social' ? publicConfig : db.config as unknown as Record<string, unknown>
    assert.deepEqual(current.publish_account_ids, [localA, localB])
    assert.equal(configWrites, 1)
  })

  for (const reason of ['foreign', 'disconnected', 'platform', 'empty'] as const) {
    test(`Configuration ${target} : refuse un mandat ${reason} sans le sauvegarder`, async () => {
      if (reason === 'foreign') db.accounts[1].user_id = '99999999-9999-4999-8999-999999999999'
      if (reason === 'disconnected') db.accounts[1].status = 'disconnected'
      const response = await save(reason === 'empty' ? [] : [localA, localB], reason === 'platform' ? ['instagram'] : ['youtube'])
      assert.ok(response.status >= 400 && response.status < 500, `expected validation rejection, received ${response.status}`)
      assert.equal(configWrites, 0)
    })
  }
}
