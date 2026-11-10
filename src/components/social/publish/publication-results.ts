import { accountLabel, type SocialAccount } from '@/components/settings/social/accounts'
import type { PublicationStatus } from '@/lib/zernio'
import type { PublishResultUI } from './PublishResultsSection'

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
      postUrl: status === 'published' && typeof result.postUrl === 'string' && /^https:\/\//i.test(result.postUrl) ? result.postUrl : undefined }
  })
}

export function mergePublicationResults(previous: PublishResultUI[] | null, next: PublishResultUI[]): PublishResultUI[] {
  const nextIds = new Set(next.map(result => result.localAccountId))
  return [...(previous ?? []).filter(result => !nextIds.has(result.localAccountId)), ...next]
}
