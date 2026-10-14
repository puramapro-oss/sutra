import { createServiceClient } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { disconnectAccount, type SocialPlatform } from '@/lib/zernio'
import { SOCIAL_OAUTH_ACCOUNT_COLUMNS, updateSocialOAuthAccount, type SocialOAuthAccount } from '@/lib/social-oauth-account'

/** Retain the account and historical foreign keys. A provider outage cannot
 * restore local publication permission or masquerade as a confirmed revoke. */
export async function revokeSocialAccount(userId: string, accountId: string,
  service = createServiceClient(), disconnect = disconnectAccount) {
  const accounts = () => service.schema('public').from('social_accounts')
  const { data: account, error } = await accounts().select(`${SOCIAL_OAUTH_ACCOUNT_COLUMNS},platform`)
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  if (!account) throw new Error('SUTRA_ACCOUNT_NOT_FOUND')
  if (account.metadata?.sutra_revocation_pending === true) {
    return { success: false, status: 'revoked', remoteStatus: 'unconfirmed' }
  }
  const pending = { status: 'revoked', updated_at: new Date().toISOString(),
    metadata: { ...account.metadata, sutra_oauth_revision: randomUUID(), sutra_revocation_pending: true } }
  const revoked = await updateSocialOAuthAccount(userId, account as SocialOAuthAccount, pending, service)
  if (revoked.error || !revoked.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  let remoteRevoked = !account.external_id
  if (account.external_id) {
    try { remoteRevoked = await disconnect(account.platform as SocialPlatform, account.external_id) } catch { remoteRevoked = false }
  }
  // An unknown DELETE may still complete remotely. Keep its durable fence until
  // explicit reconciliation; fresh consent or another DELETE would race it.
  if (!remoteRevoked) return { success: false, status: 'revoked', remoteStatus: 'unconfirmed' }
  const completed = await updateSocialOAuthAccount(userId, { ...account, ...pending } as SocialOAuthAccount,
    { metadata: { ...pending.metadata, sutra_revocation_pending: false } }, service)
  if (completed.error || !completed.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  return { success: remoteRevoked, status: 'revoked', remoteStatus: remoteRevoked ? 'revoked' : 'unconfirmed' }
}
