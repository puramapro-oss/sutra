import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.ZERNIO_API_KEY = 'test-only'
const user = '11111111-1111-4111-8111-111111111111'
process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'a'.repeat(24) })
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
afterEach(() => { globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') } })
const { publishToPlatforms, buildPublishPayload, parsePublicationResults } = await import('../src/lib/zernio.ts')
const { publishVideoRecord } = await import('../src/lib/social-publication.ts')
const accountId = '66b2e19d8c3f5a7e9d0b1c2d', postId = '65f1c0a9e2b5af0012ab34cd'
const request: PublishRequest = { videoUrl: 'https://media.invalid/final.mp4', caption: 'Caption', hashtags: ['tag'],
  platforms: ['youtube'], accountIds: { youtube: accountId } as PublishRequest['accountIds'], idempotencyKey: 'logical-post-1' }
const responsePost = (status: string, targetStatus: string) => ({ post: { _id: postId, status, platforms: [{ platform: 'youtube', accountId, status: targetStatus, platformPostUrl: 'https://youtube.com/watch?v=test' }] } })

test('Zernio contrat officiel /posts, content, mediaItems, compte externe et idempotence', async () => {
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(url, 'https://zernio.com/api/v1/posts')
    assert.equal(init?.method, 'POST'); assert.equal(new Headers(init?.headers).get('Idempotency-Key'), request.idempotencyKey)
    assert.equal(init?.redirect, 'error')
    const body = JSON.parse(init?.body as string)
    assert.equal(body.content, 'Caption\n\n#tag')
    assert.deepEqual(body.mediaItems, [{ type: 'video', url: request.videoUrl }])
    assert.deepEqual(body.platforms, [{ platform: 'youtube', accountId }]); assert.equal(body.publishNow, true)
    return Response.json(responsePost('published', 'published'), { status: 201 })
  }
  assert.equal((await publishToPlatforms(request))[0].success, true); assert.equal(calls, 1)
})
test('Zernio accepte 201 programme sans jamais annoncer publie', async () => {
  globalThis.fetch = async () => Response.json(responsePost('scheduled', 'pending'), { status: 201 })
  const result = await publishToPlatforms({ ...request, scheduledAt: '2099-01-01T12:00:00Z' })
  assert.equal(result[0].status, 'scheduled'); assert.equal(result[0].success, false)
})
test('Zernio convertit x en twitter et transmet chaque caption propre', () => {
  const payload = buildPublishPayload({ ...request, platforms: ['x'], accountIds: { x: accountId } as PublishRequest['accountIds'], captionsByPlatform: { x: { caption: 'X caption', hashtags: ['x'] } } })
  assert.deepEqual(payload.platforms, [{ platform: 'twitter', accountId, customContent: 'X caption\n\n#x' }])
})
test('Zernio refuse une echeance passee au lieu de publier immediatement', () => {
  assert.throws(() => buildPublishPayload({ ...request, scheduledAt: '2020-01-01T00:00:00Z' }), /SCHEDULE_MUST_BE_FUTURE/)
})
test('Zernio refuse UUID local, plateforme indisponible et cle absente avant appel', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected') }
  await assert.rejects(() => publishToPlatforms({ ...request, accountIds: { youtube: '00000000-0000-0000-0000-000000000001' } as PublishRequest['accountIds'] }), /RECONNECTION/)
  await assert.rejects(() => publishToPlatforms({ ...request, platforms: ['snapchat'] }), /PLATFORM_UNAVAILABLE/)
  await assert.rejects(() => publishToPlatforms({ ...request, idempotencyKey: undefined }), /IDEMPOTENCY_REQUIRED/)
  assert.equal(calls, 0)
})
test('Zernio succes pour un autre compte reste inconnu', () => {
  const data = responsePost('published', 'published'); data.post.platforms[0].accountId = '000000000000000000000000'
  assert.equal(parsePublicationResults(data, request)[0].status, 'unknown')
})
test('Zernio resultat partiel conserve toutes les destinations demandees', () => {
  const req = { ...request, platforms: ['youtube', 'instagram'] as PublishRequest['platforms'], accountIds: { youtube: accountId, instagram: '000000000000000000000002' } as PublishRequest['accountIds'] }
  const result = parsePublicationResults(responsePost('partial', 'published'), req)
  assert.equal(result.length, 2); assert.equal(result[0].success, true); assert.equal(result[1].status, 'unknown')
})
test('Zernio ancienne reponse success=true sans preuve n\'est pas acceptee', () => {
  assert.throws(() => parsePublicationResults({ results: [{ platform: 'youtube', success: true }] }, request), /RECONCILIATION/)
})
test('Zernio timeout ou HTTP 5xx ne devient jamais un echec rejouable', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({}, { status: 503 }) }
  await assert.rejects(() => publishToPlatforms(request), /RECONCILIATION_REQUIRED/); assert.equal(calls, 1)
})

