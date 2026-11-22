import type { createServiceClient } from '@/lib/supabase'
import { EMAIL_SEQUENCES, sequenceEmailHtml, type EmailSequence } from '@/lib/email-sequence-templates'

type Database = ReturnType<typeof createServiceClient>
type Profile = { id: string; email: string; name: string | null; email_preferences: unknown; subscription_status: string | null; access_revoked_at: string | null }
type Receipt = { id: string; sent_at: string | null; provider_message_id?: string | null }
type Send = (message: { from: string; to: string; subject: string; html: string }, options: { idempotencyKey: string }) => Promise<{
  data: { id?: string } | null; error: unknown
}>
const COLUMNS = 'id, email, name, email_preferences, subscription_status, access_revoked_at'
const PAGE_SIZE = 100

async function observeTransport<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let rejectAbort: (reason: unknown) => void = () => undefined
  const interrupted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
  const onAbort = () => rejectAbort(new Error('SEQUENCE_TRANSPORT_INTERRUPTED'))
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    signal.throwIfAborted()
    return await Promise.race([run(), interrupted])
  } finally { signal.removeEventListener('abort', onAbort) }
}

export function maySendSequence(profile: Profile | null, sequence: EmailSequence): profile is Profile {
  const preferences = profile?.email_preferences
  return Boolean(profile && !profile.access_revoked_at && profile.subscription_status !== 'banned'
    && typeof profile.id === 'string' && typeof profile.email === 'string'
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email) && profile.email.length <= 320
    && preferences && typeof preferences === 'object'
    && (preferences as Record<string, unknown>)[sequence.preference] === true)
}

export function sequenceWindow(now: Date, days: number) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days))
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() }
}

/** Existing unique(user_id,email_type) is the admission fence. A NULL sent_at is
 * a durable unresolved intent, never proof of delivery and never a fresh retry.
 * The provider's 24-hour idempotency window must not become a replay after expiry. */
export async function runEmailSequences(database: Database, send: Send, signal: AbortSignal, now = new Date()) {
  const result = { emailsSent: 0, alreadySent: 0, skippedPreferences: 0, needsReconciliation: 0, reconciliationComplete: false, errors: 0, incomplete: false }
  const available = () => {
    if (signal.aborted) { result.incomplete = true; return false }
    return true
  }
  if (!available()) return result
  // Observe unresolved intents independently of candidate eligibility and the
  // daily campaign window. An opt-out or an older window never erases ambiguity.
  // This is a start-of-run snapshot, plus newly observed unresolved admissions.
  const { count: pending, error: pendingError } = await database.from('email_sequences')
    .select('id', { count: 'exact', head: true }).is('sent_at', null)
    .in('email_type', EMAIL_SEQUENCES.map(sequence => sequence.type)).abortSignal(signal)
  if (pendingError || typeof pending !== 'number' || !Number.isSafeInteger(pending) || pending < 0) {
    result.errors++; available(); return result
  }
  result.needsReconciliation = pending
  result.reconciliationComplete = true
  const currentProfile = async (id: string) => {
    const { data, error } = await database.from('profiles').select(COLUMNS).eq('id', id).abortSignal(signal).maybeSingle()
    if (error || (data && data.id !== id)) throw new Error('SEQUENCE_PROFILE_UNAVAILABLE')
    return data as Profile | null
  }
  async function processProfile(candidate: Profile, sequence: EmailSequence) {
    if (!maySendSequence(candidate, sequence)) { result.skippedPreferences++; return }
    if (!available()) return
    const { data: history, error: historyError } = await database.from('email_sequences')
      .select('id, sent_at, provider_message_id').eq('user_id', candidate.id).eq('email_type', sequence.type).abortSignal(signal).maybeSingle()
    if (historyError) throw new Error('SEQUENCE_HISTORY_UNAVAILABLE')
    if (history) {
      const receipt = history as Receipt
      if (typeof receipt.sent_at === 'string' && Number.isFinite(Date.parse(receipt.sent_at))) result.alreadySent++
      else result.needsReconciliation++
      return
    }
    const beforeClaim = await currentProfile(candidate.id)
    if (!maySendSequence(beforeClaim, sequence)) { result.skippedPreferences++; return }
    if (!available()) return
    const { data: reserved, error: reservationError } = await database.from('email_sequences')
      .insert({ user_id: candidate.id, email_type: sequence.type, sent_at: null })
      .select('id, sent_at').abortSignal(signal).single()
    if (reservationError?.code === '23505') return
    if (reservationError || !reserved || typeof reserved.id !== 'string' || reserved.sent_at !== null) {
      throw new Error('SEQUENCE_RESERVATION_UNCONFIRMED')
    }
    let confirmed = false
    try {
      // Settings/account can change while waiting for admission.
      const current = await currentProfile(candidate.id)
      if (!maySendSequence(current, sequence)) { result.skippedPreferences++; return }
      if (!available()) return
      const { data, error } = await observeTransport(() => send({
        from: 'SUTRA <noreply@purama.dev>', to: current.email, subject: sequence.subject,
        html: sequenceEmailHtml(sequence, typeof current.name === 'string' ? current.name : 'Créateur'),
      }, { idempotencyKey: `sutra-sequence/${reserved.id}` }), signal)
      if (error || typeof data?.id !== 'string' || !data.id.trim()) throw new Error('SEQUENCE_PROVIDER_UNCONFIRMED')
      const acceptedAt = new Date().toISOString()
      const { data: saved, error: saveError } = await database.from('email_sequences')
        .update({ sent_at: acceptedAt, provider_message_id: data.id })
        .eq('id', reserved.id).eq('user_id', current.id).is('sent_at', null)
        .select('id, sent_at, provider_message_id').abortSignal(signal).single()
      if (saveError || saved?.id !== reserved.id || Date.parse(saved?.sent_at) !== Date.parse(acceptedAt) || saved?.provider_message_id !== data.id) {
        throw new Error('SEQUENCE_RECEIPT_UNCONFIRMED')
      }
      confirmed = true; result.emailsSent++
    } finally {
      // Never release an intent after uncertain transport/receipt persistence.
      if (!confirmed) result.needsReconciliation++
    }
  }
  for (const sequence of EMAIL_SEQUENCES) {
    const window = sequenceWindow(now, sequence.dayOffset)
    let after: string | undefined
    while (available()) {
      // Exclude all existing intents in SQL. Restarting after a deadline now
      // reaches fresh candidates instead of rereading a completed prefix.
      const { data, error } = await database.rpc('email_sequence_candidates', {
        p_email_type: sequence.type, p_start: window.start, p_end: window.end,
        p_after: after ?? null, p_limit: PAGE_SIZE,
      }).abortSignal(signal)
      if (error || !Array.isArray(data)) { result.errors++; break }
      let previous = after
      const ordered = data.length <= PAGE_SIZE && data.every(candidate => {
        const id = candidate?.id
        if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)
          || (previous && id <= previous)) return false
        previous = id; return true
      })
      if (!ordered) { result.errors++; break }
      for (const candidate of data as Profile[]) {
        if (!available()) break
        try { await processProfile(candidate, sequence) }
        catch { result.errors++ }
      }
      if (data.length < PAGE_SIZE) break
      const last = data.at(-1)?.id
      if (typeof last !== 'string' || (after && last <= after)) { result.errors++; break }
      after = last
    }
    if (!available()) break
  }
  return result
}
