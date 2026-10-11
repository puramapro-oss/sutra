import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.ZERNIO_API_KEY = 'test-only'
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

type Row = Record<string, unknown>
function database() {
  const video: Row = { id: 'v', user_id: 'u', status: 'ready', video_url: request.videoUrl, title: 'Title', description: 'Description', tags: [], publish_data: null,
    shotstack_json: { sutraVerification: { url: request.videoUrl, sha256: 'a'.repeat(64) } } }
  const accounts: Row[] = [{ id: 'local-y', user_id: 'u', platform: 'youtube', external_id: accountId, status: 'connected' },
    { id: 'local-i', user_id: 'u', platform: 'instagram', external_id: '000000000000000000000002', status: 'connected' }]
  const history = new Map<string, Row>()
  const settings = { failFinal: false, failHistory: false, failRead: false }
  const client = { schema: () => client, from: (table: string) => {
    const filters: Array<[string, unknown]> = []
    let update: Row | undefined, inserts: Row[] | undefined
    const execute = () => {
      if (inserts) {
        if (settings.failHistory) return { data: null, error: { message: 'history unavailable' } }
        for (const row of inserts) history.set(`${table}:${row.id}`, structuredClone(row))
        return { data: null, error: null }
      }
      const matches = (row: Row) => filters.every(([key, value]) => ['publish_data', 'shotstack_json'].includes(key)
        ? isDeepStrictEqual(row[key], typeof value === 'string' ? JSON.parse(value) : value)
        : Array.isArray(value) ? value.includes(row[key]) : row[key] === value)
      if (table === 'social_accounts') return { data: accounts.filter(matches).map(a => structuredClone(a)), error: null }
      if (settings.failRead && !update) return { data: null, error: { message: 'db unavailable' } }
      if (!matches(video)) return { data: null, error: null }
      if (update) {
        if (settings.failFinal && (update.publish_data as { sutraPublications: Array<{ phase: string }> }).sutraPublications.at(-1)?.phase === 'recorded') return { data: null, error: { message: 'db unavailable' } }
        Object.assign(video, JSON.parse(JSON.stringify(update)))
      }
      return { data: structuredClone(video), error: null }
    }
    const builder = { select: () => builder, eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
      is: (key: string, value: unknown) => { filters.push([key, value]); return builder },
      in: (key: string, values: unknown[]) => { filters.push([key, values]); return builder },
      update: (value: Row) => { update = value; return builder }, upsert: (value: Row[]) => { inserts = value; return builder },
      maybeSingle: async () => execute(), then: (resolve: (value: unknown) => void) => Promise.resolve(execute()).then(resolve) }
    return builder
  } }
  return { client: client as never, video, accounts, history, settings }
}
const input = { videoId: 'v', platforms: ['youtube'] as PublishRequest['platforms'] }
const published: PublishResult[] = [{ platform: 'youtube', success: true, status: 'published', postId, postUrl: 'https://youtube.com/watch?v=test' }]