import { socialDatabase as database } from './helpers/social-database.mts'
const input = { videoId: 'v', platforms: ['youtube'] as PublishRequest['platforms'] }
const published: PublishResult[] = [{ platform: 'youtube', success: true, status: 'published', postId, postUrl: 'https://youtube.com/watch?v=test' }]

test('Publication: proprietaire incorrect, media non pret et non verifie ne soumettent rien', async () => {
  const db = database(user); let calls = 0
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord('other', input, db.client, publish), /NOT_FOUND/)
  db.video.status = 'compositing'
  await assert.rejects(() => publishVideoRecord(user, input, db.client, publish), /NOT_READY/)
  db.video.status = 'ready'; db.video.shotstack_json = null
  await assert.rejects(() => publishVideoRecord(user, input, db.client, publish), /MEDIA_VERIFICATION_REQUIRED/)
  assert.equal(calls, 0)
})
test('Publication: deux requetes concurrentes, captions modifiees et replay ne dupliquent rien', async () => {
  const db = database(user); let calls = 0
  const publish = async (req: PublishRequest) => { calls++; assert.equal(req.accountIds.youtube, accountId); return published }
  await Promise.allSettled([publishVideoRecord(user, input, db.client, publish), publishVideoRecord(user, input, db.client, publish)])
  await publishVideoRecord(user, { ...input, caption: 'new caption' }, db.client, publish)
  assert.equal(calls, 1); assert.equal(db.tables.social_posts.length, 1); assert.equal(db.video.status, 'published')
})
test('Publication: timeout laisse une reservation, reprise exacte apres le bail', async () => {
  const db = database(user); let calls = 0, clock = Date.now(); let original: PublishRequest
  const publish = async (req: PublishRequest) => { calls++; original = structuredClone(req); throw new Error('lost response') }
  const gateway = { now: () => clock, replay: async (req: PublishRequest) => { assert.deepEqual(req, original); return published } }
  assert.equal((await publishVideoRecord(user, input, db.client, publish, undefined, gateway)).status, 'publishing')
  assert.equal((await publishVideoRecord(user, input, db.client, publish, undefined, gateway)).status, 'publishing')
  clock += 120001
  assert.equal((await publishVideoRecord(user, { ...input, caption: 'changed' }, db.client, publish, undefined, gateway)).success, true)
  assert.equal(calls, 1)
})
test('Publication: succes partiel, GET puis retry du seul compte en echec', async () => {
  const db = database(user); let posts = 0, retries = 0
  const both = { ...input, platforms: ['youtube', 'instagram'] as PublishRequest['platforms'] }
  const publish = async (req: PublishRequest): Promise<PublishResult[]> => { posts++; return req.platforms.map(platform => ({ platform, status: platform === 'youtube' ? 'published' : 'failed', success: platform === 'youtube', postId })) }
  assert.equal((await publishVideoRecord(user, both, db.client, publish)).status, 'partially_published')
  const reconcile = async (_id: string, req: PublishRequest): Promise<PublishResult[]> => req.platforms.map(platform => ({ platform, status: 'failed', success: false, postId }))
  const retry = async (_id: string, req: PublishRequest): Promise<PublishResult[]> => { retries++; assert.deepEqual(req.platforms, ['instagram']); return [{ platform: 'instagram', status: 'published', success: true, postId }] }
  assert.equal((await publishVideoRecord(user, both, db.client, publish, reconcile, { retry })).success, true)
  assert.equal(posts, 2); assert.equal(retries, 1); assert.equal(db.tables.social_posts.length, 2)
})
test('Publication: programmation puis reconciliation utilise GET sans POST supplementaire', async () => {
  const db = database(user); let posts = 0, gets = 0
  const schedule = { ...input, scheduledAt: '2099-01-01T12:00:00Z' }
  const publish = async () => { posts++; return [{ ...published[0], success: false, status: 'scheduled' as const }] }
  const reconcile = async () => { gets++; return published }
  assert.equal((await publishVideoRecord(user, schedule, db.client, publish, reconcile)).status, 'scheduled')
  assert.equal((await publishVideoRecord(user, schedule, db.client, publish, reconcile)).status, 'published')
  assert.equal(posts, 1); assert.equal(gets, 1)
})
test('Publication: echec DB apres fournisseur reprend avec cle originale, jamais une nouvelle creation', async () => {
  const db = database(user); db.settings.failFinal = true; let calls = 0, clock = Date.now()
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord(user, input, db.client, publish, undefined, { now: () => clock }), /RECONCILIATION/)
  db.settings.failFinal = false
  await publishVideoRecord(user, input, db.client, publish, undefined, { now: () => clock })
  assert.equal(calls, 1)
  clock += 120001
  assert.equal((await publishVideoRecord(user, input, db.client, publish, undefined, { now: () => clock, replay: async () => published })).success, true)
})
test('Publication: export concurrent conserve resultat distant sans marquer une nouvelle version publiee', async () => {
  const db = database(user)
  await assert.rejects(() => publishVideoRecord(user, input, db.client, async () => {
    db.video.video_url = 'https://media.invalid/revision-2.mp4'; return published
  }), /RECONCILIATION/)
  assert.equal(db.video.status, 'ready'); assert.equal(db.tables.social_publication_journals[0].operations[0].results?.[0].status, 'published')
})
test('Publication: historique secondaire reparable sans nouvelle publication', async () => {
  const db = database(user); db.settings.failHistory = true; let calls = 0
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord(user, input, db.client, publish), /RECONCILIATION/)
  db.settings.failHistory = false
  assert.equal((await publishVideoRecord(user, input, db.client, publish)).success, true)
  assert.equal(calls, 1); assert.equal(db.tables.social_posts.length, 1)
})
test('Publication: comptes absents/ambigus restent explicites, lecture en erreur ferme', async () => {
  const db = database(user); let calls = 0; const publish = async () => { calls++; return published }
  db.accounts.push({ ...db.accounts[0], id: 'second-account' })
  assert.match((await publishVideoRecord(user, input, db.client, publish)).results[0].error!, /ACCOUNT_SELECTION/)
  db.accounts.length = 0
  assert.equal((await publishVideoRecord(user, input, db.client, publish)).success, false)
  db.settings.failRead = true
  await assert.rejects(() => publishVideoRecord(user, input, db.client, publish), /READ_FAILED/)
  assert.equal(calls, 0)
})
test('Publication: les trois routes historiques partagent le handler', async () => {
  const canonical = await import('../src/app/api/social/publish/route.ts')
  assert.equal((await import('../src/app/api/publish/route.ts')).POST, canonical.POST)
  assert.equal((await import('../src/app/api/publish/social/route.ts')).POST, canonical.POST)
})

