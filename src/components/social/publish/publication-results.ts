import { accountLabel, LOCAL_ACCOUNT_ID, MAX_SELECTED_ACCOUNTS, type SocialAccount } from '@/components/settings/social/accounts'
import { PLATFORM_INFO, type PublicationStatus, type SocialPlatform } from '@/lib/zernio'
import type { PublishResultUI } from './PublishResultsSection'
import type { PublicationSnapshot } from './publication-intent'

const STATUSES: PublicationStatus[] = ['published', 'scheduled', 'publishing', 'failed', 'unknown']

export function unknownPublicationResults(accounts: SocialAccount[]): PublishResultUI[] {
  return accounts.map(account => ({
    platform: account.platform, localAccountId: account.id, accountId: account.external_id ?? undefined,
    accountLabel: accountLabel(account), status: 'unknown', success: false,
  }))
}

/** A missing, duplicated or mismatched destination must never become a success or a retry. */
export function normalizePublicationResults(raw: unknown, accounts: SocialAccount[]): PublishResultUI[] {
  if (!Array.isArray(raw)) return unknownPublicationResults(accounts)
  return unknownPublicationResults(accounts).map((fallback, index) => {
    const account = accounts[index]
    const matches = raw.filter(result => result && typeof result === 'object'
      && result.platform === account.platform
      && (typeof result.localAccountId === 'string'
        ? result.localAccountId === account.id
        : !!account.external_id && result.accountId === account.external_id)) as Record<string, unknown>[]
    if (matches.length !== 1) return fallback
    const result = matches[0]
    if (result.accountId != null && account.external_id && result.accountId !== account.external_id) return fallback
    const status = typeof result.status === 'string' && STATUSES.includes(result.status as PublicationStatus)
      ? result.status as PublicationStatus : 'unknown'
    if (result.success !== (status === 'published')) return fallback
    return { ...fallback, status, success: status === 'published',
      ...(result.canRequestRetry === true && (status === 'failed' || (status === 'unknown' && result.deliveryState === 'blocked')) ? { canRequestRetry: true } : {}),
      ...(result.deliveryState === 'queued' && status === 'publishing' ? { deliveryState: 'queued' as const } : {}),
      ...(result.deliveryState === 'blocked' && status !== 'published' ? { deliveryState: 'blocked' as const } : {}),
      postUrl: status === 'published' && typeof result.postUrl === 'string' && /^https:\/\//i.test(result.postUrl) ? result.postUrl : undefined }
  })
}

export function mergePublicationResults(previous: PublishResultUI[] | null, next: PublishResultUI[]): PublishResultUI[] {
  const confirmed = new Map((previous ?? []).filter(result => result.status === 'published' && result.success)
    .map(result => [result.localAccountId, result]))
  const nextIds = new Set(next.map(result => result.localAccountId))
  return [...(previous ?? []).filter(result => !nextIds.has(result.localAccountId)), ...next.map(result => confirmed.get(result.localAccountId) ?? result)]
}

/** A receipt restores evidence, never a caption, a selection default or retry authority. */
export function readDurablePublicationReceipt(raw: unknown, videoId: string, ownedAccounts: SocialAccount[],
  previous: PublicationSnapshot | null = null): { snapshot: PublicationSnapshot; results: PublishResultUI[] } {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  if (!record(raw) || raw.durable !== true || raw.batchId !== videoId
    || (raw.videoId !== undefined && raw.videoId !== videoId) || typeof raw.hasPending !== 'boolean'
    || !Array.isArray(raw.destinations) || !raw.destinations.length || raw.destinations.length > MAX_SELECTED_ACCOUNTS
    || !Array.isArray(raw.results) || raw.results.length !== raw.destinations.length) throw new Error('invalid_publication_receipt')
  const ids = new Set<string>()
  const destinations = raw.destinations.map(destination => {
    if (!record(destination) || typeof destination.accountId !== 'string' || !LOCAL_ACCOUNT_ID.test(destination.accountId)
      || ids.has(destination.accountId) || typeof destination.platform !== 'string' || !Object.hasOwn(PLATFORM_INFO, destination.platform)) {
      throw new Error('invalid_publication_destination')
    }
    ids.add(destination.accountId)
    return { platform: destination.platform as SocialPlatform, accountId: destination.accountId }
  })
  const rawResults = raw.results
  const accounts = destinations.map(destination => {
    const matches = rawResults.filter(result => record(result) && result.localAccountId === destination.accountId
      && result.platform === destination.platform)
    const result = matches[0]
    if (matches.length !== 1 || !record(result) || typeof result.accountId !== 'string' || !result.accountId.trim()
      || typeof result.status !== 'string' || !STATUSES.includes(result.status as PublicationStatus)
      || result.success !== (result.status === 'published')
      || (result.canRequestRetry !== undefined && typeof result.canRequestRetry !== 'boolean')
      || (result.canRequestRetry === true && result.status !== 'failed' && !(result.status === 'unknown' && result.deliveryState === 'blocked'))
      || (result.deliveryState !== undefined && !['queued', 'blocked'].includes(String(result.deliveryState)))
      || (result.deliveryState === 'queued' && (result.status !== 'publishing' || raw.hasPending !== true))
      || (result.deliveryState === 'blocked' && result.status === 'published')) throw new Error('invalid_publication_result')
    const original = previous?.accounts.find(account => account.id === destination.accountId)
    if (original && (original.platform !== destination.platform || original.external_id !== result.accountId)) {
      throw new Error('publication_identity_changed')
    }
    const current = ownedAccounts.find(account => account.id === destination.accountId
      && account.platform === destination.platform && account.external_id === result.accountId)
    return current ?? original ?? { id: destination.accountId, platform: destination.platform, external_id: result.accountId,
      username: '', display_name: `${PLATFORM_INFO[destination.platform].label} · ${destination.accountId.slice(0, 8)}`, status: 'historical' }
  })
  // A later partial/corrupt receipt cannot erase a destination already accepted.
  if (previous?.accounts.some(account => !ids.has(account.id))) throw new Error('publication_destination_missing')
  return {
    snapshot: { videoId, destinations, accounts, durable: true, hasPending: raw.hasPending },
    results: normalizePublicationResults(rawResults, accounts).map(result => ({ ...result, retryEligible: false })),
  }
}

/** A status read can advance evidence, but can never grant permission to replay. */
export function mergeReconciliationResults(previous: PublishResultUI[] | null, observed: PublishResultUI[]): PublishResultUI[] {
  const previousById = new Map((previous ?? []).map(result => [result.localAccountId, result]))
  const updates = observed.map(result => {
    const old = previousById.get(result.localAccountId)
    if (old?.status === 'published') return old
    return { ...result, retryEligible: old?.retryEligible === true && result.status === 'failed' }
  })
  return mergePublicationResults(previous, updates)
}
