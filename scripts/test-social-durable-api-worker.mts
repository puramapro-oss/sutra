import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { socialDatabase } from './helpers/social-database.mts'
import type { PublicationOperation } from '../src/lib/publication-journal.ts'
import type { publishVideoRecord } from '../src/lib/social-publication.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_PROVIDER_NETWORK') }
const owner = '11111111-1111-4111-8111-111111111111'
const videoId = '22222222-2222-4222-8222-222222222222'
const localId = '33333333-3333-4333-8333-333333333333'
const otherId = '44444444-4444-4444-8444-444444444444'
const remote = 'a'.repeat(24)
const operations = (): PublicationOperation[] => [localId, otherId].map((id, index) => ({
  id: randomUUID(), phase: 'queued', createdAt: new Date().toISOString(), dispatchRequested: true,
  request: { videoUrl: 'https://private.invalid/video', providerMediaUrl: 'https://signed.invalid/private-token',
    verifiedSha256: 'b'.repeat(64), caption: 'Frozen caption', hashtags: [], platforms: ['youtube'],
    accountIds: { youtube: index ? 'c'.repeat(24) : remote } as PublicationOperation['request']['accountIds'], idempotencyKey: randomUUID() },
  accountRows: { youtube: id },
}))
let db = socialDatabase(owner)
let authenticated = true
let accepted = operations()
let invocations: unknown[][] = []
mock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: authenticated ? { id: owner } : null }, error: null }) },
}) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => db.client } })
mock.module('../src/lib/social-publication.ts', { namedExports: {
  publishVideoRecord: async (...args: unknown[]) => { invocations.push(args); return {
    success: false, status: 'publishing', hasPending: true, operations: accepted, results: [],
  } },
} })
const { POST, GET } = await import('../src/app/api/social/publish/route.ts')
const { POST: cron } = await import('../src/app/api/cron/social-worker/route.ts')
const { drainSocialPublications } = await import('../src/lib/social-publication-worker.ts')
const { durablePublicationReceipt } = await import('../src/lib/social-publication-receipt.ts')

beforeEach(() => { db = socialDatabase(owner); authenticated = true; accepted = operations(); invocations = []; delete process.env.CRON_SECRET })
const body = () => ({ videoId, platforms: ['youtube'], destinations: [localId, otherId].map(accountId => ({ platform: 'youtube', accountId })) })
const post = (input: unknown) => POST(new Request('https://sutra-test.invalid/api/social/publish', { method: 'POST', body: JSON.stringify(input) }))
const get = (query = `videoId=${videoId}`) => GET(new Request(`https://sutra-test.invalid/api/social/publish?${query}`))
const persist = (user = owner) => db.tables.social_publication_journals.push({ kind: 'video', production_id: videoId,
  user_id: user, operations: structuredClone(accepted), dispatch_enabled: true, revision: 1 })

test('admission exposes every exact destination and uses only enqueue mode', async () => {
  const response = await post({ ...body(), execution: { mode: 'drain' }, leaseToken: randomUUID() })
  assert.equal(response.status, 202)
  const receipt = await response.json()
  assert.equal(receipt.durable, true)
  assert.equal(receipt.batchId, videoId)
  assert.equal(receipt.hasPending, true)
  assert.deepEqual(receipt.destinations, body().destinations)
  assert.deepEqual(receipt.results.map((result: { deliveryState: string }) => result.deliveryState), ['queued', 'queued'])
  assert.deepEqual(invocations[0][7], { mode: 'enqueue' })
  assert.equal(Object.hasOwn(invocations[0][1] as object, 'execution'), false)
  assert.match(response.headers.get('cache-control')!, /private, no-store/)
  assert.doesNotMatch(JSON.stringify(receipt), /signed.invalid|private-token|Frozen caption|idempotencyKey|lease_token|providerMediaUrl/)
})

test('one success plus one queued destination remains HTTP202', async () => {
  accepted[0].phase = 'recorded'
  accepted[0].results = [{ platform: 'youtube', status: 'published', success: true, accountId: remote, postId: 'd'.repeat(24) }]
  const response = await post(body())
  const receipt = await response.json()
  assert.equal(response.status, 202)
  assert.equal(receipt.status, 'partially_published')
  assert.equal(receipt.hasPending, true)
})

