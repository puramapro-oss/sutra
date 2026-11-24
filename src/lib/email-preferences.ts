import type { createClient } from '@/lib/supabase'
import type { EmailPreferences } from '@/types'

export const EMAIL_PREFERENCE_KEYS = ['welcome', 'digest', 'inactivity', 'tips', 'contest', 'referral'] as const

export function normalizeEmailPreferences(value: unknown): EmailPreferences {
  const object = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return Object.fromEntries(EMAIL_PREFERENCE_KEYS.map(key => [key, object[key] === true])) as unknown as EmailPreferences
}

export async function saveEmailPreferences(
  client: ReturnType<typeof createClient>, ownerId: string, preferences: EmailPreferences, signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || user?.id !== ownerId) throw new Error('EMAIL_PREFERENCES_SESSION_CHANGED')
  signal.throwIfAborted()
  const requested = normalizeEmailPreferences(preferences)
  const { data, error } = await client.from('profiles').update({ email_preferences: requested }).eq('id', ownerId)
    .select('id, email_preferences').abortSignal(signal).single()
  signal.throwIfAborted()
  if (error || data?.id !== ownerId || EMAIL_PREFERENCE_KEYS.some(key => data?.email_preferences?.[key] !== requested[key])) {
    throw new Error('EMAIL_PREFERENCES_SAVE_UNCONFIRMED')
  }
  const { data: current, error: currentError } = await client.auth.getUser()
  signal.throwIfAborted()
  if (currentError) throw new Error('EMAIL_PREFERENCES_SESSION_UNVERIFIED')
  return current.user?.id === ownerId
}
