import test, { mock } from 'node:test'
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
const { durableMediaUrl, ownedMediaPath } = await import('../src/lib/private-media.ts')
const { smarana } = await import('@purama/smarana')
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

test('Verification : sans historique aucun envoi, legende IA ou nouveau grant media, meme avec autoCaption', async () => {
  const h = harness()
  const privateUrl = durableMediaUrl(ownedMediaPath('final.mp4', user))
  h.db.video.video_url = privateUrl
  h.db.video.shotstack_json!.sutraVerification.url = privateUrl
  const beforeMedia = structuredClone(h.db.video.shotstack_json)
  const caption = mock.method(smarana, 'ask', async () => { throw new Error('UNEXPECTED_CAPTION_GENERATION') })
  const signingKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  // A new private-media grant would fail without the signing key. Reading
  // publication evidence must neither allocate that capability nor need its key.
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const outcome = await h.invoke({ reconcileOnly: true, autoCaption: true })
    assert.equal(outcome.status, 'publishing')
    assert.deepEqual(outcome.results.map(row => [row.localAccountId, row.accountId, row.status]), [
      [localA, externalA, 'unknown'], [localB, externalB, 'unknown'],
    ])
    assert.ok(outcome.results.every(row => row.error === 'SUTRA_PUBLICATION_EVIDENCE_REQUIRED'))
    assert.equal(caption.mock.callCount(), 0)
    assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
    assert.equal(h.db.tables.social_publication_journals[0].operations.length, 0)
    assert.equal(h.db.tables.social_posts.length + h.db.tables.scheduled_posts.length, 0)
    assert.equal(h.db.video.video_url, privateUrl)
    assert.deepEqual(h.db.video.shotstack_json, beforeMedia)
  } finally {
    caption.mock.restore()
    if (signingKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = signingKey
  }
})

test('Verification : repare les projections apres reponse perdue avec le GET historique meme apres revocation', async () => {
  const h = harness()
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'publishing') }
  await h.invoke({ destinations: [destinations[0]] })
  const original = structuredClone(h.calls.publish[0])
  h.db.video.publish_data = null
  h.db.tables.social_posts.length = 0
  h.db.tables.scheduled_posts.length = 0
  h.db.accounts[0].status = 'revoked'
  h.db.profile.access_revoked_at = new Date().toISOString()
  const outcome = await h.invoke({ destinations: [destinations[0]], reconcileOnly: true, caption: 'Changed browser text' })
  assert.equal(outcome.status, 'published')
  assert.deepEqual(h.calls.reconcile, [original])
  assert.deepEqual(h.calls.publish, [original])
  assert.equal(h.calls.retry.length + h.calls.replay.length, 0)
  assert.equal(outcome.results[0].localAccountId, localA)
  assert.equal(outcome.results[0].accountId, externalA)
  assert.equal(h.db.tables.social_posts[0].caption, original.caption)
  assert.equal(h.db.tables.social_posts[0].account_id, localA)
  assert.equal(h.db.tables.social_posts[0].status, 'published')
  assert.equal(h.db.tables.scheduled_posts[0].status, 'published')
  assert.deepEqual(h.db.video.publish_data, { status: 'published', sutraPublications: outcome.operations })
  assert.equal(outcome.operations[0].request.videoUrl, original.videoUrl)
})

test('Verification : un echec confirme ne declenche aucun retry', async () => {
  const h = harness()
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'failed') }
  h.gateway.reconcile = async (_id, request) => { h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed') }
  await h.invoke({ destinations: [destinations[0]] })
  const outcome = await h.invoke({ destinations: [destinations[0]], reconcileOnly: true })
  assert.equal(outcome.results[0].status, 'failed')
  assert.equal(h.calls.publish.length, 1)
  assert.equal(h.calls.reconcile.length, 1)
  assert.equal(h.calls.retry.length + h.calls.replay.length, 0)
})

