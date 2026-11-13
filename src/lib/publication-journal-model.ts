import { createHash } from 'node:crypto'
import type { PublishRequest, PublishResult, SocialPlatform, publishToPlatforms, getPublicationResults, replayPublication, retryPublication } from '@/lib/zernio'

export interface PublicationOperation {
  id: string
  fingerprint?: string
  phase: 'queued' | 'submitting' | 'recorded' | 'retrying'
  createdAt: string
  /** Admission is not a provider attempt; start the replay window at the boundary. */
  firstAttemptAt?: string
  claimedAt?: string
  /** Explicit admission of this exact destination into the durable dispatcher. */
  dispatchRequested?: boolean
  retryRequested?: boolean
  blockedReason?: string
  nextAttemptAt?: string
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
export interface PublicationDestination {
  platform: SocialPlatform
  /** Owned social_accounts row UUID, never a provider account identifier. */
  accountId: string
}
export interface PublicationExecutionOptions {
  mode: 'enqueue' | 'drain'
  leaseToken?: string
  maxOperations?: number
}
export interface PublicationDeliveryResult extends PublishResult {
  deliveryState?: 'queued' | 'blocked'
  blockedReason?: string
}
export interface PublicationJournalRow {
  revision: number
  operations: PublicationOperation[]
  dispatch_enabled?: boolean
  next_run_at?: string | null
  lease_token?: string | null
  lease_until?: string | null
}
export const PUBLICATION_REARMABLE_BLOCK_REASONS = [
  'SUTRA_ACCOUNT_ACCESS_DENIED', 'SUTRA_ACCOUNT_REVOKED_OR_DISCONNECTED', 'SUTRA_SOCIAL_PROFILE_RECONNECTION_REQUIRED',
  'SUTRA_DESTINATION_NOT_SELECTED', 'SUTRA_DESTINATION_REVOKED', 'SUTRA_MEDIA_CHANGED', 'SUTRA_APPROVAL_REVOKED',
  'SUTRA_AUTO_PUBLICATION_NOT_AUTHORIZED', 'SUTRA_VIDEO_NOT_FOUND', 'SUTRA_VIDEO_NOT_READY',
  'SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED',
] as const
export function publicationOutcome(results: PublicationDeliveryResult[]) {
  const published = results.filter(r => r.status === 'published' && r.success).length
  const status = results.length && published === results.length ? 'published'
    : published ? 'partially_published'
    : results.some(r => r.status === 'unknown' || r.status === 'publishing') ? 'publishing'
    : results.length && results.every(r => r.status === 'scheduled') ? 'scheduled' : 'failed'
  const hasPending = results.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown'))
  return { success: status === 'published', status, hasPending, results }
}

export function operationResults(operation: PublicationOperation): PublicationDeliveryResult[] {
  return operation.request.platforms.map(platform => {
    const result = operation.results?.find(entry => entry.platform === platform)
    const confirmed = result?.status === 'published' && result.success
    const queued = !confirmed && (operation.phase === 'queued' || operation.retryRequested === true) && !operation.blockedReason
    // The claim is persisted before /retry. A crash can leave the previous
    // failure in results even though the new attempt is still unresolved.
    const retryUnconfirmed = !confirmed && operation.phase === 'retrying' && (!result || result.status === 'failed')
    return { ...(result ?? { platform, success: false, status: operation.phase === 'queued' ? 'publishing' as const : 'unknown' as const }),
      accountId: operation.request.accountIds[platform], localAccountId: operation.accountRows[platform],
      ...(queued ? { status: 'publishing' as const, success: false, error: undefined } : {}),
      ...(retryUnconfirmed ? { status: 'unknown' as const, success: false,
        error: 'SUTRA_RECONCILIATION_REQUIRED: reprise non confirmee, tentative fournisseur non identifiee' } : {}),
      ...(!confirmed && operation.blockedReason ? { deliveryState: 'blocked' as const, blockedReason: operation.blockedReason }
        : queued ? { deliveryState: 'queued' as const } : {}) }
  })
}

/** A pending observation can require intervention without authorizing more work. */
export function publicationNextRunAt(operations: PublicationOperation[], now: number): string | null {
  const next = operations.flatMap(operation => {
    if (operation.blockedReason || operation.results?.length === operation.request.platforms.length
      && operation.results.every(result => result.status === 'published' && result.success)) return []
    if (operation.phase === 'queued' || operation.retryRequested) {
      const due = Date.parse(operation.nextAttemptAt ?? '')
      return operation.dispatchRequested ? [Number.isFinite(due) ? Math.max(now, due) : now] : []
    }
    const hasPostId = operation.results?.some(result => result.postId)
    const pending = operation.phase === 'retrying' || !operation.results?.length
      || operation.results.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown'))
    if (!pending) return []
    const due = Date.parse(operation.nextAttemptAt ?? '')
    if (Number.isFinite(due)) return [Math.max(now, due)]
    if (operation.phase === 'submitting' && !hasPostId) {
      if (!operation.dispatchRequested) return []
      const claimed = Date.parse(operation.claimedAt ?? operation.firstAttemptAt ?? operation.createdAt)
      return [Number.isFinite(claimed) ? Math.max(now, claimed + 120_000) : now]
    }
    return [now + 60_000]
  })
  return next.length ? new Date(Math.min(...next)).toISOString() : null
}
export function publicationHistoryId(production: string, platform: string, account: string) {
  const hex = createHash('sha256').update(`${production}:${platform}:${account}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}


/** State transitions shared by inline publication and the bounded dispatcher. */
export function publicationOperationState(now: () => number) {
  const normalize = (operation: PublicationOperation, results: PublishResult[]) => operation.request.platforms.map(platform => {
    const matches = results.filter(r => r.platform === platform && (!r.accountId || r.accountId === operation.request.accountIds[platform]))
    const old = operation.results?.find(r => r.platform === platform)
    // A stale remote status must never erase a confirmed publication.
    if (old?.status === 'published' && old.success) return { ...old, localAccountId: operation.accountRows[platform] }
    const result = matches.length === 1 ? matches[0] : undefined
    if (operation.phase === 'retrying' && result?.status === 'failed') {
      // A GET may still return the failure from before a lost /retry response.
      // It is not evidence that this retry failed and cannot release its fence.
      return { ...result, platform, status: 'unknown' as const, success: false,
        accountId: operation.request.accountIds[platform], localAccountId: operation.accountRows[platform],
        error: 'SUTRA_RECONCILIATION_REQUIRED: reprise non confirmee, tentative fournisseur non identifiee' }
    }
    return { ...(result ?? { platform, success: false }), status: result?.status ?? 'unknown',
      success: result?.status === 'published' && result.success === true,
      ...(result?.status === 'published' ? { publishedAt: result.publishedAt ?? new Date(now()).toISOString() } : {}),
      accountId: operation.request.accountIds[platform], localAccountId: operation.accountRows[platform] }
  })
  const requireFutureSchedule = (operation: PublicationOperation) => {
    if (operation.request.scheduledAt && !(Date.parse(operation.request.scheduledAt) > now())) {
      throw new Error('SUTRA_SCHEDULE_RECONCILIATION_REQUIRED')
    }
  }
  const complete = (operation: PublicationOperation) => operation.results?.length === operation.request.platforms.length
    && operation.results.every(result => result.status === 'published' && result.success)
  const planNextAttempt = (operation: PublicationOperation) => {
    if (operation.blockedReason || complete(operation)
      || operation.phase === 'recorded' && operation.results?.every(result => result.status === 'failed' || result.status === 'published') && !operation.retryRequested) {
      delete operation.nextAttemptAt
    } else {
      const waitingForCreate = operation.phase === 'submitting' && !operation.results?.some(result => result.postId)
      operation.nextAttemptAt = new Date(now() + (waitingForCreate ? 120_000 : 60_000)).toISOString()
    }
  }
  const eligible = (operation: PublicationOperation) => {
    if (complete(operation) || operation.blockedReason) return false
    const due = Date.parse(operation.nextAttemptAt ?? '')
    if (Number.isFinite(due) && due > now()) return false
    if (operation.phase === 'queued') return operation.dispatchRequested === true
    if (operation.retryRequested && operation.dispatchRequested) return true
    if (operation.phase === 'retrying') return !!operation.results?.some(result => result.postId)
    if (operation.phase === 'submitting' && !operation.results?.some(result => result.postId)) {
      const claimed = Date.parse(operation.claimedAt ?? operation.firstAttemptAt ?? operation.createdAt)
      return operation.dispatchRequested === true && (!Number.isFinite(claimed) || now() - claimed >= 120_000)
    }
    return !!operation.results?.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown'))
  }
  return { normalize, requireFutureSchedule, complete, planNextAttempt, eligible }
}
