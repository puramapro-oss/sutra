import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { isSocialAccountId, readSocialOAuthAccount, socialOAuthAccountRevision, type SocialOAuthAccount } from '@/lib/social-oauth-account'

export const SOCIAL_OAUTH_TTL_SECONDS = 600
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export interface SocialOAuthBinding { profileId: string; sessionId: string; accountId?: string }
function boundDigest(state: string, binding: SocialOAuthBinding, account: SocialOAuthAccount | null): string {
  if (!/^[a-f0-9]{24}$/.test(binding.profileId) || !/^[a-f0-9-]{36}$/.test(binding.sessionId)
    || (binding.accountId !== undefined && !isSocialAccountId(binding.accountId))) throw new Error('SUTRA_OAUTH_INVALID_BINDING')
  // Versioned intent: an old singleton consent cannot silently become an add or
  // a reconnection of another account after the multi-account migration.
  return digest(JSON.stringify(['accounts-v2', state, binding.profileId, binding.sessionId,
    binding.accountId ?? null, socialOAuthAccountRevision(account)]))
}
function validState(value: string): boolean { return value.length >= 16 && value.length <= 2048 }

export function socialOAuthCookieName(state: string): string {
  return `sutra-oauth-${digest(state).slice(0, 24)}`
}

/** Bind the local state, tenant profile and verified session to a verified user and a separate HttpOnly browser secret. */
export async function issueSocialOAuthState(
  userId: string, platform: string, state: string, binding: SocialOAuthBinding, service = createServiceClient(),
  snapshot?: SocialOAuthAccount | null,
): Promise<string> {
  if (!validState(state)) throw new Error('SUTRA_OAUTH_INVALID_STATE')
  const account = snapshot === undefined ? await readSocialOAuthAccount(userId, platform, service, binding.accountId) : snapshot
  if (binding.accountId && !account) throw new Error('SUTRA_ACCOUNT_NOT_FOUND')
  if (binding.accountId ? account?.id !== binding.accountId : account !== null) throw new Error('SUTRA_OAUTH_INVALID_BINDING')
  if (account && !/^[a-f\d]{24}$/i.test(account.external_id ?? '')) throw new Error('SUTRA_SOCIAL_ACCOUNT_IDENTITY_REQUIRED')
  if (account?.metadata?.sutra_revocation_pending === true) throw new Error('SUTRA_SOCIAL_REVOCATION_PENDING')
  const browserSecret = randomBytes(32).toString('hex')
  const { error } = await service.from('social_oauth_states').insert({
    state_hash: boundDigest(state, binding, account), user_id: userId, platform,
    browser_hash: digest(browserSecret),
    expires_at: new Date(Date.now() + SOCIAL_OAUTH_TTL_SECONDS * 1000).toISOString(),
  })
  if (error) throw new Error('SUTRA_OAUTH_STATE_PERSISTENCE_FAILED')
  return browserSecret
}

/** Atomic DELETE RETURNING: a duplicate callback cannot exchange the same state. */
export async function consumeSocialOAuthState(
  userId: string, platform: string, state: string, browserSecret: string | undefined,
  binding: SocialOAuthBinding, service = createServiceClient(),
  snapshot?: SocialOAuthAccount | null,
): Promise<boolean> {
  if (!validState(state) || !browserSecret || !/^[a-f0-9]{64}$/.test(browserSecret)) return false
  const account = snapshot === undefined ? await readSocialOAuthAccount(userId, platform, service, binding.accountId) : snapshot
  if (binding.accountId ? account?.id !== binding.accountId : account !== null) return false
  if (account?.metadata?.sutra_revocation_pending === true) return false
  const { data, error } = await service.from('social_oauth_states').delete()
    .eq('state_hash', boundDigest(state, binding, account)).eq('user_id', userId).eq('platform', platform)
    .eq('browser_hash', digest(browserSecret)).gt('expires_at', new Date().toISOString())
    .select('state_hash').maybeSingle()
  if (error) throw new Error('SUTRA_OAUTH_STATE_CONSUMPTION_FAILED')
  return Boolean(data)
}
