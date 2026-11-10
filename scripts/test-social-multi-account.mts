import test from 'node:test'
import assert from 'node:assert/strict'
import { socialDatabase, accountId as externalA, secondAccount as externalB } from './helpers/social-database.mts'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'
import type { PublicationGateway } from '../src/lib/publication-journal.ts'
import type { VideoPublicationInput } from '../src/lib/social-publication.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.ZERNIO_API_KEY = 'test-only'
const user = '11111111-1111-4111-8111-111111111111'
const localA = '22222222-2222-4222-8222-222222222222'
const localB = '33333333-3333-4333-8333-333333333333'
process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'a'.repeat(24) })
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

const { publishVideoRecord } = await import('../src/lib/social-publication.ts')
const { publishAutoVideoRecord } = await import('../src/lib/auto-publication.ts')
const destinations = [
  { platform: 'youtube' as const, accountId: localA },
  { platform: 'youtube' as const, accountId: localB },
]
const input = { videoId: 'v', platforms: ['youtube'], destinations } satisfies VideoPublicationInput

function result(request: PublishRequest, status: PublishResult['status'] = 'published'): PublishResult[] {
  return request.platforms.map(platform => ({
    platform, accountId: request.accountIds[platform], status, success: status === 'published',
    postId: request.accountIds[platform] === externalA ? '444444444444444444444444' : '555555555555555555555555',
  }))
}

function harness() {
  const db = socialDatabase(user)
  Object.assign(db.accounts[0], { id: localA })
  Object.assign(db.accounts[1], { id: localB, platform: 'youtube' })
  const config = Object.assign(db.config, { publish_platforms: ['youtube'], publish_account_ids: [localA, localB] })
  let now = Date.now()
  const calls = { publish: [] as PublishRequest[], replay: [] as PublishRequest[], retry: [] as PublishRequest[], reconcile: [] as PublishRequest[] }
  const gateway: PublicationGateway = {
    now: () => now,
    publish: async request => { calls.publish.push(structuredClone(request)); return result(request) },
    replay: async request => { calls.replay.push(structuredClone(request)); return result(request) },
    retry: async (_id, request) => { calls.retry.push(structuredClone(request)); return result(request) },
    reconcile: async (_id, request) => { calls.reconcile.push(structuredClone(request)); return result(request) },
  }
  const invoke = (extra: Partial<VideoPublicationInput> = {}) => publishVideoRecord(user, { ...input, ...extra }, db.client, gateway.publish, gateway.reconcile, gateway)
  const auto = (explicitApproval = false, reconcileOnly = false, videoId = 'v') => publishAutoVideoRecord(user, videoId, explicitApproval, db.client, undefined, gateway, reconcileOnly)
  return { db, config, gateway, calls, invoke, auto, advance: (milliseconds: number) => { now += milliseconds } }
}

test('Multicomptes : deux chaines YouTube produisent deux operations et deux historiques distincts', async () => {
  const h = harness()
  const outcome = await h.invoke()
  assert.equal(outcome.status, 'published')
  assert.equal(h.calls.publish.length, 2)
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA, externalB])
  assert.ok(h.calls.publish.every(request => request.platforms.length === 1))
  assert.equal(new Set(h.calls.publish.map(request => request.idempotencyKey)).size, 2)
  assert.deepEqual(outcome.results.map(row => [row.localAccountId, row.accountId]), [[localA, externalA], [localB, externalB]])
  assert.equal(new Set(h.db.tables.social_posts.map(row => row.id)).size, 2)
  assert.deepEqual(h.db.tables.social_posts.map(row => row.account_id), [localA, localB])
  assert.equal(h.db.tables.scheduled_posts.length, 2)
})

test('Multicomptes : selection explicite limite l envoi a une seule chaine du reseau', async () => {
  const h = harness()
  await h.invoke({ destinations: [destinations[1]] })
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalB])
  assert.equal(h.db.tables.social_posts[0].account_id, localB)
})

