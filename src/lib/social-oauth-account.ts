import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'

export interface SocialOAuthAccount {
  id: string
  external_id: string | null
  status: string
  updated_at: string | null
  metadata: Record<string, unknown> | null
}

export const SOCIAL_OAUTH_ACCOUNT_COLUMNS = 'id,external_id,status,updated_at,metadata'

export function isSocialAccountId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value)
}

/** A missing selection means a NEW connection, never the first account of a network. */
export async function readSocialOAuthAccount(userId: string, platform: string, service = createServiceClient(),
  accountId?: string): Promise<SocialOAuthAccount | null> {
  if (accountId === undefined) return null
  if (!isSocialAccountId(accountId)) throw new Error('SUTRA_SOCIAL_ACCOUNT_SELECTION_INVALID')
  const { data, error } = await service.schema('public').from('social_accounts')
    .select(SOCIAL_OAUTH_ACCOUNT_COLUMNS).eq('user_id', userId).eq('platform', platform).eq('id', accountId).maybeSingle()
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  return data as SocialOAuthAccount | null
}

/** Only a provider-verified external identity may be checked for an existing connection. */
export async function readSocialOAuthExternalAccount(userId: string, platform: string, externalId: string,
  service = createServiceClient()): Promise<SocialOAuthAccount | null> {
  if (!/^[a-f\d]{24}$/i.test(externalId)) throw new Error('SUTRA_SOCIAL_ACCOUNT_IDENTITY_REQUIRED')
  const { data, error } = await service.schema('public').from('social_accounts')
    .select(SOCIAL_OAUTH_ACCOUNT_COLUMNS).eq('user_id', userId).eq('platform', platform).eq('external_id', externalId).maybeSingle()
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  return data as SocialOAuthAccount | null
}

/** No wall-clock ordering: any successful connection/revocation changes the revision. */
export function socialOAuthAccountRevision(account: SocialOAuthAccount | null): string {
  return createHash('sha256').update(JSON.stringify(account ? [account.id, account.external_id,
    account.status, account.updated_at ?? null, account.metadata?.sutra_oauth_revision ?? null,
    account.metadata?.sutra_revocation_pending === true] : null)).digest('hex')
}

/** One conditional SQL UPDATE. A stale callback cannot overwrite a concurrent revoke. */
export async function updateSocialOAuthAccount(userId: string, account: SocialOAuthAccount,
  changes: Record<string, unknown>, service = createServiceClient()) {
  let query = service.schema('public').from('social_accounts').update(changes)
    .eq('id', account.id).eq('user_id', userId).eq('status', account.status)
  query = account.external_id == null ? query.is('external_id', null) : query.eq('external_id', account.external_id)
  query = account.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', account.updated_at)
  query = account.metadata == null ? query.is('metadata', null) : query.eq('metadata', JSON.stringify(account.metadata))
  return query.select('id').maybeSingle()
}
