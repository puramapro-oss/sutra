import { createServiceClient } from '@/lib/supabase'
import { disconnectAccount, type SocialPlatform } from '@/lib/zernio'

/** Retain the account and historical foreign keys. A provider outage cannot
 * restore local publication permission or masquerade as a confirmed revoke. */
export async function revokeSocialAccount(userId: string, accountId: string,
  service = createServiceClient(), disconnect = disconnectAccount) {
  const accounts = () => service.schema('public').from('social_accounts')
  const { data: account, error } = await accounts().select('id,platform,external_id,status')
    .eq('id', accountId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  if (!account) throw new Error('SUTRA_ACCOUNT_NOT_FOUND')
  let query = accounts().update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', accountId).eq('user_id', userId)
  query = account.external_id === null ? query.is('external_id', null) : query.eq('external_id', account.external_id)
  const revoked = await query.select('id').maybeSingle()
  if (revoked.error || !revoked.data) throw new Error('SUTRA_REVOCATION_NOT_CONFIRMED')
  let remoteRevoked = !account.external_id
  if (account.external_id) {
    try { remoteRevoked = await disconnect(account.platform as SocialPlatform, account.external_id) } catch { remoteRevoked = false }
  }
  return { success: remoteRevoked, status: 'revoked', remoteStatus: remoteRevoked ? 'revoked' : 'unconfirmed' }
}
