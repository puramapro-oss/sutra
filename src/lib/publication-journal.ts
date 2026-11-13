import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { publicationMediaUrl } from './private-media'
import { buildPublishPayload, publishToPlatforms, getPublicationResults, replayPublication, retryPublication, getAuthorizedProfileId,
  type PublishRequest, type PublishResult, type SocialPlatform } from '@/lib/zernio'
import { publicationOutcome, publicationNextRunAt, operationResults, publicationOperationState, PUBLICATION_REARMABLE_BLOCK_REASONS,
  type PublicationOperation, type PublicationGateway, type PublicationDestination, type PublicationExecutionOptions,
  type PublicationDeliveryResult, type PublicationJournalRow } from './publication-journal-model'
import { admitPublicationOperations } from './publication-journal-admission'
export * from './publication-journal-model'

const defaultGateway: PublicationGateway = {
  publish: publishToPlatforms, reconcile: getPublicationResults, replay: replayPublication, retry: retryPublication, now: Date.now,
}
/** The journal is the authority. History/video status are repairable projections.
 * A lease prevents concurrent sends; an expired lease NEVER grants a new key. */
export async function runPublicationJournal(options: {
  userId: string; productionId: string; kind: 'video' | 'auto'; platforms: SocialPlatform[]
  accountIds?: Partial<Record<SocialPlatform, string>>
  destinations?: PublicationDestination[]
  request: Omit<PublishRequest, 'platforms' | 'accountIds' | 'idempotencyKey'>
  authorize: (request: PublishRequest, accountRows: Readonly<Record<string, string>>) => Promise<void>
  legacyOperations?: PublicationOperation[]
  legacyResults?: PublishResult[]
  legacyUncertain?: boolean
  reconcileOnly?: boolean
  retryFailed?: boolean
  execution?: PublicationExecutionOptions
}, service = createServiceClient(), overrides: Partial<PublicationGateway> = {}) {
  const gateway = { ...defaultGateway, ...overrides }
  const execution = options.execution
  const enqueue = execution?.mode === 'enqueue'
  const drain = execution?.mode === 'drain'
  if (execution && (!['enqueue', 'drain'].includes(execution.mode)
    || (execution.maxOperations !== undefined && (!Number.isInteger(execution.maxOperations) || execution.maxOperations < 1 || execution.maxOperations > 50))
    || (options.reconcileOnly && enqueue))) throw new Error('SUTRA_INVALID_PUBLICATION_EXECUTION')
  if (options.destinations && (options.accountIds || options.destinations.length > 50
    || new Set(options.destinations.map(d => d.accountId)).size !== options.destinations.length
    || options.destinations.some(d => !d.accountId || !options.platforms.includes(d.platform)))) {
    throw new Error('SUTRA_INVALID_DESTINATIONS')
  }
  const selections = options.destinations ?? [...new Set(options.platforms)].map(platform => ({
    platform, accountId: options.accountIds?.[platform],
  }))
  const selected = (operation: PublicationOperation) => operation.request.platforms.every(platform => {
    // Imported grouped posts may already contain a confirmed destination. The
    // provider retry only targets failed entries; keeping that success does not
    // require selecting it again, while every unfinished entry must be selected.
    if (operation.results?.some(result => result.platform === platform && result.status === 'published' && result.success)) return true
    return selections.some(destination => destination.platform === platform
      && (destination.accountId ? destination.accountId === operation.accountRows[platform] : (() => {
        const matches = (accounts ?? []).filter(account => account.platform === platform && connected(account))
        return matches.length === 1 && matches[0].id === operation.accountRows[platform]
      })()))
  })
  const table = () => service.from('social_publication_journals')
  const scoped = () => table().select('*').eq('kind', options.kind).eq('production_id', options.productionId).eq('user_id', options.userId)
  const read = await scoped().maybeSingle()
  if (read.error) throw new Error('SUTRA_PUBLICATION_JOURNAL_READ_FAILED')
  let journal = read.data as PublicationJournalRow | null
  if (!journal) {
    if (drain) throw new Error('SUTRA_PUBLICATION_JOURNAL_INVALID')
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
  let processed = 0
  const outcome = (unavailable: PublicationDeliveryResult[] = []) => ({
    ...publicationOutcome([...operations.flatMap(operationResults), ...unavailable]), operations,
    ...(execution || journal?.dispatch_enabled ? { execution: {
      mode: execution?.mode ?? 'read', processed,
      queued: operations.flatMap(operationResults).filter(result => result.deliveryState === 'queued').length,
      nextRunAt: publicationNextRunAt(operations, gateway.now()),
    } } : {}),
  })
  // A worker-owned journal cannot fall back to the legacy inline path. Reads
  // report its durable evidence, including while a worker holds the lease.
  if (journal.dispatch_enabled && !execution) {
    if (options.reconcileOnly) return outcome()
    throw new Error('SUTRA_DURABLE_PUBLICATION_REQUIRED')
  }
  if (drain && (!journal.dispatch_enabled || !execution?.leaseToken
    || journal.lease_token !== execution.leaseToken
    || !(Date.parse(journal.lease_until ?? '') > gateway.now()))) throw new Error('SUTRA_PUBLICATION_LEASE_LOST')
  if (!drain && journal.lease_token && Date.parse(journal.lease_until ?? '') > gateway.now()) {
    throw new Error('SUTRA_PUBLICATION_LEASE_ACTIVE')
  }
  let revision = journal.revision
  const save = async () => {
    if (execution) {
      // Keep a wake-up after a provider receipt until the worker has repaired
      // every projection and released the lease, even if all targets finished.
      const nextRunAt = publicationNextRunAt(operations, gateway.now())
      const saved = await service.rpc('save_social_publication_journal', {
        p_kind: options.kind, p_production_id: options.productionId, p_user_id: options.userId,
        p_revision: revision, p_operations: operations, p_lease_token: drain ? execution.leaseToken : null,
        p_next_run_at: nextRunAt ?? (drain ? new Date(gateway.now() + 60_000).toISOString() : null),
      })
      if (saved.error || saved.data !== revision + 1) throw new Error('SUTRA_RECONCILIATION_REQUIRED: journal concurrent ou non enregistre')
      revision = saved.data
      return
    }
    let update = table().update({ operations, revision: revision + 1, updated_at: new Date(gateway.now()).toISOString() })
      .eq('kind', options.kind).eq('production_id', options.productionId).eq('user_id', options.userId).eq('revision', revision)
    if (Object.hasOwn(journal!, 'dispatch_enabled')) update = update.eq('dispatch_enabled', false).is('lease_token', null)
    const result = await update.select('revision').maybeSingle()
    if (result.error || !result.data) throw new Error('SUTRA_RECONCILIATION_REQUIRED: journal concurrent ou non enregistre')
    revision++
  }
  const accountsQuery = () => service.schema('public').from('social_accounts')
    .select('id,platform,external_id,status,token_expires_at,metadata').eq('user_id', options.userId)
  const { data: accounts, error: accountsError } = await accountsQuery()
  if (accountsError) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  const connected = (a: { status: string; token_expires_at?: string | null }) => a.status === 'connected'
    && (!a.token_expires_at || Date.parse(a.token_expires_at) > gateway.now())
  const authorize = async (operation: PublicationOperation) => {
    if (options.reconcileOnly) throw new Error('SUTRA_PUBLICATION_READ_ONLY')
    if (!selected(operation)) throw new Error('SUTRA_DESTINATION_NOT_SELECTED')
    await options.authorize(operation.request, operation.accountRows)
    // Service-role sends bypass session/RLS guards. Apply the same live profile
    // contract as account-access.ts; a prior approval cannot outlive revocation.
    const profile = await service.from('profiles').select('id,subscription_status,access_revoked_at')
      .eq('id', options.userId).maybeSingle()
    if (profile.error) throw new Error('SUTRA_ACCOUNT_ACCESS_UNAVAILABLE')
    if (!profile.data || profile.data.id !== options.userId || profile.data.subscription_status === 'banned'
      || profile.data.access_revoked_at) throw new Error('SUTRA_ACCOUNT_ACCESS_DENIED')
    const current = await accountsQuery()
    if (current.error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
    // A stored connection cannot outlive its server-side tenant binding. Check
    // again after every claim; read-only reconciliation keeps historical access.
    const authorizedProfile = getAuthorizedProfileId(options.userId)
    for (const platform of operation.request.platforms) {
      const matches = (current.data ?? []).filter(a => a.id === operation.accountRows[platform]
        && a.platform === platform && a.external_id === operation.request.accountIds[platform] && connected(a))
      if (matches.length !== 1) throw new Error('SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED')
      if (matches[0].metadata?.sutra_revocation_pending === true) throw new Error('SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED')
      if (matches[0].metadata?.credential_owner !== 'zernio'
        || matches[0].metadata?.zernio_profile_id !== authorizedProfile) throw new Error('SUTRA_SOCIAL_PROFILE_RECONNECTION_REQUIRED')
    }
  }
  const { normalize, requireFutureSchedule, complete, planNextAttempt, eligible } = publicationOperationState(gateway.now)
  const newOperation = async (platform: SocialPlatform, account: { id: string; external_id: string }, phase: 'queued' | 'submitting'): Promise<PublicationOperation> => {
    const request: PublishRequest = { ...structuredClone(options.request), platforms: [platform],
      accountIds: { [platform]: account.external_id } as PublishRequest['accountIds'], idempotencyKey: randomUUID() }
    const providerMediaUrl = await publicationMediaUrl(request.videoUrl, {
      userId: options.userId, productionId: options.productionId, kind: options.kind,
      operationId: request.idempotencyKey!, expires: Math.max(gateway.now(), Date.parse(request.scheduledAt ?? '') || 0) + 7 * 24 * 3600_000,
    }, service)
    if (providerMediaUrl) request.providerMediaUrl = providerMediaUrl
    buildPublishPayload(request)
    return { id: request.idempotencyKey!, phase, createdAt: new Date(gateway.now()).toISOString(),
      request, accountRows: { [platform]: account.id }, ...(phase === 'queued' ? { dispatchRequested: true } : {}) } satisfies PublicationOperation
  }
  for (const operation of operations) {
    if (!operation.request?.platforms?.length || !operation.request.idempotencyKey) throw new Error('SUTRA_PUBLICATION_JOURNAL_INVALID')
  }
  if (enqueue) {
    await admitPublicationOperations({ operations, selections, accounts: accounts ?? [], retryFailed: options.retryFailed,
      now: gateway.now, connected, selected, authorize, newOperation, requireFutureSchedule })
    await save()
    return outcome()
  }
  // New destinations always get a turn before older remote polls. Afterwards
  // the persisted due time rotates the remaining observations fairly.
  const selectedOperations = drain ? [...operations].filter(eligible).sort((a, b) => Number(b.phase === 'queued') - Number(a.phase === 'queued')
    || Date.parse(a.nextAttemptAt ?? a.createdAt) - Date.parse(b.nextAttemptAt ?? b.createdAt)).slice(0, execution?.maxOperations ?? 1) : operations
  for (const operation of selectedOperations) {
    if (complete(operation)) continue
    if (operation.phase === 'queued' && (!drain || options.reconcileOnly)) continue
    processed++
    const postId = operation.results?.find(r => r.postId)?.postId
    let groupedReadUnconfirmed = false
    try {
      if (operation.phase === 'queued') {
        await authorize(operation)
        requireFutureSchedule(operation)
        operation.phase = 'submitting'
        operation.firstAttemptAt ??= new Date(gateway.now()).toISOString()
        operation.claimedAt = new Date(gateway.now()).toISOString()
        planNextAttempt(operation)
        await save()
        await authorize(operation)
        requireFutureSchedule(operation)
        // Authorization performs database reads; recheck the fenced lease after
        // them so a worker that lost it cannot cross the provider boundary.
        await save()
        operation.results = normalize(operation, await gateway.publish(operation.request))
        operation.phase = operation.results.some(result => result.postId) ? 'recorded' : 'submitting'
        planNextAttempt(operation)
        await save()
      } else if (postId) {
        const confirmed = operation.results?.filter(result => result.status === 'published' && result.success) ?? []
        groupedReadUnconfirmed = operation.request.platforms.length > 1 && confirmed.length > 0
        const remote = await gateway.reconcile(postId, operation.request)
        // RetryPost accepts only a post ID, not a subset of its accounts. Do not
        // let normalization hide a remote regression that could retry a success.
        if (groupedReadUnconfirmed && confirmed.some(previous => {
          const matches = remote.filter(result => result.platform === previous.platform
            && result.accountId === operation.request.accountIds[previous.platform])
          return matches.length !== 1 || matches[0].status !== 'published' || !matches[0].success
        })) throw new Error('SUTRA_RECONCILIATION_REQUIRED: groupe distant incoherent')
        groupedReadUnconfirmed = false
        operation.results = normalize(operation, remote)
        if (drain) planNextAttempt(operation)
        await save()
        const failed = operation.results.some(r => r.status === 'failed')
        // /retry targets only failed destinations of the original post. Re-authorize
        // every original account, including imported PR3 multi-account operations.
        const retryAuthorized = drain ? operation.dispatchRequested && operation.retryRequested : options.retryFailed
        if (failed && retryAuthorized && !options.reconcileOnly && selected(operation) && operation.phase === 'recorded') {
          await authorize(operation)
          operation.phase = 'retrying'; operation.claimedAt = new Date(gateway.now()).toISOString()
          if (drain) { operation.retryRequested = false; planNextAttempt(operation) }
          await save()
          try { await authorize(operation) } catch (error) {
            // No POST was attempted: release this claim so re-authorization can
            // recover it. A lost provider response must instead stay retrying.
            operation.phase = 'recorded'; throw error
          }
          if (drain) await save()
          operation.results = normalize(operation, await gateway.retry(postId, operation.request))
          // Neither queued progress nor scheduling identifies the completed retry
          // attempt. Without a provider attempt/version marker, only confirmed
          // publication releases this fence; an older failed status cannot.
          operation.phase = operation.results.every(result => result.status === 'published' && result.success) ? 'recorded' : 'retrying'
          if (drain) planNextAttempt(operation)
          await save()
        } else if (!failed && operation.phase !== 'recorded' && operation.results.every(result => result.status !== 'unknown')
          && (operation.phase !== 'retrying' || operation.results.every(result => result.status === 'published' && result.success))) {
          operation.phase = 'recorded'; await save()
        }
      } else if (operation.phase === 'submitting' && !options.reconcileOnly && selected(operation) && (!drain || operation.dispatchRequested)) {
        const age = gateway.now() - Date.parse(operation.firstAttemptAt ?? operation.createdAt)
        const claimAge = gateway.now() - Date.parse(operation.claimedAt ?? operation.firstAttemptAt ?? operation.createdAt)
        if (claimAge < 120_000) continue
        if (!Number.isFinite(age) || age < 0 || age >= 24 * 3600_000 - 5 * 60_000) throw new Error('SUTRA_IDEMPOTENCY_WINDOW_EXPIRED')
        // Past scheduling could turn a request that never arrived into an immediate
        // publication. Preserve that intent: require remote evidence instead.
        if (operation.request.scheduledAt && Date.parse(operation.request.scheduledAt) <= gateway.now()) throw new Error('SUTRA_SCHEDULE_RECONCILIATION_REQUIRED')
        await authorize(operation)
        operation.claimedAt = new Date(gateway.now()).toISOString()
        if (drain) planNextAttempt(operation)
        await save()
        await authorize(operation)
        if (drain) { requireFutureSchedule(operation); await save() }
        operation.results = normalize(operation, await gateway.replay(operation.request))
        operation.phase = operation.results.some(r => r.postId) ? 'recorded' : 'submitting'
        if (drain) planNextAttempt(operation)
        await save()
      } else if (drain && operation.phase === 'recorded') throw new Error('SUTRA_PUBLICATION_POST_EVIDENCE_REQUIRED')
    } catch (error) {
      if (error instanceof Error && /journal concurrent ou non enregistre/.test(error.message)) throw error
      // Keep known outcomes and identity. Uncertainty never authorizes another create.
      operation.results = operation.request.platforms.map(platform => {
        const old = operation.results?.find(r => r.platform === platform)
        return old?.status === 'published' ? old : { ...old, platform, accountId: operation.request.accountIds[platform], localAccountId: operation.accountRows[platform],
          status: operation.phase === 'retrying' || groupedReadUnconfirmed ? 'unknown' : old?.status ?? 'unknown', success: false,
          error: groupedReadUnconfirmed ? 'SUTRA_RECONCILIATION_REQUIRED: groupe non confirme, compte deja publie a verifier'
            : error instanceof Error ? error.message : 'SUTRA_RECONCILIATION_REQUIRED' }
      })
      if (drain) {
        const code = error instanceof Error ? error.message.split(':')[0] : ''
        if ([...PUBLICATION_REARMABLE_BLOCK_REASONS, 'SUTRA_SCHEDULE_RECONCILIATION_REQUIRED', 'SUTRA_IDEMPOTENCY_WINDOW_EXPIRED',
          'SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE', 'SUTRA_PUBLICATION_POST_EVIDENCE_REQUIRED'].includes(code)) operation.blockedReason = code
        planNextAttempt(operation)
      }
      await save()
    }
  }
  if (drain) return outcome()
  const unavailable: PublishResult[] = []
  for (const { platform, accountId: selection } of selections) {
    const matches = (accounts ?? []).filter(a => a.platform === platform && connected(a) && (!selection || a.id === selection))
    if (matches.length !== 1 || !matches[0].external_id) {
      if ((!selection && matches.length > 1) || !operations.some(o => o.request.platforms.includes(platform) && (!selection || o.accountRows[platform] === selection))) unavailable.push({ platform, localAccountId: selection, success: false, status: 'failed', error: 'SUTRA_ACCOUNT_SELECTION_REQUIRED' })
      continue
    }
    const account = matches[0]
    if (operations.some(o => o.request.platforms.includes(platform) && o.request.accountIds[platform] === account.external_id)) continue
    if (options.reconcileOnly) {
      unavailable.push({ platform, accountId: account.external_id, localAccountId: account.id, status: 'unknown', success: false,
        error: 'SUTRA_PUBLICATION_EVIDENCE_REQUIRED' })
      continue
    }
    if (!selection && operations.some(o => o.request.platforms.includes(platform))) {
      unavailable.push({ platform, success: false, status: 'failed', error: 'SUTRA_ACCOUNT_CHANGED_SELECTION_REQUIRED' })
      continue
    }
    // Allocate once before the durable claim; replays keep the same bytes.
    const operation = await newOperation(platform, account, 'submitting')
    const request = operation.request
    try { await authorize(operation) } catch (error) {
      // A refusal for one account must not hide another account's confirmed
      // publication. No provider POST or durable claim exists for this target.
      if (!(error instanceof Error) || !['SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED',
        'SUTRA_SOCIAL_PROFILE_RECONNECTION_REQUIRED', 'SUTRA_DESTINATION_REVOKED'].includes(error.message)) throw error
      unavailable.push({ platform, accountId: account.external_id, localAccountId: account.id,
        status: 'failed', success: false, error: error.message })
      continue
    }
    operation.firstAttemptAt = new Date(gateway.now()).toISOString()
    operations = [...operations, operation]; await save()
    try {
      // Check revocation/approval again after the durable claim and immediately before POST.
      await authorize(operation)
      operation.results = normalize(operation, await gateway.publish(request))
      operation.phase = operation.results.some(r => r.postId) ? 'recorded' : 'submitting'
    } catch (error) {
      operation.results = [{ platform, accountId: account.external_id, localAccountId: account.id, success: false, status: 'unknown',
        error: error instanceof Error ? error.message : 'SUTRA_RECONCILIATION_REQUIRED' }]
    }
    await save()
  }
  return outcome(unavailable)
}
