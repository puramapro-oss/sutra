import { createHash, randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'

export const SOCIAL_OAUTH_TTL_SECONDS = 600
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export interface SocialOAuthBinding { profileId: string; sessionId: string }
function boundDigest(state: string, binding: SocialOAuthBinding): string {
  if (!/^[a-f0-9]{24}$/.test(binding.profileId) || !/^[a-f0-9-]{36}$/.test(binding.sessionId)) throw new Error('SUTRA_OAUTH_INVALID_BINDING')
  return digest(JSON.stringify([state, binding.profileId, binding.sessionId]))
}
function validState(value: string): boolean { return value.length >= 16 && value.length <= 2048 }

export function socialOAuthCookieName(state: string): string {
  return `sutra-oauth-${digest(state).slice(0, 24)}`
}

/** Bind the local state, tenant profile and verified session to a verified user and a separate HttpOnly browser secret. */
export async function issueSocialOAuthState(
  userId: string, platform: string, state: string, binding: SocialOAuthBinding, service = createServiceClient(),
): Promise<string> {
  if (!validState(state)) throw new Error('SUTRA_OAUTH_INVALID_STATE')
  const browserSecret = randomBytes(32).toString('hex')
  const { error } = await service.from('social_oauth_states').insert({
    state_hash: boundDigest(state, binding), user_id: userId, platform,
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
): Promise<boolean> {
  if (!validState(state) || !browserSecret || !/^[a-f0-9]{64}$/.test(browserSecret)) return false
  const { data, error } = await service.from('social_oauth_states').delete()
    .eq('state_hash', boundDigest(state, binding)).eq('user_id', userId).eq('platform', platform)
    .eq('browser_hash', digest(browserSecret)).gt('expires_at', new Date().toISOString())
    .select('state_hash').maybeSingle()
  if (error) throw new Error('SUTRA_OAUTH_STATE_CONSUMPTION_FAILED')
  return Boolean(data)
}