test('Multicomptes : deux demandes concurrentes aboutissent a un seul envoi par chaine', async () => {
  const h = harness()
  await Promise.allSettled([h.invoke(), h.invoke()])
  assert.equal((await h.invoke()).status, 'published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube).sort(), [externalA, externalB].sort())
  assert.equal(h.db.tables.social_publication_journals[0].operations.length, 2)
})

test('Multicomptes : ancien appel par reseau ambigu ne choisit aucune chaine arbitrairement', async () => {
  const h = harness()
  const outcome = await h.invoke({ destinations: undefined })
  assert.equal(outcome.success, false)
  assert.match(outcome.results[0].error ?? '', /ACCOUNT_SELECTION_REQUIRED/)
  assert.equal(h.calls.publish.length, 0)
})

test('Multicomptes : UUID d un autre proprietaire ne donne aucun droit de publication', async () => {
  const h = harness()
  h.db.accounts[1].user_id = '99999999-9999-4999-8999-999999999999'
  const outcome = await h.invoke({ destinations: [destinations[1]] })
  assert.equal(outcome.success, false)
  assert.equal(outcome.results[0].localAccountId, localB)
  assert.match(outcome.results[0].error ?? '', /ACCOUNT_SELECTION_REQUIRED/)
  assert.equal(h.calls.publish.length, 0)
})

test('Multicomptes : compte indisponible reste identifiable a cote du succes du meme reseau', async () => {
  const h = harness()
  h.db.accounts[1].status = 'disconnected'
  const outcome = await h.invoke()
  assert.equal(outcome.status, 'partially_published')
  assert.equal(outcome.results.find(row => row.localAccountId === localA)?.success, true)
  assert.equal(outcome.results.find(row => row.localAccountId === localB)?.success, false)
  assert.equal(h.calls.publish.length, 1)
  h.db.accounts[1].status = 'connected'
  assert.equal((await h.invoke()).status, 'published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA, externalB])
})

test('Multicomptes : echec de B reprend B, le succes de A ne provoque aucun nouvel envoi', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    return result(request, request.accountIds.youtube === externalA ? 'published' : 'failed')
  }
  h.gateway.reconcile = async (_id, request) => {
    h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed')
  }
  assert.equal((await h.invoke()).status, 'partially_published')
  assert.equal((await h.invoke({ destinations: [...destinations].reverse() })).status, 'published')
  assert.equal(h.calls.publish.length, 2)
  assert.deepEqual(h.calls.reconcile.map(request => request.accountIds.youtube), [externalB])
  assert.deepEqual(h.calls.retry.map(request => request.accountIds.youtube), [externalB])
  assert.equal(h.db.tables.social_posts.length, 2)
})

test('Multicomptes : ancien groupe publie sur A reprend B seule sans recreer la publication', async () => {
  const h = harness()
  h.db.accounts[1].platform = 'instagram'
  const postId = '444444444444444444444444'
  const request: PublishRequest = {
    videoUrl: h.db.video.video_url, verifiedSha256: 'a'.repeat(64), caption: 'Legacy approved caption', hashtags: [],
    platforms: ['youtube', 'instagram'], accountIds: { youtube: externalA, instagram: externalB } as PublishRequest['accountIds'],
    idempotencyKey: 'legacy-group',
  }
  const prior: PublishResult[] = [
    { platform: 'youtube', accountId: externalA, status: 'published', success: true, postId },
    { platform: 'instagram', accountId: externalB, status: 'failed', success: false, postId },
  ]
  h.db.video.publish_data = { sutraPublications: [{
    id: 'legacy-group', fingerprint: 'pr3', phase: 'recorded', createdAt: new Date(h.gateway.now()).toISOString(),
    request, accountRows: { youtube: localA, instagram: localB }, results: prior,
  }] }
  h.gateway.reconcile = async (id, original) => {
    assert.equal(id, postId); assert.deepEqual(original, request)
    h.calls.reconcile.push(structuredClone(original)); return prior
  }
  h.gateway.retry = async (id, original) => {
    assert.equal(id, postId); assert.deepEqual(original, request)
    h.calls.retry.push(structuredClone(original))
    return prior.map(row => ({ ...row, status: 'published', success: true }))
  }
  const outcome = await h.invoke({ platforms: ['instagram'], destinations: [{ platform: 'instagram', accountId: localB }] })
  assert.equal(outcome.status, 'published')
  assert.equal(h.calls.publish.length, 0)
  assert.equal(h.calls.retry.length, 1)
  assert.equal(outcome.results.find(row => row.localAccountId === localA)?.success, true)
  assert.equal(outcome.results.find(row => row.localAccountId === localB)?.success, true)
  assert.equal(h.db.tables.social_posts.length, 2)
})

