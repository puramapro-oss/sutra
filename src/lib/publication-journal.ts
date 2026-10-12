import { createHash, randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { publicationMediaUrl } from './private-media'
import { buildPublishPayload, publishToPlatforms, getPublicationResults, replayPublication, retryPublication,
  type PublishRequest, type PublishResult, type SocialPlatform } from '@/lib/zernio'

export interface PublicationOperation {
  id: string
  fingerprint?: string
  phase: 'submitting' | 'recorded' | 'retrying'
  createdAt: string
  claimedAt?: string
  request: PublishRequest
  accountRows: Record<string, string>
  results?: PublishResult[]
}
export interface PublicationGateway {
  publish: typeof publishToPlatforms
  reconcile: typeof getPublicationResults
  replay: typeof replayPublication
  retry: typeof retryPublication
  now: () => number
}
const defaultGateway: PublicationGateway = {
  publish: publishToPlatforms, reconcile: getPublicationResults, replay: replayPublication, retry: retryPublication, now: Date.now,
}
export function publicationOutcome(results: PublishResult[]) {
  const published = results.filter(r => r.status === 'published' && r.success).length
  const status = results.length && published === results.length ? 'published'
    : published ? 'partially_published'
    : results.some(r => r.status === 'unknown' || r.status === 'publishing') ? 'publishing'
    : results.length && results.every(r => r.status === 'scheduled') ? 'scheduled' : 'failed'
  return { success: status === 'published', status, results }
}
export function publicationHistoryId(production: string, platform: string, account: string) {
  const hex = createHash('sha256').update(`${production}:${platform}:${account}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** The journal is the authority. History/video status are repairable projections.
 * A lease prevents concurrent sends; an expired lease NEVER grants a new key. */
export async function runPublicationJournal(options: {
  userId: string; productionId: string; kind: 'video' | 'auto'; platforms: SocialPlatform[]
  accountIds?: Partial<Record<SocialPlatform, string>>
  request: Omit<PublishRequest, 'platforms' | 'accountIds' | 'idempotencyKey'>
  authorize: (request: PublishRequest) => Promise<void>
  legacyOperations?: PublicationOperation[]
  legacyResults?: PublishResult[]
  legacyUncertain?: boolean
  reconcileOnly?: boolean
  retryFailed?: boolean
}, service = createServiceClient(), overrides: Partial<PublicationGateway> = {}) {
  const gateway = { ...defaultGateway, ...overrides }
  const table = () => service.from('social_publication_journals')
  const scoped = () => table().select('*').eq('kind', options.kind).eq('production_id', options.productionId).eq('user_id', options.userId)
  const read = await scoped().maybeSingle()
  if (read.error) throw new Error('SUTRA_PUBLICATION_JOURNAL_READ_FAILED')
  let journal = read.data as { revision: number; operations: PublicationOperation[] } | null
  if (!journal) {
    const operations = options.legacyOperations ?? []
    // Legacy auto results have no reliable account identity: never invent one.
    if (options.legacyUncertain || (options.legacyResults?.length && !operations.length)) {
      return { ...publicationOutcome(options.legacyResults ?? [{ platform: options.platforms[0], success: false, status: 'unknown' }]),
        operations: [], reconciliationRequired: 'SUTRA_LEGACY_ACCOUNT_EVIDENCE_REQUIRED' }
    }
    const inserted = await table().insert({ kind: options.kind, production_id: options.productionId, user_id: options.userId, operations })
      .select('*').maybeSingle()
    if (inserted.error?.code === '23505') {
      const concurrent = await scoped().maybeSingle()
      if (concurrent.error) throw new Error('SUTRA_PUBLICATION_JOURNAL_READ_FAILED')
      journal = concurrent.data
    } else if (inserted.error) throw new Error('SUTRA_PUBLICATION_JOURNAL_CLAIM_FAILED')
    else journal = inserted.data
  }
  if (!journal || !Array.isArray(journal.operations)) throw new Error('SUTRA_PUBLICATION_JOURNAL_INVALID')
  let operations: PublicationOperation[] = structuredClone(journal.operations)
  // A production identity cannot be reused for a different verified export,
  // including when every earlier destination already reported success.
  if (operations.some(operation => operation.request?.videoUrl !== options.request.videoUrl
    || (operation.request.verifiedSha256 && operation.request.verifiedSha256 !== options.request.verifiedSha256))) {
    throw new Error('SUTRA_MEDIA_CHANGED')
  }
  let revision = journal.revision
  const save = async () => {
    const result = await table().update({ operations, revision: revision + 1, updated_at: new Date(gateway.now()).toISOString() })
      .eq('kind', options.kind).eq('production_id', options.productionId).eq('user_id', options.userId).eq('revision', revision)
      .select('revision').maybeSingle()
    if (result.error || !result.data) throw new Error('SUTRA_RECONCILIATION_REQUIRED: journal concurrent ou non enregistre')
    revision++
  }
  const accountsQuery = () => service.schema('public').from('social_accounts')
    .select('id,platform,external_id,status,token_expires_at').eq('user_id', options.userId)
  const { data: accounts, error: accountsError } = await accountsQuery()
  if (accountsError) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  const connected = (a: { status: string; token_expires_at?: string | null }) => a.status === 'connected'
    && (!a.token_expires_at || Date.parse(a.token_expires_at) > gateway.now())
  const authorize = async (operation: PublicationOperation) => {
    if (options.reconcileOnly) throw new Error('SUTRA_PUBLICATION_READ_ONLY')
    await options.authorize(operation.request)
    // Service-role sends bypass session/RLS guards. Apply the same live profile
    // contract as account-access.ts; a prior approval cannot outlive revocation.
    const profile = await service.from('profiles').select('id,subscription_status,access_revoked_at')
      .eq('id', options.userId).maybeSingle()
    if (profile.error) throw new Error('SUTRA_ACCOUNT_ACCESS_UNAVAILABLE')
    if (!profile.data || profile.data.id !== options.userId || profile.data.subscription_status === 'banned'
      || profile.data.access_revoked_at) throw new Error('SUTRA_ACCOUNT_ACCESS_DENIED')
    const current = await accountsQuery()
    if (current.error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
    for (const platform of operation.request.platforms) {
      const matches = (current.data ?? []).filter(a => a.id === operation.accountRows[platform]
        && a.platform === platform && a.external_id === operation.request.accountIds[platform] && connected(a))
      if (matches.length !== 1) throw new Error('SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED')
    }
  }
  const normalize = (operation: PublicationOperation, results: PublishResult[]) => operation.request.platforms.map(platform => {
    const matches = results.filter(r => r.platform === platform && (!r.accountId || r.accountId === operation.request.accountIds[platform]))
    const old = operation.results?.find(r => r.platform === platform)
    // A stale remote status must never erase a confirmed publication.
    if (old?.status === 'published' && old.success) return old
    const result = matches.length === 1 ? matches[0] : undefined
    return { ...(result ?? { platform, success: false }), status: result?.status ?? 'unknown',
      success: result?.status === 'published' && result.success === true,
      ...(result?.status === 'published' ? { publishedAt: result.publishedAt ?? new Date(gateway.now()).toISOString() } : {}),
      accountId: operation.request.accountIds[platform] }
  })
  for (const operation of operations) {
    if (!operation.request?.platforms?.length || !operation.request.idempotencyKey) throw new Error('SUTRA_PUBLICATION_JOURNAL_INVALID')
    if (operation.results?.every(r => r.status === 'published' && r.success) && operation.results.length === operation.request.platforms.length) continue
    const postId = operation.results?.find(r => r.postId)?.postId
    try {
      if (postId) {
        const remote = await gateway.reconcile(postId, operation.request)
        operation.results = normalize(operation, remote)
        await save()
        const failed = operation.results.some(r => r.status === 'failed')
        // /retry targets only failed destinations of the original post. Re-authorize
        // every original account, including imported PR3 multi-account operations.
        if (failed && options.retryFailed && !options.reconcileOnly && operation.phase === 'recorded') {
          await authorize(operation)
          operation.phase = 'retrying'; operation.claimedAt = new Date(gateway.now()).toISOString()
          await save()
          try { await authorize(operation) } catch (error) {
            // No POST was attempted: release this claim so re-authorization can
            // recover it. A lost provider response must instead stay retrying.
            operation.phase = 'recorded'; throw error
          }
          operation.results = normalize(operation, await gateway.retry(postId, operation.request))
          operation.phase = 'recorded'
          await save()
        } else if (!failed && operation.phase !== 'recorded') {
          operation.phase = 'recorded'; await save()
        }
      } else if (operation.phase === 'submitting' && !options.reconcileOnly) {
        const age = gateway.now() - Date.parse(operation.createdAt)
        const claimAge = gateway.now() - Date.parse(operation.claimedAt ?? operation.createdAt)
        if (claimAge < 120_000) continue
        if (!Number.isFinite(age) || age < 0 || age >= 24 * 3600_000 - 5 * 60_000) throw new Error('SUTRA_IDEMPOTENCY_WINDOW_EXPIRED')
        // Past scheduling could turn a request that never arrived into an immediate
        // publication. Preserve that intent: require remote evidence instead.
        if (operation.request.scheduledAt && Date.parse(operation.request.scheduledAt) <= gateway.now()) throw new Error('SUTRA_SCHEDULE_RECONCILIATION_REQUIRED')
        await authorize(operation)
        operation.claimedAt = new Date(gateway.now()).toISOString(); await save()
        await authorize(operation)
        operation.results = normalize(operation, await gateway.replay(operation.request))
        operation.phase = operation.results.some(r => r.postId) ? 'recorded' : 'submitting'; await save()
      }
    } catch (error) {
      if (error instanceof Error && /journal concurrent ou non enregistre/.test(error.message)) throw error
      // Keep known outcomes and identity. Uncertainty never authorizes another create.
      operation.results = operation.request.platforms.map(platform => {
        const old = operation.results?.find(r => r.platform === platform)
        return old?.status === 'published' ? old : { ...old, platform, accountId: operation.request.accountIds[platform],
          status: old?.status ?? 'unknown', success: false, error: error instanceof Error ? error.message : 'SUTRA_RECONCILIATION_REQUIRED' }
      })
      await save()
    }
  }
  const unavailable: PublishResult[] = []
  for (const platform of [...new Set(options.platforms)]) {
    const selection = options.accountIds?.[platform]
    const matches = (accounts ?? []).filter(a => a.platform === platform && connected(a) && (!selection || a.id === selection))
    if (matches.length !== 1 || !matches[0].external_id) {
      if (!operations.some(o => o.request.platforms.includes(platform) && (!selection || o.accountRows[platform] === selection))) unavailable.push({ platform, success: false, status: 'failed', error: 'SUTRA_ACCOUNT_SELECTION_REQUIRED' })
      continue
    }
    const account = matches[0]
    if (operations.some(o => o.request.platforms.includes(platform) && o.request.accountIds[platform] === account.external_id)) continue
    if (options.reconcileOnly) continue
    if (!selection && operations.some(o => o.request.platforms.includes(platform))) {
      unavailable.push({ platform, success: false, status: 'failed', error: 'SUTRA_ACCOUNT_CHANGED_SELECTION_REQUIRED' })
      continue
    }
    const request: PublishRequest = { ...options.request, platforms: [platform],
      accountIds: { [platform]: account.external_id } as PublishRequest['accountIds'], idempotencyKey: randomUUID() }
    // Allocate once before the durable claim; replays keep the same bytes.
    const providerMediaUrl = await publicationMediaUrl(request.videoUrl, {
      userId: options.userId, productionId: options.productionId, kind: options.kind,
      operationId: request.idempotencyKey!, expires: Math.max(gateway.now(), Date.parse(request.scheduledAt ?? '') || 0) + 7 * 24 * 3600_000,
    }, service)
    if (providerMediaUrl) request.providerMediaUrl = providerMediaUrl
    buildPublishPayload(request)
    const operation: PublicationOperation = { id: request.idempotencyKey!, phase: 'submitting',
      createdAt: new Date(gateway.now()).toISOString(), request, accountRows: { [platform]: account.id } }
    await authorize(operation)
    operations = [...operations, operation]; await save()
    try {
      // Check revocation/approval again after the durable claim and immediately before POST.
      await authorize(operation)
      operation.results = normalize(operation, await gateway.publish(request))
      operation.phase = operation.results.some(r => r.postId) ? 'recorded' : 'submitting'
    } catch (error) {
      operation.results = [{ platform, accountId: account.external_id, success: false, status: 'unknown',
        error: error instanceof Error ? error.message : 'SUTRA_RECONCILIATION_REQUIRED' }]
    }
    await save()
  }
  return { ...publicationOutcome([...operations.flatMap(o => o.results?.length ? o.results : o.request.platforms.map(platform => ({
    platform, accountId: o.request.accountIds[platform], success: false, status: 'unknown' as const,
  }))), ...unavailable]), operations }
}