test('Verification : reponse perdue sans postId reste inconnue et ne rejoue pas apres expiration du bail', async () => {
  const h = harness()
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); throw new Error('lost response') }
  await h.invoke({ destinations: [destinations[0]] })
  const original = structuredClone(h.calls.publish[0])
  h.advance(120001)
  const outcome = await h.invoke({ reconcileOnly: true })
  assert.deepEqual(h.calls, { publish: [original], replay: [], retry: [], reconcile: [] })
  assert.equal(outcome.results.find(row => row.localAccountId === localA)?.status, 'unknown')
  assert.equal(outcome.results.find(row => row.localAccountId === localB)?.status, 'unknown')
  assert.match(outcome.results.find(row => row.localAccountId === localB)?.error ?? '', /EVIDENCE_REQUIRED/)
  assert.equal(h.db.tables.social_publication_journals[0].operations.length, 1)
  assert.deepEqual(h.db.tables.social_publication_journals[0].operations[0].request, original)
})

for (const change of ['owner', 'url', 'hash', 'verification', 'journal-owner'] as const) {
  test(`Verification : refuse une identite ou un media different (${change}) avant GET fournisseur`, async () => {
    const h = harness()
    h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'publishing') }
    await h.invoke({ destinations: [destinations[0]] })
    if (change === 'owner') h.db.video.user_id = '99999999-9999-4999-8999-999999999999'
    if (change === 'url') {
      h.db.video.video_url = 'https://media.invalid/changed.mp4'
      h.db.video.shotstack_json!.sutraVerification.url = h.db.video.video_url
    }
    if (change === 'hash') h.db.video.shotstack_json!.sutraVerification.sha256 = 'b'.repeat(64)
    if (change === 'verification') h.db.video.shotstack_json = null
    if (change === 'journal-owner') h.db.tables.social_publication_journals[0].user_id = '99999999-9999-4999-8999-999999999999'
    await assert.rejects(() => h.invoke({ reconcileOnly: true }), change === 'owner' ? /VIDEO_NOT_FOUND/
      : change === 'verification' ? /MEDIA_VERIFICATION_REQUIRED/
        : change === 'journal-owner' ? /JOURNAL_INVALID/ : /MEDIA_CHANGED/)
    assert.equal(h.calls.publish.length, 1)
    assert.equal(h.calls.reconcile.length + h.calls.retry.length + h.calls.replay.length, 0)
  })
}

test('Verification : ancien statut publie sans identite de journal reste a rapprocher sans nouvelle publication', async () => {
  const h = harness()
  h.db.video.status = 'published'
  const outcome = await h.invoke({ reconcileOnly: true })
  assert.ok('reconciliationRequired' in outcome)
  assert.equal(outcome.reconciliationRequired, 'SUTRA_LEGACY_ACCOUNT_EVIDENCE_REQUIRED')
  assert.equal(outcome.results[0].status, 'unknown')
  assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
  assert.equal(h.db.tables.social_publication_journals.length + h.db.tables.social_posts.length, 0)
})

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