test('Multicomptes : profil obsolete de B conserve le resultat partiel et l historique confirme de A', async () => {
  const h = harness()
  h.db.accounts[1].metadata = { ...h.db.accounts[1].metadata, zernio_profile_id: 'b'.repeat(24) }
  const outcome = await h.invoke()
  assert.equal(outcome.status, 'partially_published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA])
  assert.equal(outcome.results.find(row => row.localAccountId === localA)?.status, 'published')
  const blocked = outcome.results.find(row => row.localAccountId === localB)
  assert.equal(blocked?.status, 'failed')
  assert.equal(blocked?.success, false)
  assert.match(blocked?.error ?? '', /SOCIAL_PROFILE_RECONNECTION_REQUIRED/)
  assert.equal(h.db.tables.social_posts.length, 1)
  assert.equal(h.db.tables.social_posts[0].account_id, localA)
  assert.equal(h.db.tables.social_posts[0].status, 'published')
  assert.equal(h.db.video.publish_data?.sutraPublications[0].results?.[0].status, 'published')
})

for (const retryResponse of ['lost', 'unknown', 'stale_failed'] as const) test(`Multicomptes : retry ${retryResponse} reste inconnu meme si GET retourne encore ancien failed`, async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request)); return result(request, 'failed')
  }
  h.gateway.reconcile = async (_id, request) => {
    h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed')
  }
  h.gateway.retry = async (_id, request) => {
    h.calls.retry.push(structuredClone(request))
    if (retryResponse === 'lost') throw new Error('lost retry response')
    return result(request, retryResponse === 'unknown' ? 'unknown' : 'failed')
  }
  const selection = { destinations: [destinations[0]] }
  assert.equal((await h.invoke(selection)).status, 'failed')
  const afterTimeout = await h.invoke(selection)
  assert.equal(afterTimeout.status, 'publishing')
  assert.equal(afterTimeout.results[0].status, 'unknown')
  const afterStaleRead = await h.invoke(selection)
  assert.equal(afterStaleRead.status, 'publishing')
  assert.equal(afterStaleRead.results[0].status, 'unknown')
  assert.equal(h.calls.retry.length, 1)
  assert.equal(h.calls.publish.length, 1)
  assert.equal(h.db.tables.social_publication_journals[0].operations[0].phase, 'retrying')
})

test('Multicomptes : timeout de B rejoue la requete immuable de B avec sa cle, sans reposter A', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    if (request.accountIds.youtube === externalB) throw new Error('lost response')
    return result(request)
  }
  assert.equal((await h.invoke()).status, 'partially_published')
  await h.invoke()
  assert.equal(h.calls.replay.length, 0)
  h.advance(120001)
  const outcome = await h.invoke({ caption: 'Replacement must not change a claimed request', destinations: [...destinations].reverse() })
  assert.equal(outcome.status, 'published')
  assert.equal(h.calls.publish.length, 2)
  assert.deepEqual(h.calls.replay, [h.calls.publish[1]])
})

