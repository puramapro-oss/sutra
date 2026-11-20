import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

export const MAX_SELECTED_ACCOUNTS = 50
export const LOCAL_ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  external_id?: string | null
  username: string
  display_name?: string | null
  avatar_url?: string | null
  status: string
  connected_at?: string
  token_expires_at?: string | null
}

export function readSocialAccounts(value: unknown): SocialAccount[] {
  if (!Array.isArray(value)) throw new Error('invalid_social_accounts')
  const ids = new Set<string>()
  for (const account of value) {
    if (!account || typeof account !== 'object' || typeof account.id !== 'string'
      || !LOCAL_ACCOUNT_ID.test(account.id) || ids.has(account.id)
      || typeof account.platform !== 'string' || !Object.hasOwn(PLATFORM_INFO, account.platform)
      || typeof account.username !== 'string' || typeof account.status !== 'string'
      || (account.display_name != null && typeof account.display_name !== 'string')
      || (account.external_id != null && typeof account.external_id !== 'string')
      || (account.token_expires_at != null && typeof account.token_expires_at !== 'string')) {
      throw new Error('invalid_social_account')
    }
    ids.add(account.id)
  }
  return value as SocialAccount[]
}

export function isAccountAvailable(account: SocialAccount, now = Date.now()): boolean {
  return account.status === 'connected'
    && (account.token_expires_at == null || Date.parse(account.token_expires_at) > now)
}

export function accountLabel(account: Pick<SocialAccount, 'username' | 'display_name'>): string {
  const handle = account.username.trim().replace(/^@/, '')
  const name = account.display_name?.trim()
  return name && handle ? `${name} · @${handle}` : name || (handle ? `@${handle}` : 'Compte sans nom')
}

export function platformsForAccounts(accounts: SocialAccount[], accountIds: readonly string[]): SocialPlatform[] {
  const selected = new Set(accountIds)
  return [...new Set(accounts.filter(account => selected.has(account.id)).map(account => account.platform))]
}

export function validAccountIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_SELECTED_ACCOUNTS
    && value.every(id => typeof id === 'string' && LOCAL_ACCOUNT_ID.test(id))
    && new Set(value).size === value.length
}
