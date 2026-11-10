import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { socialDatabase } from './helpers/social-database.mts'
import type { PublicationExecutionOptions, PublicationGateway, PublicationOperation } from '../src/lib/publication-journal.ts'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'
import type { VideoPublicationInput } from '../src/lib/social-publication.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.ZERNIO_API_KEY = 'test-only'
const userId = '11111111-1111-4111-8111-111111111111'
process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [userId]: 'a'.repeat(24) })
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

const { runPublicationJournal, publicationNextRunAt } = await import('../src/lib/publication-journal.ts')
const { durableMediaUrl, ownedMediaPath } = await import('../src/lib/private-media.ts')
const { publishVideoRecord } = await import('../src/lib/social-publication.ts')

type Options = Parameters<typeof runPublicationJournal>[0]
interface SaveArgs {
  p_kind: string; p_production_id: string; p_user_id: string; p_revision: number
  p_operations: PublicationOperation[]; p_lease_token: string | null; p_next_run_at: string | null
}

function result(request: PublishRequest, status: PublishResult['status'] = 'published'): PublishResult[] {
  return request.platforms.map(platform => ({ platform, accountId: request.accountIds[platform], status,
    success: status === 'published', postId: request.accountIds[platform] }))
}

function harness(count = 2, privateMedia = false) {
  const db = socialDatabase(userId)
  const template = structuredClone(db.accounts[0])
  db.accounts.splice(0, db.accounts.length, ...Array.from({ length: count }, (_, index) => ({ ...structuredClone(template),
    id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, '0')}`,
    platform: 'youtube', external_id: (index + 1000).toString(16).padStart(24, '0') })))
  const destinations = db.accounts.map(account => ({ platform: 'youtube' as const, accountId: account.id }))
  let now = Date.now()
  const calls = { publish: [] as PublishRequest[], replay: [] as PublishRequest[], retry: [] as PublishRequest[], reconcile: [] as PublishRequest[] }
  const saves: SaveArgs[] = []
  const settings = { failRpc: false, failReceipt: false,
    beforeRpc: undefined as undefined | ((args: SaveArgs) => void), afterRpc: undefined as undefined | ((args: SaveArgs) => void) }
  const journal = () => {
    const row = db.tables.social_publication_journals[0]
    assert.ok(row, 'journal must exist')
    return row
  }
  Object.assign(db.client as unknown as object, {
    rpc: async (name: string, args: SaveArgs) => {
      assert.equal(name, 'save_social_publication_journal')
      saves.push(structuredClone(args))
      settings.beforeRpc?.(args)
      const row = journal()
      const active = !!row.lease_token && Date.parse(String(row.lease_until)) > now
      if (settings.failRpc || row.kind !== args.p_kind || row.production_id !== args.p_production_id
        || row.user_id !== args.p_user_id || row.revision !== args.p_revision
        || (args.p_lease_token ? !active || row.lease_token !== args.p_lease_token : active)
        || (settings.failReceipt && args.p_operations.some(operation => operation.results?.some(entry => entry.success)))) {
        return { data: null, error: null }
      }
      row.revision = args.p_revision + 1
      row.operations = structuredClone(args.p_operations)
      row.dispatch_enabled = true
      row.next_run_at = args.p_next_run_at
      settings.afterRpc?.(args)
      return { data: row.revision, error: null }
    },
  })
  const gateway: PublicationGateway = {
    now: () => now,
    publish: async request => { calls.publish.push(structuredClone(request)); return result(request) },
    replay: async request => { calls.replay.push(structuredClone(request)); return result(request) },
    retry: async (_id, request) => { calls.retry.push(structuredClone(request)); return result(request) },
    reconcile: async (_id, request) => { calls.reconcile.push(structuredClone(request)); return result(request) },
  }
  const request = { videoUrl: privateMedia ? durableMediaUrl(ownedMediaPath('final.mp4', userId)) : db.video.video_url,
    verifiedSha256: 'a'.repeat(64), caption: 'Immutable caption', hashtags: ['sutra'] }
  const invoke = (execution?: PublicationExecutionOptions, extra: Partial<Options> = {}) => runPublicationJournal({
    userId, productionId: 'v', kind: 'video', platforms: ['youtube'], destinations, request,
    authorize: async () => {}, execution, ...extra,
  }, db.client, gateway)
  const invokeVideo = (execution?: PublicationExecutionOptions, extra: Partial<VideoPublicationInput> = {}) => publishVideoRecord(userId, {
    videoId: 'v', platforms: ['youtube'], destinations, caption: request.caption, hashtags: request.hashtags, ...extra,
  }, db.client, gateway.publish, gateway.reconcile, gateway, undefined, execution)
  const claim = () => {
    const row = journal()
    assert.ok(!row.lease_token || !(Date.parse(String(row.lease_until)) > now), 'one worker per journal')
    const leaseToken = randomUUID()
    row.revision = Number(row.revision) + 1
    row.lease_token = leaseToken
    row.lease_until = new Date(now + 600_000).toISOString()
    return { mode: 'drain', leaseToken, maxOperations: 1 } satisfies PublicationExecutionOptions
  }
  const release = () => { journal().lease_token = null; journal().lease_until = null }
  return { db, destinations, calls, gateway, saves, settings, journal, request, invoke, invokeVideo, claim, release,
    advance: (ms: number) => { now += ms }, now: () => now }
}

test('Admission durable : 50 destinations dans un seul CAS, aucun appel fournisseur, aucun premier essai', async () => {
  const h = harness(50, true)
  const outcome = await h.invoke({ mode: 'enqueue' })
  assert.equal(h.saves.length, 1)
  assert.equal(h.saves[0].p_operations.length, 50)
  assert.equal(h.journal().operations.length, 50)
  assert.equal(outcome.execution?.queued, 50)
  assert.equal(outcome.hasPending, true)
  assert.equal(outcome.success, false)
  assert.ok(outcome.results.every(entry => entry.status === 'publishing' && entry.deliveryState === 'queued'))
  assert.ok(h.journal().operations.every(operation => operation.phase === 'queued' && !operation.firstAttemptAt && operation.dispatchRequested))
  assert.equal(new Set(h.journal().operations.map(operation => operation.id)).size, 50)
  assert.ok(h.journal().operations.every(operation => operation.request.providerMediaUrl?.includes('?grant=')))
  assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
})

test('Admission durable : refus de B ou CAS perdu ne rend pas A executable', async () => {
  for (const failure of ['account', 'rpc'] as const) {
    const h = harness()
    if (failure === 'account') h.db.accounts[1].status = 'disconnected'
    else h.settings.failRpc = true
    await assert.rejects(() => h.invoke({ mode: 'enqueue' }), failure === 'account' ? /ACCOUNT_SELECTION_REQUIRED/ : /journal concurrent/)
    assert.equal(h.journal().operations.length, 0)
    assert.notEqual(h.journal().dispatch_enabled, true)
    assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
  }
})

test('Admission durable : deux demandes concurrentes conservent les cles et les grants du gagnant', async () => {
  const h = harness(2, true)
  const settled = await Promise.allSettled([h.invoke({ mode: 'enqueue' }), h.invoke({ mode: 'enqueue' })])
  assert.ok(settled.some(entry => entry.status === 'fulfilled'))
  const original = structuredClone(h.journal().operations)
  await h.invoke({ mode: 'enqueue' }, { request: { ...h.request, caption: 'Later browser text' } })
  assert.deepEqual(h.journal().operations.map(operation => operation.request), original.map(operation => operation.request))
  assert.deepEqual(h.journal().operations.map(operation => operation.id), original.map(operation => operation.id))
  assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
})

test('Admission durable : le plafond de 50 couvre le journal entier, pas seulement chaque requete', async () => {
  const h = harness(51)
  await h.invoke({ mode: 'enqueue' }, { destinations: h.destinations.slice(0, 50) })
  const before = structuredClone(h.journal())
  await assert.rejects(() => h.invoke({ mode: 'enqueue' }, { destinations: h.destinations.slice(50) }), /INVALID_DESTINATIONS/)
  assert.deepEqual(h.journal(), before)
  assert.equal(h.saves.length, 1)
  assert.equal(h.calls.publish.length, 0)
})

test('Drain durable : le premier POST voit le lot complet et la frontiere persistee ; une operation par passage', async () => {
  const h = harness(3)
  await h.invoke({ mode: 'enqueue' }, { destinations: h.destinations.slice(0, 2) })
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    assert.equal(h.journal().operations.length, 2)
    const operation = h.journal().operations.find(entry => entry.id === request.idempotencyKey)!
    assert.equal(operation.phase, 'submitting')
    assert.equal(operation.firstAttemptAt, new Date(h.now()).toISOString())
    assert.ok(h.journal().lease_token)
    return result(request)
  }
  // Even an extra input destination cannot be created during a drain.
  const first = await h.invoke(h.claim())
  assert.equal(h.calls.publish.length, 1)
  assert.equal(first.status, 'partially_published')
  assert.equal(first.hasPending, true)
  assert.equal(first.execution?.processed, 1)
  assert.equal(first.execution?.queued, 1)
  assert.equal(h.journal().operations.length, 2)
  h.release()
  const last = await h.invoke(h.claim())
  assert.equal(last.status, 'published')
  assert.equal(last.hasPending, false)
  assert.equal(last.execution?.nextRunAt, null)
  assert.ok(h.journal().next_run_at, 'receipt retains a wake-up until projections and release succeed')
  assert.equal(h.calls.publish.length, 2)
})

test('Drain durable : panne apres reception distante conserve la cle ; B passe avant le rapprochement de A', async () => {
  const h = harness(2, true)
  await h.invoke({ mode: 'enqueue' })
  const original = structuredClone(h.journal().operations[0].request)
  h.settings.failReceipt = true
  await assert.rejects(() => h.invoke(h.claim()), /journal concurrent/)
  assert.equal(h.journal().operations[0].phase, 'submitting')
  assert.equal(h.journal().operations[1].phase, 'queued')
  h.settings.failReceipt = false
  h.release(); h.advance(120_001)
  await h.invoke(h.claim())
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [h.db.accounts[0].external_id, h.db.accounts[1].external_id])
  assert.equal(h.calls.replay.length, 0)
  h.release()
  const recovered = await h.invoke(h.claim())
  assert.deepEqual(h.calls.replay, [original])
  assert.equal(recovered.status, 'published')
  assert.equal(h.calls.publish.length, 2)
})

test('Drain durable : une queued de plus de 24 h ouvre sa fenetre au premier essai et rejoue les memes octets', async () => {
  const h = harness(1, true)
  await h.invoke({ mode: 'enqueue' })
  const original = structuredClone(h.journal().operations[0].request)
  const admittedAt = h.journal().operations[0].createdAt
  h.advance(25 * 3600_000)
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); throw new Error('lost response') }
  await h.invoke(h.claim())
  assert.notEqual(h.journal().operations[0].firstAttemptAt, admittedAt)
  assert.equal(h.journal().operations[0].createdAt, admittedAt)
  h.release(); h.advance(120_001)
  assert.equal((await h.invoke(h.claim())).status, 'published')
  assert.deepEqual(h.calls.replay, [original])
})

test('Drain durable : une incertitude expiree ne cree rien et reste explicitement en attente', async () => {
  const h = harness(1)
  await h.invoke({ mode: 'enqueue' })
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); throw new Error('lost response') }
  await h.invoke(h.claim())
  h.release(); h.advance(25 * 3600_000)
  const outcome = await h.invoke(h.claim())
  assert.equal(outcome.hasPending, true)
  assert.equal(outcome.results[0].deliveryState, 'blocked')
  assert.equal(outcome.operations[0].blockedReason, 'SUTRA_IDEMPOTENCY_WINDOW_EXPIRED')
  assert.equal(outcome.execution?.nextRunAt, null)
  assert.equal(h.calls.publish.length, 1)
  assert.equal(h.calls.replay.length + h.calls.retry.length, 0)
})

test('Drain durable : une programmation devenue passee ne se transforme jamais en envoi immediat', async () => {
  const h = harness(1)
  h.request = Object.assign(h.request, { scheduledAt: new Date(h.now() + 1800_000).toISOString() })
  await h.invoke({ mode: 'enqueue' })
  h.advance(1800_001)
  const outcome = await h.invoke(h.claim())
  assert.equal(outcome.operations[0].phase, 'queued')
  assert.equal(outcome.operations[0].firstAttemptAt, undefined)
  assert.equal(outcome.operations[0].blockedReason, 'SUTRA_SCHEDULE_RECONCILIATION_REQUIRED')
  assert.equal(h.calls.publish.length + h.calls.replay.length, 0)
  h.release()
  await assert.rejects(() => h.invoke({ mode: 'enqueue' }), /SCHEDULE_RECONCILIATION_REQUIRED/)
})

test('Drain durable : revocation de A ne perd pas B ; un rearmement explicite conserve les preuves', async () => {
  const h = harness()
  await h.invoke({ mode: 'enqueue' })
  h.db.accounts[0].status = 'revoked'
  const blocked = await h.invoke(h.claim())
  assert.equal(blocked.operations[0].phase, 'queued')
  assert.equal(blocked.operations[0].blockedReason, 'SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED')
  assert.equal(h.calls.publish.length, 0)
  h.release()
  await h.invoke(h.claim())
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [h.db.accounts[1].external_id])
  h.release(); h.db.accounts[0].status = 'connected'
  const proof = structuredClone(h.journal().operations[0].results)
  await h.invoke({ mode: 'enqueue' }, { destinations: [h.destinations[0]] })
  assert.deepEqual(h.journal().operations[0].results, proof)
  assert.equal(h.journal().operations[0].blockedReason, undefined)
  assert.equal((await h.invoke(h.claim())).status, 'published')
})

test('Drain durable : une reprise exige un ordre persiste, consomme avant POST et non reactive par un ancien failed', async () => {
  const h = harness(1)
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'failed') }
  h.gateway.reconcile = async (_id, request) => { h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed') }
  await h.invoke({ mode: 'enqueue' })
  await h.invoke(h.claim())
  h.release()
  await h.invoke(h.claim(), { retryFailed: true })
  assert.equal(h.calls.retry.length, 0, 'worker retryFailed cannot grant a retry')
  h.release()
  await h.invoke({ mode: 'enqueue' }, { retryFailed: true })
  assert.equal(h.journal().operations[0].retryRequested, true)
  h.gateway.retry = async (_id, request) => {
    h.calls.retry.push(structuredClone(request))
    assert.equal(h.journal().operations[0].retryRequested, false)
    assert.equal(h.journal().operations[0].phase, 'retrying')
    throw new Error('lost retry response')
  }
  await h.invoke(h.claim())
  h.release(); h.advance(60_001)
  const uncertain = await h.invoke(h.claim())
  assert.equal(uncertain.operations[0].phase, 'retrying')
  assert.equal(uncertain.results[0].status, 'unknown')
  assert.equal(h.calls.retry.length, 1)
  h.release()
  await h.invoke({ mode: 'enqueue' }, { retryFailed: true })
  assert.notEqual(h.journal().operations[0].retryRequested, true)
  h.advance(60_001)
  await h.invoke(h.claim())
  assert.equal(h.calls.retry.length, 1)
})

test('Reprise durable : un ordre accepte reste en file et pending malgre le failed de la tentative precedente', async () => {
  const h = harness(1)
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'failed') }
  await h.invokeVideo({ mode: 'enqueue' })
  await h.invokeVideo(h.claim())
  h.release()
  const previousFailure = structuredClone(h.journal().operations[0].results)
  const admitted = await h.invokeVideo({ mode: 'enqueue' })
  assert.equal(h.journal().operations[0].phase, 'recorded')
  assert.equal(h.journal().operations[0].retryRequested, true)
  assert.deepEqual(h.journal().operations[0].results, previousFailure, 'admission does not rewrite provider evidence')
  assert.equal(admitted.status, 'publishing')
  assert.equal(admitted.hasPending, true)
  assert.equal(admitted.results[0].status, 'publishing')
  assert.equal(admitted.results[0].deliveryState, 'queued')
  assert.equal(admitted.execution?.queued, 1)
  assert.ok(admitted.execution?.nextRunAt)
  const observed = await h.invoke(undefined, { reconcileOnly: true })
  assert.equal(observed.hasPending, true)
  assert.equal(observed.results[0].deliveryState, 'queued')
  assert.equal(h.calls.publish.length, 1)
  assert.equal(h.calls.retry.length + h.calls.reconcile.length, 0)
})

test('Reprise durable : crash apres commit du claim retry garde pending et reveil, puis GET sans nouveau retry', async () => {
  const h = harness(1)
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'failed') }
  h.gateway.reconcile = async (_id, request) => { h.calls.reconcile.push(structuredClone(request)); return result(request, 'failed') }
  await h.invoke({ mode: 'enqueue' })
  await h.invoke(h.claim())
  h.release()
  await h.invoke({ mode: 'enqueue' }, { retryFailed: true })
  h.settings.afterRpc = args => {
    if (args.p_operations.some(operation => operation.phase === 'retrying' && operation.retryRequested === false)) {
      throw new Error('SUTRA_RECONCILIATION_REQUIRED: journal concurrent ou non enregistre')
    }
  }
  await assert.rejects(() => h.invoke(h.claim()), /journal concurrent/)
  const claimed = h.journal().operations[0]
  assert.equal(claimed.phase, 'retrying')
  assert.equal(claimed.retryRequested, false)
  assert.equal(claimed.results?.[0].status, 'failed', 'crash preserves the previous attempt payload')
  assert.ok(publicationNextRunAt(h.journal().operations, h.now()))
  const observed = await h.invoke(undefined, { reconcileOnly: true })
  assert.equal(observed.hasPending, true)
  assert.equal(observed.results[0].status, 'unknown')
  assert.equal(h.calls.retry.length, 0)
  const priorReads = h.calls.reconcile.length
  h.settings.afterRpc = undefined
  // No graceful release: the replacement worker waits for the crashed lease.
  h.advance(600_001)
  const recovered = await h.invoke(h.claim())
  assert.equal(h.calls.reconcile.length, priorReads + 1)
  assert.equal(recovered.operations[0].phase, 'retrying')
  assert.equal(recovered.results[0].status, 'unknown')
  assert.equal(recovered.hasPending, true)
  assert.ok(recovered.execution?.nextRunAt)
  assert.equal(h.calls.retry.length + h.calls.replay.length, 0)
  assert.equal(h.calls.publish.length, 1)
})

test('Drain durable : ancien recorded sans postId bloque explicitement sans affamer une autre observation', async () => {
  const h = harness()
  h.gateway.publish = async request => {
    h.calls.publish.push(structuredClone(request))
    return request.accountIds.youtube === h.db.accounts[0].external_id
      ? [{ platform: 'youtube', accountId: request.accountIds.youtube, status: 'unknown', success: false }]
      : result(request, 'publishing')
  }
  await h.invoke()
  // Simulate an older imported journal whose phase and missing ID disagree.
  h.journal().operations[0].phase = 'recorded'
  await h.invoke({ mode: 'enqueue' }, { destinations: [h.destinations[1]] })
  h.advance(60_001)
  const guarded = await h.invoke(h.claim())
  assert.equal(guarded.operations[0].blockedReason, 'SUTRA_PUBLICATION_POST_EVIDENCE_REQUIRED')
  assert.equal(guarded.results[0].deliveryState, 'blocked')
  assert.equal(h.calls.reconcile.length + h.calls.replay.length + h.calls.retry.length, 0)
  h.release(); h.advance(60_001)
  const next = await h.invoke(h.claim())
  assert.equal(h.calls.reconcile.length, 1)
  assert.equal(next.results[1].status, 'published')
  assert.equal(next.operations[0].blockedReason, 'SUTRA_PUBLICATION_POST_EVIDENCE_REQUIRED')
  assert.equal(next.execution?.nextRunAt, null)
  assert.equal(h.calls.publish.length, 2)
  assert.equal(h.calls.replay.length + h.calls.retry.length, 0)
})

test('Lecture durable : reconcileOnly ne lit que les preuves locales sous bail ; sync refuse toute execution', async () => {
  const h = harness()
  await h.invoke({ mode: 'enqueue' })
  h.claim()
  const before = structuredClone(h.journal())
  const count = h.saves.length
  const outcome = await h.invoke(undefined, { reconcileOnly: true })
  assert.equal(outcome.execution?.mode, 'read')
  assert.equal(outcome.results.length, 2)
  assert.deepEqual(h.journal(), before)
  assert.equal(h.saves.length, count)
  await assert.rejects(() => h.invoke(), /DURABLE_PUBLICATION_REQUIRED/)
  assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
})

test('Drain durable : mauvais bail ou bail perdu pendant autorisation empeche le POST', async () => {
  const h = harness(1)
  await h.invoke({ mode: 'enqueue' })
  const lease = h.claim()
  await assert.rejects(() => h.invoke({ ...lease, leaseToken: randomUUID() }), /LEASE_LOST/)
  let authorizations = 0
  await assert.rejects(() => h.invoke(lease, { authorize: async () => {
    if (++authorizations === 2) { h.journal().lease_token = randomUUID(); h.journal().revision = Number(h.journal().revision) + 1 }
  } }), /journal concurrent/)
  assert.equal(h.calls.publish.length, 0)
  assert.equal(h.journal().operations[0].phase, 'submitting')
})

test('Drain durable : revocation apres claim se rearme explicitement avec la meme cle et la meme frontiere', async () => {
  const h = harness(1, true)
  await h.invoke({ mode: 'enqueue' })
  const original = structuredClone(h.journal().operations[0].request)
  let authorizations = 0
  const blocked = await h.invoke(h.claim(), { authorize: async () => {
    if (++authorizations === 2) h.db.accounts[0].status = 'revoked'
  } })
  assert.equal(blocked.operations[0].phase, 'submitting')
  assert.equal(blocked.operations[0].blockedReason, 'SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED')
  assert.equal(h.calls.publish.length, 0)
  const boundary = blocked.operations[0].firstAttemptAt
  h.release(); h.db.accounts[0].status = 'connected'
  await h.invoke({ mode: 'enqueue' })
  assert.equal(h.journal().operations[0].phase, 'submitting')
  assert.equal(h.journal().operations[0].firstAttemptAt, boundary)
  assert.equal(h.journal().operations[0].blockedReason, undefined)
  h.advance(120_001)
  assert.equal((await h.invoke(h.claim())).status, 'published')
  assert.deepEqual(h.calls.replay, [original])
  assert.equal(h.calls.publish.length, 0)
})

test('Migration durable : ajouter B ne donne aucune autorisation de rejouer A historique non selectionnee', async () => {
  const h = harness()
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); throw new Error('legacy lost response') }
  await h.invoke(undefined, { destinations: [h.destinations[0]] })
  const original = structuredClone(h.journal().operations[0])
  h.advance(120_001)
  await h.invoke({ mode: 'enqueue' }, { destinations: [h.destinations[1]] })
  assert.equal(h.journal().operations[0].dispatchRequested, undefined)
  assert.deepEqual(h.journal().operations[0], original)
  h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request) }
  await h.invoke(h.claim(), { destinations: [h.destinations[1]] })
  h.release()
  await h.invoke(h.claim(), { destinations: [h.destinations[1]] })
  assert.equal(h.calls.replay.length, 0)
  assert.deepEqual(h.calls.publish.map(request => request.accountIds.youtube), [h.db.accounts[0].external_id, h.db.accounts[1].external_id])
  assert.equal(publicationNextRunAt(h.journal().operations, h.now()), null)
})

test('Admission durable : un historique de plus de 50 destinations ne se convertit pas silencieusement', async () => {
  const h = harness(51)
  await h.invoke(undefined, { destinations: h.destinations.slice(0, 50) })
  await h.invoke(undefined, { destinations: h.destinations.slice(50) })
  assert.equal(h.journal().operations.length, 51)
  const calls = h.calls.publish.length
  await assert.rejects(() => h.invoke({ mode: 'enqueue' }, { destinations: [h.destinations[0]] }), /INVALID_DESTINATIONS/)
  assert.notEqual(h.journal().dispatch_enabled, true)
  assert.equal(h.calls.publish.length, calls)
})

test('Wrapper video : admission sans fournisseur ni projection ; le drain projette tout le lot par upsert unique', async () => {
  const h = harness()
  let historyWrites = 0, calendarWrites = 0
  h.db.settings.hook = table => {
    if (table === 'social_posts') historyWrites++
    if (table === 'scheduled_posts') calendarWrites++
  }
  const admitted = await h.invokeVideo({ mode: 'enqueue' })
  assert.equal(admitted.operations.length, 2)
  assert.equal(h.db.video.publish_data, null)
  assert.equal(historyWrites + calendarWrites, 0)
  assert.deepEqual(h.calls, { publish: [], replay: [], retry: [], reconcile: [] })
  const partial = await h.invokeVideo(h.claim())
  assert.equal(partial.status, 'partially_published')
  assert.equal(partial.hasPending, true)
  assert.equal(h.calls.publish.length, 1)
  assert.equal(historyWrites, 1)
  assert.equal(calendarWrites, 1)
  assert.equal(h.db.tables.social_posts.length, 2)
  assert.equal(h.db.tables.scheduled_posts.length, 2)
  assert.equal(h.db.video.publish_data?.sutraPublications.length, 2)
})

test('Wrapper video : panne de projection apres preuve publiee se repare sous nouveau bail sans POST', async () => {
  const h = harness(1)
  await h.invokeVideo({ mode: 'enqueue' })
  h.db.settings.failProjection = true
  await assert.rejects(() => h.invokeVideo(h.claim()), /projection video non enregistree/)
  assert.equal(h.journal().operations[0].results?.[0].status, 'published')
  assert.ok(h.journal().next_run_at)
  assert.equal(h.db.video.publish_data, null)
  h.db.settings.failProjection = false
  h.release(); h.advance(60_001)
  const repaired = await h.invokeVideo(h.claim())
  assert.equal(repaired.status, 'published')
  assert.equal(h.db.video.status, 'published')
  assert.equal(h.db.tables.social_posts[0].status, 'published')
  assert.equal(h.db.tables.scheduled_posts[0].status, 'published')
  assert.equal(h.calls.publish.length, 1)
  assert.equal(h.calls.retry.length + h.calls.replay.length + h.calls.reconcile.length, 0)
})

for (const priorSend of [false, true]) test(`Wrapper video : export remplace ${priorSend ? 'apres envoi' : 'avant envoi'}, aucun POST ni projection sur le nouvel export`, async () => {
  const h = harness(1)
  await h.invokeVideo({ mode: 'enqueue' })
  if (priorSend) {
    h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'publishing') }
    await h.invokeVideo(h.claim())
    h.release(); h.advance(60_001)
  }
  const replacementUrl = 'https://media.invalid/replacement.mp4'
  h.db.video.video_url = replacementUrl
  h.db.video.shotstack_json = { sutraVerification: { url: replacementUrl, sha256: 'b'.repeat(64) } }
  h.db.video.publish_data = null
  const replacement = structuredClone(h.db.video)
  const outcome = await h.invokeVideo(h.claim())
  assert.deepEqual(h.db.video, replacement)
  assert.equal(h.calls.publish.length, priorSend ? 1 : 0)
  assert.equal(h.calls.replay.length + h.calls.retry.length, 0)
  if (priorSend) {
    assert.equal(h.calls.reconcile.length, 1)
    assert.equal(outcome.status, 'published')
    assert.notEqual(outcome.operations[0].request.videoUrl, replacementUrl)
  } else {
    assert.equal(outcome.operations[0].phase, 'queued')
    assert.equal(outcome.operations[0].blockedReason, 'SUTRA_MEDIA_CHANGED')
    assert.equal(h.calls.reconcile.length, 0)
  }
})

for (const priorSend of [false, true]) test(`Wrapper video : video supprimee ${priorSend ? 'apres envoi' : 'avant envoi'}, seules les preuves distantes restent accessibles`, async () => {
  const h = harness(1)
  await h.invokeVideo({ mode: 'enqueue' })
  if (priorSend) {
    h.gateway.publish = async request => { h.calls.publish.push(structuredClone(request)); return result(request, 'publishing') }
    await h.invokeVideo(h.claim())
    h.release(); h.advance(60_001)
  }
  h.db.tables.videos.splice(0, 1)
  const history = structuredClone(h.db.tables.social_posts)
  const outcome = await h.invokeVideo(h.claim())
  assert.equal(h.db.tables.videos.length, 0)
  assert.deepEqual(h.db.tables.social_posts, history)
  assert.equal(h.calls.publish.length, priorSend ? 1 : 0)
  assert.equal(h.calls.retry.length + h.calls.replay.length, 0)
  if (priorSend) {
    assert.equal(h.calls.reconcile.length, 1)
    assert.equal(outcome.status, 'published')
  } else {
    assert.equal(outcome.operations[0].blockedReason, 'SUTRA_VIDEO_NOT_FOUND')
    assert.equal(outcome.operations[0].phase, 'queued')
    assert.equal(h.calls.reconcile.length, 0)
  }
})