test('Zernio reconciliation refuse les destinations supplementaires avant tout retry', async () => {
  const { getPublicationResults } = await import('../src/lib/zernio.ts')
  globalThis.fetch = async () => Response.json({ post: { _id: postId, platforms: [
    { platform: 'youtube', accountId, status: 'failed' },
    { platform: 'instagram', accountId, status: 'failed' },
  ] } })
  await assert.rejects(() => getPublicationResults(postId, request), /destinations distantes incoherentes/)
})
test('Zernio statut distant ne propage pas un corps JSON invalide ou une erreur transport sensible', async () => {
  const { getPublicationResults } = await import('../src/lib/zernio.ts')
  globalThis.fetch = async () => new Response('synthetic-private-marker')
  await assert.rejects(() => getPublicationResults(postId, request), { message: 'SUTRA_ZERNIO_STATUS_INVALID_RESPONSE' })
  globalThis.fetch = async () => { throw new Error('synthetic-private-marker') }
  await assert.rejects(() => getPublicationResults(postId, request), { message: 'SUTRA_ZERNIO_STATUS_UNAVAILABLE' })
})
test('Zernio retry vise le post original une seule fois et ne recree jamais de post', async () => {
  const { retryPublication } = await import('../src/lib/zernio.ts'); const calls: string[] = []
  globalThis.fetch = async (url, options) => {
    calls.push(String(url)); assert.equal(options?.method, 'POST')
    return Response.json(responsePost('published', 'published'))
  }
  assert.equal((await retryPublication(postId, request))[0].success, true)
  assert.equal(calls.length, 1); assert.ok(calls[0].endsWith(`/posts/${postId}/retry`))
  globalThis.fetch = async () => { calls.push('timeout'); throw new Error('lost') }
  await assert.rejects(() => retryPublication(postId, request), /RECONCILIATION_REQUIRED/)
  assert.equal(calls.length, 2)
})
test('Zernio revoke 404 est idempotent et erreur sensible jamais loggee', async () => {
  const { disconnectAccount } = await import('../src/lib/zernio.ts')
  globalThis.fetch = async () => new Response(null, { status: 404 })
  assert.equal(await disconnectAccount('youtube', accountId), true)
  const old = console.error; const logged: unknown[][] = []
  console.error = (...values) => { logged.push(values) }
  globalThis.fetch = async () => { throw new Error('synthetic-private-marker') }
  try { assert.equal(await disconnectAccount('youtube', accountId), false) } finally { console.error = old }
  assert.doesNotMatch(JSON.stringify(logged), /synthetic-private-marker/)
})
