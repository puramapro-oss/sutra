import { createServiceClient } from '@/lib/supabase'
import { randomUUID } from 'node:crypto'
import { disconnectAccount, getAuthorizedProfileId, type SocialPlatform } from '@/lib/zernio'
import { SOCIAL_OAUTH_ACCOUNT_COLUMNS, readSocialOAuthAccount, updateSocialOAuthAccount, type SocialOAuthAccount } from '@/lib/social-oauth-account'

/** Retain the account and historical foreign keys. A provider outage cannot
 * restore local publication permission or masquerade as a confirmed revoke. */
export async function revokeSocialAccount(userId: string, accountId: string,
  service = createServiceClient(), disconnect = disconnectAccount) {
  const accounts = () => service.schema('public').from('social_accounts')
  const { data: account, error } = await accounts().select(`${SOCIAL_OAUTH_ACCOUNT_COLUMNS},platform`)
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  if (!account) throw new Error('SUTRA_ACCOUNT_NOT_FOUND')
  const clearedCredentials = { access_token: null, refresh_token: null, token_expires_at: null }
  if (account.status === 'revoked' && account.metadata?.sutra_revocation_pending === false) {
    // Confirmed revocation is terminal until fresh consent. Clean any legacy
    // credentials without sending another DELETE or rotating its revision.
    const cleaned = await updateSocialOAuthAccount(userId, account as SocialOAuthAccount, clearedCredentials, service)
    if (cleaned.error || !cleaned.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
    return { success: true, status: 'revoked', remoteStatus: 'revoked' }
  }
  if (account.metadata?.sutra_revocation_pending === true) {
    const cleaned = await updateSocialOAuthAccount(userId, account as SocialOAuthAccount, clearedCredentials, service)
    if (cleaned.error || !cleaned.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
    return { success: false, status: 'revoked', remoteStatus: 'unconfirmed' }
  }
  const pending = { ...clearedCredentials, status: 'revoked', updated_at: new Date().toISOString(),
    metadata: { ...account.metadata, sutra_oauth_revision: randomUUID(), sutra_revocation_pending: true } }
  const revoked = await updateSocialOAuthAccount(userId, account as SocialOAuthAccount, pending, service)
  if (revoked.error || !revoked.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  let remoteRevoked = !account.external_id
  if (account.external_id) {
    try {
      // Keep the local fence even when tenant authority has changed. The
      // provider credential spans profiles: a historical account ID alone
      // cannot authorize its deletion. Recheck after the awaited CAS too.
      const profileId = getAuthorizedProfileId(userId)
      if (account.metadata?.zernio_profile_id === profileId && account.metadata?.credential_owner === 'zernio') {
        remoteRevoked = await disconnect(account.platform as SocialPlatform, account.external_id)
      }
    } catch { remoteRevoked = false }
  }
  // An unknown DELETE may still complete remotely. Keep its durable fence until
  // explicit reconciliation; fresh consent or another DELETE would race it.
  if (!remoteRevoked) return { success: false, status: 'revoked', remoteStatus: 'unconfirmed' }
  // The DB updated_at trigger replaces the client clock. Reload the committed
  // snapshot after remote confirmation, retaining ownership of this operation:
  // a concurrent cleanup may change the timestamp, never its revision/target.
  const current = await readSocialOAuthAccount(userId, account.platform, service)
  if (!current || current.id !== account.id || current.external_id !== account.external_id || current.status !== 'revoked'
    || current.metadata?.sutra_oauth_revision !== pending.metadata.sutra_oauth_revision
    || current.metadata?.sutra_revocation_pending !== true
    || current.metadata?.credential_owner !== pending.metadata.credential_owner
    || current.metadata?.zernio_profile_id !== pending.metadata.zernio_profile_id) {
    throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  }
  const completed = await updateSocialOAuthAccount(userId, current,
    { metadata: { ...current.metadata, sutra_revocation_pending: false } }, service)
  if (completed.error || !completed.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  return { success: remoteRevoked, status: 'revoked', remoteStatus: remoteRevoked ? 'revoked' : 'unconfirmed' }
}