test('Publication: proprietaire incorrect et video non prete ne soumettent rien', async () => {
  const db = database(); let calls = 0
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord('other', input, db.client, publish), /NOT_FOUND/)
  db.video.status = 'compositing'
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /NOT_READY/)
  assert.equal(calls, 0)
})
test('Publication: une ancienne video ready sans preuve du fichier final est bloquee', async () => {
  const db = database(); let calls = 0
  db.video.shotstack_json = null
  await assert.rejects(() => publishVideoRecord('u', input, db.client, async () => { calls++; return published }), /MEDIA_VERIFICATION_REQUIRED/)
  assert.equal(calls, 0)
})
test('Zernio HTTP 207 conserve le succes et l\'echec de chaque compte', async () => {
  const secondId = '000000000000000000000002'
  globalThis.fetch = async () => Response.json({ post: { _id: postId, status: 'partial', platforms: [
    { platform: 'youtube', accountId, status: 'published' }, { platform: 'instagram', accountId: secondId, status: 'failed' },
  ] } }, { status: 207 })
  const results = await publishToPlatforms({ ...request, platforms: ['youtube', 'instagram'], accountIds: { youtube: accountId, instagram: secondId } as PublishRequest['accountIds'] })
  assert.deepEqual(results.map(r => [r.status, r.success]), [['published', true], ['failed', false]])
})
test('Publication: deux requetes simultanees ne soumettent qu\'une fois', async () => {
  const db = database(); let calls = 0
  const publish = async (req: PublishRequest) => { calls++; assert.equal(req.accountIds.youtube, accountId); return published }
  const results = await Promise.allSettled([publishVideoRecord('u', input, db.client, publish), publishVideoRecord('u', input, db.client, publish)])
  assert.equal(calls, 1); assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  await publishVideoRecord('u', input, db.client, publish)
  assert.equal(calls, 1); assert.equal(db.history.size, 2); assert.equal(db.video.status, 'published')
})
test('Publication: timeout apres soumission laisse une reservation qui bloque les doublons', async () => {
  const db = database(); let calls = 0
  const publish = async () => { calls++; throw new Error('lost response') }
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish))
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /RECONCILIATION/)
  assert.equal(calls, 1); assert.equal(db.video.status, 'ready')
})
test('Publication: succes partiel ne marque pas la video entierement publiee', async () => {
  const db = database()
  const result = await publishVideoRecord('u', { ...input, platforms: ['youtube', 'instagram'] }, db.client, async () => [...published,
    { platform: 'instagram', success: false, status: 'failed', postId, error: 'refused' }])
  assert.equal(result.status, 'partially_published'); assert.equal(result.success, false); assert.equal(db.video.status, 'ready')
  assert.equal([...db.history.values()].filter(row => row.status === 'failed').length, 2)
})
test('Publication: programmation puis reconciliation utilise GET sans nouvelle soumission', async () => {
  const db = database(); let posts = 0, gets = 0
  const schedule = { ...input, scheduledAt: '2099-01-01T12:00:00Z' }
  const publish = async () => { posts++; return [{ ...published[0], success: false, status: 'scheduled' as const }] }
  const reconcile = async () => { gets++; return published }
  assert.equal((await publishVideoRecord('u', schedule, db.client, publish, reconcile)).status, 'scheduled')
  assert.equal(db.video.status, 'ready')
  assert.equal((await publishVideoRecord('u', schedule, db.client, publish, reconcile)).status, 'published')
  assert.equal(posts, 1); assert.equal(gets, 1)
})
test('Publication: echec DB apres fournisseur bloque la resoumission', async () => {
  const db = database(); db.settings.failFinal = true; let calls = 0
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /RECONCILIATION/)
  db.settings.failFinal = false
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /RECONCILIATION/)
  assert.equal(calls, 1)
})
test('Publication: un export concurrent ne fait pas passer la nouvelle version a published', async () => {
  const db = database()
  await assert.rejects(() => publishVideoRecord('u', input, db.client, async () => {
    db.video.video_url = 'https://media.invalid/revision-2.mp4'
    return published
  }), /RECONCILIATION/)
  assert.equal(db.video.status, 'ready')
})
test('Publication: historique secondaire reparable sans nouvelle publication', async () => {
  const db = database(); db.settings.failHistory = true; let calls = 0
  const publish = async () => { calls++; return published }
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /RECONCILIATION/)
  db.settings.failHistory = false
  assert.equal((await publishVideoRecord('u', input, db.client, publish)).success, true)
  assert.equal(calls, 1); assert.equal(db.history.size, 2)
})
test('Publication: comptes absents/ambigus et lecture en erreur bloquent avant soumission', async () => {
  const db = database(); let calls = 0; const publish = async () => { calls++; return published }
  db.accounts.push({ ...db.accounts[0], id: 'second-account' })
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /ACCOUNT_SELECTION/)
  db.accounts.length = 0
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /ACCOUNT_SELECTION/)
  db.settings.failRead = true
  await assert.rejects(() => publishVideoRecord('u', input, db.client, publish), /READ_FAILED/)
  assert.equal(calls, 0)
})
test('Publication: les trois routes historiques appellent exactement le meme handler', async () => {
  const canonical = await import('../src/app/api/social/publish/route.ts')
  assert.equal((await import('../src/app/api/publish/route.ts')).POST, canonical.POST)
  assert.equal((await import('../src/app/api/publish/social/route.ts')).POST, canonical.POST)
})