for (const observation of ['failed', 'unknown', 'missing', 'extra'] as const) {
  test(`Multicomptes : vrai adapter refuse un retry groupe avec observation ${observation} du succes confirme`, async () => {
    const h = harness()
    h.db.accounts[1].platform = 'instagram'
    const postId = '444444444444444444444444'
    const request: PublishRequest = {
      videoUrl: h.db.video.video_url, verifiedSha256: 'a'.repeat(64), caption: 'Approved legacy caption', hashtags: [],
      platforms: ['youtube', 'instagram'], accountIds: { youtube: externalA, instagram: externalB } as PublishRequest['accountIds'],
      idempotencyKey: 'legacy-observation',
    }
    h.db.video.publish_data = { sutraPublications: [{
      id: 'legacy-observation', fingerprint: 'pr3', phase: 'recorded', createdAt: new Date(h.gateway.now()).toISOString(),
      request, accountRows: { youtube: localA, instagram: localB }, results: [
        { platform: 'youtube', accountId: externalA, status: 'published', success: true, postId },
        { platform: 'instagram', accountId: externalB, status: 'failed', success: false, postId },
      ],
    }] }
    let healthy = false, posts = 0
    const retriedAccounts: string[] = []
    const previousFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      const pathname = new URL(String(url)).pathname
      let platforms = [
        { platform: 'youtube', accountId: externalA, status: healthy ? 'published' : observation },
        { platform: 'instagram', accountId: externalB, status: 'failed' },
      ]
      if (!healthy && observation === 'missing') platforms = platforms.slice(1)
      if (!healthy && observation === 'extra') {
        platforms[0].status = 'published'
        platforms.push({ platform: 'facebook', accountId: '666666666666666666666666', status: 'failed' })
      }
      if (options?.method === 'GET' && pathname === `/api/v1/posts/${postId}`) {
        return Response.json({ post: { _id: postId, status: 'partial', platforms } })
      }
      if (options?.method === 'POST' && pathname === `/api/v1/posts/${postId}/retry`) {
        posts++
        assert.equal(options.body, undefined, 'the provider retry contract has no account-subset request')
        retriedAccounts.push(...platforms.filter(platform => platform.status === 'failed').map(platform => platform.accountId))
        return Response.json({ post: { _id: postId, status: 'published', platforms: platforms.map(platform => ({ ...platform, status: 'published' })) } })
      }
      throw new Error('UNEXPECTED_NETWORK')
    }
    try {
      const selection = { videoId: 'v', platforms: ['instagram' as const], destinations: [{ platform: 'instagram' as const, accountId: localB }] }
      const blocked = await publishVideoRecord(user, selection, h.db.client)
      assert.equal(posts, 0)
      assert.equal(blocked.results.find(row => row.localAccountId === localA)?.status, 'published')
      const pending = blocked.results.find(row => row.localAccountId === localB)
      assert.equal(pending?.status, 'unknown')
      assert.match(pending?.error ?? '', /RECONCILIATION_REQUIRED.*groupe/)
      healthy = true
      assert.equal((await publishVideoRecord(user, selection, h.db.client)).status, 'published')
      assert.equal(posts, 1)
      assert.deepEqual(retriedAccounts, [externalB])
      assert.equal(h.db.tables.social_posts.length, 2)
    } finally { globalThis.fetch = previousFetch }
  })
}

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

for (const progress of ['publishing', 'scheduled'] as const) for (const path of ['retry-response', 'reconcile-after-timeout'] as const) {
  test(`Multicomptes : retry ${progress} par ${path} ne libere pas la barriere avant publication confirmee`, async () => {
    const h = harness()
    let remoteStatus: PublishResult['status'] = 'failed'
    h.gateway.publish = async request => {
      h.calls.publish.push(structuredClone(request)); return result(request, 'failed')
    }
    h.gateway.reconcile = async (_id, request) => {
      h.calls.reconcile.push(structuredClone(request)); return result(request, remoteStatus)
    }
    h.gateway.retry = async (_id, request) => {
      h.calls.retry.push(structuredClone(request))
      if (path === 'reconcile-after-timeout') throw new Error('lost retry response')
      return result(request, progress)
    }
    const selection = { destinations: [destinations[0]] }
    await h.invoke(selection)
    const retried = await h.invoke(selection)
    if (path === 'reconcile-after-timeout') {
      assert.equal(retried.results[0].status, 'unknown')
      remoteStatus = progress
      assert.equal((await h.invoke(selection)).results[0].status, progress)
    } else assert.equal(retried.results[0].status, progress)
    assert.equal(h.db.tables.social_publication_journals[0].operations[0].phase, 'retrying')
    remoteStatus = 'failed'
    const stale = await h.invoke(selection)
    assert.equal(stale.results[0].status, 'unknown')
    assert.match(stale.results[0].error ?? '', /RECONCILIATION_REQUIRED/)
    assert.equal(h.calls.retry.length, 1)
    remoteStatus = 'published'
    assert.equal((await h.invoke(selection)).status, 'published')
    assert.equal(h.db.tables.social_publication_journals[0].operations[0].phase, 'recorded')
    remoteStatus = 'failed'
    assert.equal((await h.invoke(selection)).status, 'published')
    assert.equal(h.calls.publish.length, 1)
    assert.equal(h.calls.retry.length, 1)
  })
}

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
