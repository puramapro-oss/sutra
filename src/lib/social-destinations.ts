import { createServiceClient } from '@/lib/supabase'
import type { PublicationDestination } from '@/lib/publication-journal'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

/** Configuration stores owned row IDs. A new connection never grants a mandate. */
export async function readOwnedPublicationDestinations(userId: string, accountIds: string[],
  service = createServiceClient(), requireConnected = false): Promise<PublicationDestination[]> {
  if (!Array.isArray(accountIds) || accountIds.length > 50 || accountIds.some(id => typeof id !== 'string' || !id)
    || new Set(accountIds).size !== accountIds.length) throw new Error('SUTRA_INVALID_DESTINATIONS')
  if (!accountIds.length) return []
  const { data, error } = await service.schema('public').from('social_accounts')
    .select('id,platform,status,token_expires_at,metadata').eq('user_id', userId).in('id', accountIds)
  if (error) throw new Error('SUTRA_SOCIAL_ACCOUNTS_READ_FAILED')
  return accountIds.map(accountId => {
    const matches = (data ?? []).filter(account => account.id === accountId)
    const account = matches[0]
    if (matches.length !== 1 || !Object.hasOwn(PLATFORM_INFO, account.platform)
      || (requireConnected && (account.status !== 'connected' || account.metadata?.sutra_revocation_pending === true
        || (account.token_expires_at && !(Date.parse(account.token_expires_at) > Date.now()))))) {
      throw new Error('SUTRA_ACCOUNT_SELECTION_REQUIRED')
    }
    return { platform: account.platform as SocialPlatform, accountId }
  })
}

export function destinationPlatformsMatch(destinations: PublicationDestination[], platforms: string[]): boolean {
  const selected = new Set(destinations.map(destination => destination.platform as string))
  return platforms.every(platform => selected.has(platform)) && destinations.every(destination => platforms.includes(destination.platform))
}