test('reload reads only the owned durable journal without executing publication', async () => {
  persist()
  const response = await get()
  assert.equal(response.status, 200)
  const receipt = await response.json()
  assert.equal(receipt.results.length, 2)
  assert.equal(invocations.length, 0)
  assert.match(response.headers.get('cache-control')!, /no-store/)
})

test('read-only POST compatibility also reads durable state without calling the sender', async () => {
  persist()
  const response = await post({ ...body(), reconcileOnly: true })
  assert.equal(response.status, 202)
  assert.equal((await response.json()).durable, true)
  assert.equal(invocations.length, 0)
})

test('unknown or foreign journals remain absent; no new work is inferred', async () => {
  assert.equal((await get()).status, 404)
  persist(randomUUID())
  assert.equal((await get()).status, 404)
  assert.equal(invocations.length, 0)
})

test('authentication, exact ID and storage failure are enforced for status', async () => {
  authenticated = false
  assert.equal((await get()).status, 401)
  assert.equal((await post(body())).status, 401)
  authenticated = true
  assert.equal((await get('videoId=bad')).status, 400)
  assert.equal((await get(`videoId=${videoId}&videoId=${videoId}`)).status, 400)
  db.settings.failRead = true
  assert.equal((await get()).status, 503)
  assert.equal(invocations.length, 0)
})

test('an explicit retry action is advertised only for fenced, confirmed failures', () => {
  accepted[0].phase = 'recorded'
  accepted[0].results = [{ platform: 'youtube', status: 'failed', success: false, postId: 'd'.repeat(24) }]
  assert.equal(durablePublicationReceipt(videoId, accepted).results[0].canRequestRetry, true)
  accepted[0].phase = 'retrying'
  assert.equal(durablePublicationReceipt(videoId, accepted).results[0].canRequestRetry, false)
  accepted[0].phase = 'recorded'
  accepted[0].results[0].status = 'unknown'
  assert.equal(durablePublicationReceipt(videoId, accepted).results[0].canRequestRetry, false)
})

test('a queued retry is pending until its explicit command is consumed', async () => {
  accepted[0].phase = 'recorded'
  accepted[0].retryRequested = true
  accepted[0].results = [{ platform: 'youtube', status: 'failed', success: false, postId: 'd'.repeat(24) }]
  const response = await post(body())
  assert.equal(response.status, 202)
  const receipt = await response.json()
  assert.equal(receipt.hasPending, true)
  assert.equal(receipt.results[0].status, 'publishing')
  assert.equal(receipt.results[0].deliveryState, 'queued')
  assert.equal(receipt.results[0].canRequestRetry, false)
})

test('crash after retry claim cannot expose the previous failure as a terminal outcome', () => {
  const operation = accepted[0]
  operation.phase = 'retrying'
  operation.retryRequested = false
  operation.results = [{ platform: 'youtube', status: 'failed', success: false, postId: 'd'.repeat(24) }]
  const receipt = durablePublicationReceipt(videoId, [operation])
  assert.equal(receipt.hasPending, true)
  assert.equal(receipt.results[0].status, 'unknown')
  assert.equal(receipt.results[0].canRequestRetry, false)
})

test('a block on a legacy grouped operation cannot relabel its confirmed success', () => {
  const operation = accepted[0]
  operation.phase = 'recorded'
  operation.blockedReason = 'SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED'
  operation.results = [{ platform: 'youtube', status: 'published', success: true, accountId: remote, postId: 'd'.repeat(24) }]
  const receipt = durablePublicationReceipt(videoId, [operation])
  assert.equal(receipt.results[0].status, 'published')
  assert.equal(receipt.results[0].deliveryState, undefined)
  assert.equal(receipt.results[0].canRequestRetry, false)
  assert.equal(receipt.hasPending, false)
})

test('cron rejects absent/incorrect secret before any work', async () => {
  const request = (authorization?: string) => new Request('http://127.0.0.1/api/cron/social-worker', {
    method: 'POST', headers: authorization ? { authorization } : {},
  })
  assert.equal((await cron(request())).status, 503)
  process.env.CRON_SECRET = 'fixture-secret'
  assert.equal((await cron(request())).status, 401)
  assert.equal((await cron(request('Bearer other'))).status, 401)
  assert.equal(invocations.length, 0)
})

