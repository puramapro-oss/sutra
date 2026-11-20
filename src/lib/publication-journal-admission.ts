import type { SocialPlatform } from '@/lib/zernio'
import { PUBLICATION_REARMABLE_BLOCK_REASONS, type PublicationOperation } from './publication-journal-model'

interface AdmissionAccount { id: string; platform: string; external_id: string; status: string; token_expires_at?: string | null }

/** Preflight and append only in the caller's isolated snapshot. The caller
 * commits the complete admission with one CAS after this function succeeds. */
export async function admitPublicationOperations({ operations, selections, accounts, retryFailed, now,
  connected, selected, authorize, newOperation, requireFutureSchedule }: {
  operations: PublicationOperation[]
  selections: Array<{ platform: SocialPlatform; accountId?: string }>
  accounts: AdmissionAccount[]
  retryFailed?: boolean
  now: () => number
  connected: (account: AdmissionAccount) => boolean
  selected: (operation: PublicationOperation) => boolean
  authorize: (operation: PublicationOperation) => Promise<void>
  newOperation: (platform: SocialPlatform, account: AdmissionAccount, phase: 'queued' | 'submitting') => Promise<PublicationOperation>
  requireFutureSchedule: (operation: PublicationOperation) => void
}) {
  const complete = (operation: PublicationOperation) => operation.results?.length === operation.request.platforms.length
    && operation.results.every(result => result.status === 'published' && result.success)
  if (!selections.length) throw new Error('SUTRA_INVALID_DESTINATIONS')
  const validateDestinationLimit = () => {
    const identities = new Set(operations.flatMap(operation => operation.request.platforms.map(platform => `${platform}:${operation.accountRows[platform]}`)))
    if (identities.size > 50) throw new Error('SUTRA_INVALID_DESTINATIONS')
  }
  validateDestinationLimit()
  // No provider reads or writes belong to admission. A refusal anywhere leaves
  // every new destination unaccepted; the worker can never see a prefix.
  for (const operation of operations) {
    if (!selected(operation) || complete(operation)) continue
    await authorize(operation)
    operation.dispatchRequested = true
    if (operation.phase === 'queued') {
      requireFutureSchedule(operation)
      delete operation.blockedReason
      delete operation.nextAttemptAt
    }
    if (operation.phase === 'submitting' && operation.blockedReason
      && (PUBLICATION_REARMABLE_BLOCK_REASONS as readonly string[]).includes(operation.blockedReason)) {
      const age = now() - Date.parse(operation.firstAttemptAt ?? operation.createdAt)
      if (!Number.isFinite(age) || age < 0 || age >= 24 * 3600_000 - 5 * 60_000) throw new Error('SUTRA_IDEMPOTENCY_WINDOW_EXPIRED')
      requireFutureSchedule(operation)
      // The claim may have crossed the network boundary. Re-arm only the
      // original idempotent replay; never change its phase, key or timestamp.
      delete operation.blockedReason
      delete operation.nextAttemptAt
    }
    if (retryFailed && operation.phase === 'recorded' && operation.results?.some(result => result.status === 'failed')
      && operation.results.some(result => result.postId)) {
      operation.retryRequested = true
      delete operation.blockedReason
      delete operation.nextAttemptAt
    }
  }
  for (const { platform, accountId: selection } of selections) {
    const existing = operations.find(operation => operation.request.platforms.includes(platform)
      && selection && operation.accountRows[platform] === selection)
    if (existing) continue
    const matches = (accounts ?? []).filter(account => account.platform === platform && connected(account) && (!selection || account.id === selection))
    if (matches.length !== 1 || !matches[0].external_id) throw new Error('SUTRA_ACCOUNT_SELECTION_REQUIRED')
    const account = matches[0]
    const recorded = operations.find(operation => operation.request.platforms.includes(platform)
      && operation.request.accountIds[platform] === account.external_id)
    if (recorded) {
      if (recorded.accountRows[platform] !== account.id) throw new Error('SUTRA_ACCOUNT_CHANGED_SELECTION_REQUIRED')
      continue
    }
    if (!selection && operations.some(operation => operation.request.platforms.includes(platform))) throw new Error('SUTRA_ACCOUNT_CHANGED_SELECTION_REQUIRED')
    const operation = await newOperation(platform, account, 'queued')
    await authorize(operation)
    operations.push(operation)
  }
  validateDestinationLimit()
}