test('Multicomptes : une reprise legacy devenue ambigue ne rejoue aucune chaine arbitrairement', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    if (request.accountIds.youtube === externalB) throw new Error('lost response')
    return result(request)
  }
  await h.invoke()
  h.advance(120001)
  const outcome = await h.invoke({ destinations: undefined })
  assert.equal(outcome.status, 'partially_published')
  assert.equal(h.calls.replay.length, 0)
  assert.equal(h.calls.publish.length, 2)
  assert.equal(outcome.results.find(row => row.localAccountId === localB)?.status, 'unknown')
})

test('Multicomptes : selection A seule ne relance pas l ancienne operation en echec de B', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    return result(request, request.accountIds.youtube === externalA ? 'published' : 'failed')
  }
  h.gateway.reconcile = async (_id, request) => result(request, 'failed')
  await h.invoke()
  const outcome = await h.invoke({ destinations: [destinations[0]] })
  assert.equal(outcome.status, 'partially_published')
  assert.equal(h.calls.retry.length, 0)
  assert.equal(h.calls.publish.length, 2)
})

test('Multicomptes : revocation de B apres reservation bloque seulement son POST', async () => {
  const h = harness()
  h.db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.some(operation => operation.accountRows.youtube === localB)) {
      h.db.accounts[1].status = 'revoked'
    }
  }
  const outcome = await h.invoke()
  assert.equal(outcome.status, 'partially_published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA])
  assert.match(outcome.results.find(row => row.localAccountId === localB)?.error ?? '', /REVOKED/)
})

test('Multicomptes : ajouter explicitement B a une production publiee ne reposte pas A', async () => {
  const h = harness()
  await h.invoke({ destinations: [destinations[0]] })
  await h.invoke()
  await h.invoke()
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA, externalB])
  assert.equal(h.db.tables.social_posts.length, 2)
})

test('Autopilote multicomptes : nouvelle chaine connectee absente du mandat reste exclue', async () => {
  const h = harness()
  h.config.publish_account_ids = [localA]
  const second = h.db.accounts.pop()!
  assert.equal((await h.auto()).status, 'published')
  h.db.accounts.push(second)
  Object.assign(h.db.auto, { id: 'v-new', status: 'ready', published_platforms: [] })
  assert.equal((await h.auto(false, false, 'v-new')).status, 'published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA, externalA])
})

test('Autopilote multicomptes : liste vide n autorise pas les comptes du reseau par defaut', async () => {
  const h = harness()
  h.config.publish_account_ids = []
  await assert.rejects(() => h.auto(), /SUTRA_.*(?:ACCOUNT|DESTINATION)/)
  assert.equal(h.calls.publish.length, 0)
})

test('Autopilote multicomptes : retirer B du mandat apres reservation empeche son POST', async () => {
  const h = harness()
  h.db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.some(operation => operation.accountRows.youtube === localB)) {
      h.config.publish_account_ids = [localA]
    }
  }
  const outcome = await h.auto()
  assert.equal(outcome.status, 'partially_published')
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [externalA])
  assert.match(outcome.results.find(row => row.localAccountId === localB)?.error ?? '', /DESTINATION_REVOKED/)
})

test('Autopilote multicomptes : retirer B conserve son resultat et interdit le retry de B', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    return result(request, request.accountIds.youtube === externalA ? 'published' : 'failed')
  }
  h.gateway.reconcile = async (_id, request) => {
    h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed')
  }
  assert.equal((await h.auto(true)).status, 'partially_published')
  h.config.publish_account_ids = [localA]
  const outcome = await h.auto(true)
  assert.equal(outcome.status, 'partially_published')
  assert.equal(h.calls.retry.length, 0)
  assert.equal(h.calls.publish.length, 2)
  assert.equal(outcome.results.find(row => row.localAccountId === localA)?.success, true)
  assert.equal(outcome.results.find(row => row.localAccountId === localB)?.status, 'failed')
})