function workerFixture(count = 1) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  let claims = 0
  let releaseConfirmed = true
  let claimFails = false
  const service = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    if (name === 'claim_social_publication_journals') {
      if (claimFails) return { data: null, error: { message: 'fixture unavailable' } }
      return { data: claims++ < count ? [{ kind: 'video', production_id: videoId, user_id: owner,
        dispatch_enabled: true, dispatch_attempts: 1, operations: structuredClone(accepted), lease_token: args.p_lease_token }] : [], error: null }
    }
    assert.equal(name, 'release_social_publication_journal')
    return { data: releaseConfirmed, error: null }
  } }
  const runs: Parameters<typeof publishVideoRecord>[] = []
  const run = (async (...args: Parameters<typeof publishVideoRecord>) => {
    runs.push(args)
    return { success: true, status: 'published', results: [], hasPending: false, operations: accepted,
      execution: { mode: 'drain', processed: 1, queued: 0, nextRunAt: null } }
  }) as typeof publishVideoRecord
  return { service: service as never, run, runs, calls,
    releaseFails: () => { releaseConfirmed = false }, claimFails: () => { claimFails = true } }
}

test('worker selects accepted identities, one operation per lease, no generation RPC', async () => {
  accepted[0].dispatchRequested = false
  const f = workerFixture()
  const result = await drainSocialPublications(f.service, f.run)
  assert.equal(result.confirmed, true)
  assert.equal(f.runs.length, 1)
  assert.deepEqual(f.runs[0][1].destinations, [{ platform: 'youtube', accountId: otherId }])
  assert.equal(f.runs[0][1].autoCaption, false)
  assert.deepEqual(f.runs[0][7], { mode: 'drain', maxOperations: 1, leaseToken: f.calls[0].args.p_lease_token })
  assert.deepEqual(f.calls.map(call => call.name), ['claim_social_publication_journals', 'release_social_publication_journal', 'claim_social_publication_journals'])
  assert.equal(f.calls[1].args.p_next_run_at, null)
})

test('lost release acknowledgement stops the invocation without another claim', async () => {
  const f = workerFixture(5)
  f.releaseFails()
  const result = await drainSocialPublications(f.service, f.run)
  assert.equal(result.confirmed, false)
  assert.equal(result.receipts[0].status, 'write_unconfirmed')
  assert.equal(f.runs.length, 1)
  assert.equal(f.calls.length, 2)
})

test('projection failure preserves intent and schedules a bounded durable wake', async () => {
  const f = workerFixture()
  const original = structuredClone(accepted)
  const run = (async () => { throw new Error('SUTRA_RECONCILIATION_REQUIRED: sensitive provider detail') }) as typeof publishVideoRecord
  const result = await drainSocialPublications(f.service, run, () => 10_000)
  assert.equal(result.receipts[0].status, 'deferred')
  assert.equal(result.receipts[0].errorCode, 'SUTRA_RECONCILIATION_REQUIRED')
  assert.equal(f.calls[1].args.p_next_run_at, new Date(130_000).toISOString())
  assert.doesNotMatch(JSON.stringify(result), /sensitive provider/)
  assert.deepEqual(accepted, original)
})

test('worker admission budget is bounded by count and elapsed time', async () => {
  const f = workerFixture(100)
  assert.equal((await drainSocialPublications(f.service, f.run, () => 0)).processed, 4)
  const timed = workerFixture(100)
  let clock = 0
  const run = (async (...args: Parameters<typeof publishVideoRecord>) => { clock += 90_000; return timed.run(...args) }) as typeof publishVideoRecord
  assert.equal((await drainSocialPublications(timed.service, run, () => clock)).processed, 1)
})

test('unavailable claim never calls the publisher', async () => {
  const f = workerFixture()
  f.claimFails()
  await assert.rejects(drainSocialPublications(f.service, f.run), /WORKER_UNAVAILABLE/)
  assert.equal(f.runs.length, 0)
})
