import { createServiceClient } from '@/lib/supabase'
import { PUBLICATION_REARMABLE_BLOCK_REASONS, publicationOutcome, type PublicationOperation } from '@/lib/publication-journal'
import type { PublishResult, SocialPlatform } from '@/lib/zernio'

export interface DurablePublicationResult {
  platform: SocialPlatform
  localAccountId: string
  accountId?: string
  status: NonNullable<PublishResult['status']>
  success: boolean
  postUrl?: string
  deliveryState?: 'queued' | 'blocked'
  errorCode?: string
  canRequestRetry?: boolean
}

/** Public receipt deliberately excludes provider payloads, signed media URLs,
 * idempotency keys and the worker lease. Reading it never contacts a provider. */
export function durablePublicationReceipt(videoId: string, operations: PublicationOperation[], updatedAt?: string) {
  const results: DurablePublicationResult[] = operations.flatMap(operation => operation.request.platforms.map(platform => {
    const matches = (operation.results ?? []).filter(result => result.platform === platform
      && (!result.accountId || result.accountId === operation.request.accountIds[platform]))
    const observed = matches.length === 1 ? matches[0] : undefined
    const confirmed = observed?.status === 'published' && observed.success === true
    const queued = !confirmed && (operation.phase === 'queued' || operation.retryRequested === true)
    const blocked = !confirmed && !!operation.blockedReason
    const status = queued ? (blocked ? 'failed' : 'publishing')
      : operation.phase === 'retrying' && observed?.status === 'failed' ? 'unknown' : observed?.status ?? 'unknown'
    const published = status === 'published' && observed?.success === true
    const attemptAge = Date.now() - Date.parse(operation.firstAttemptAt ?? operation.createdAt)
    const scheduleStillValid = !operation.request.scheduledAt || Date.parse(operation.request.scheduledAt) > Date.now()
    const rearmable = blocked && (PUBLICATION_REARMABLE_BLOCK_REASONS as readonly string[]).includes(operation.blockedReason!)
      && scheduleStillValid && (operation.phase === 'queued' || operation.phase === 'submitting'
        && Number.isFinite(attemptAge) && attemptAge >= 0 && attemptAge < 24 * 3600_000 - 5 * 60_000)
    const canRequestRetry = operation.dispatchRequested === true && operation.retryRequested !== true && (
      (operation.phase === 'recorded' && status === 'failed' && !!observed?.postId)
      || rearmable)
    return {
      platform, localAccountId: operation.accountRows[platform], accountId: operation.request.accountIds[platform],
      status: status === 'published' && !published ? 'unknown' : status, success: published,
      canRequestRetry,
      ...(published && observed?.postUrl && /^https:\/\//i.test(observed.postUrl) ? { postUrl: observed.postUrl } : {}),
      ...(blocked ? { deliveryState: 'blocked' as const } : queued ? { deliveryState: 'queued' as const } : {}),
      ...(/^SUTRA_[A-Z_]+/.test(operation.blockedReason ?? observed?.error ?? '')
        ? { errorCode: (operation.blockedReason ?? observed?.error)!.match(/^SUTRA_[A-Z_]+/)![0] } : {}),
    }
  }))
  const outcome = publicationOutcome(results)
  return {
    ...outcome, results, batchId: videoId, videoId, durable: true as const,
    hasPending: results.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status)),
    destinations: results.map(result => ({ platform: result.platform, accountId: result.localAccountId })),
    ...(updatedAt ? { updatedAt } : {}),
  }
}

export async function readDurablePublicationReceipt(userId: string, videoId: string, service = createServiceClient()) {
  const { data, error } = await service.from('social_publication_journals')
    .select('operations,dispatch_enabled,updated_at').eq('kind', 'video').eq('production_id', videoId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SUTRA_PUBLICATION_JOURNAL_READ_FAILED')
  if (!data?.dispatch_enabled) return null
  if (!Array.isArray(data.operations)) throw new Error('SUTRA_PUBLICATION_JOURNAL_INVALID')
  return durablePublicationReceipt(videoId, data.operations as PublicationOperation[], data.updated_at)
}
