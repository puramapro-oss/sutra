import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { publishVideoRecord } from '@/lib/social-publication'
import type { PublicationOperation } from '@/lib/publication-journal'

interface PublicationLease {
  kind: 'video'
  production_id: string
  user_id: string
  operations: PublicationOperation[]
  lease_token: string
  dispatch_enabled: boolean
  dispatch_attempts: number
}

/** One journal lease, one bounded provider operation, then a durable release.
 * The same journal wakes again after a crash, including projection failures. */
export async function drainSocialPublications(service = createServiceClient(),
  run = publishVideoRecord, now = Date.now) {
  const started = now()
  const receipts: Array<{ batchId: string; status: 'processed' | 'deferred' | 'write_unconfirmed'; errorCode?: string }> = []
  // An operation can take two provider calls (GET + an explicitly ordered retry).
  // Never start one after 70s: the existing adapter's two 90s bounds fit 300s.
  while (receipts.length < 4 && now() - started < 70_000) {
    const token = randomUUID()
    const claim = await service.rpc('claim_social_publication_journals', {
      p_lease_token: token, p_limit: 1, p_lease_seconds: 240,
    })
    if (claim.error) throw new Error('SUTRA_PUBLICATION_WORKER_UNAVAILABLE')
    if (!Array.isArray(claim.data)) throw new Error('SUTRA_PUBLICATION_CLAIM_INVALID')
    if (!claim.data.length) break
    const journal = claim.data[0] as PublicationLease
    if (claim.data.length !== 1 || journal.kind !== 'video' || journal.lease_token !== token
      || journal.dispatch_enabled !== true || !Array.isArray(journal.operations) || !journal.operations.length) {
      throw new Error('SUTRA_PUBLICATION_CLAIM_INVALID')
    }
    let nextRunAt: string | null = null
    let errorCode: string | undefined
    try {
      const destinations = journal.operations.filter(operation => operation.dispatchRequested === true)
        .flatMap(operation => operation.request.platforms.map(platform => ({ platform, accountId: operation.accountRows[platform] })))
      const unique = [...new Map(destinations.map(destination => [destination.accountId, destination])).values()]
      const outcome = await run(journal.user_id, {
        videoId: journal.production_id, platforms: [...new Set(unique.map(destination => destination.platform))],
        destinations: unique, autoCaption: false,
      }, service, undefined, undefined, { now }, undefined, { mode: 'drain', leaseToken: token, maxOperations: 1 })
      if ('reconciliationRequired' in outcome) throw new Error('SUTRA_PUBLICATION_RECONCILIATION_REQUIRED')
      if (!outcome.execution || outcome.execution.mode !== 'drain') throw new Error('SUTRA_PUBLICATION_WORKER_UNCONFIRMED')
      nextRunAt = outcome.execution.nextRunAt
    } catch (error) {
      errorCode = error instanceof Error ? error.message.match(/^SUTRA_[A-Z_]+/)?.[0] : undefined
      errorCode ??= 'SUTRA_PUBLICATION_WORKER_UNCONFIRMED'
      // The intent/key stays intact. This is a wake-up, never a new create order.
      const delay = Math.min(20 * 60_000, 60_000 * 2 ** Math.min(journal.dispatch_attempts, 4))
      nextRunAt = new Date(now() + delay).toISOString()
    }
    const released = await service.rpc('release_social_publication_journal', {
      p_kind: journal.kind, p_production_id: journal.production_id, p_user_id: journal.user_id,
      p_lease_token: token, p_next_run_at: nextRunAt, p_error_code: errorCode ?? null,
    })
    const confirmed = !released.error && released.data === true
    receipts.push({ batchId: journal.production_id, status: !confirmed ? 'write_unconfirmed' : errorCode ? 'deferred' : 'processed',
      ...(errorCode ? { errorCode } : {}) })
    if (!confirmed) break
  }
  return { processed: receipts.length, receipts, confirmed: receipts.every(receipt => receipt.status !== 'write_unconfirmed') }
}
