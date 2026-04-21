import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { attemptUpgrade } from '@/lib/opentimestamps'
import { logApiCall } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ---------------------------------------------------------------------------
// CRON horaire — upgrade des preuves OTS « pending » vers Bitcoin-anchored.
//
// Pipeline :
//   1. stampMp4() stocke une preuve « calendar-only » (status='pending')
//      immédiatement après la génération vidéo.
//   2. Les calendars publics OpenTimestamps incluent ce stamp dans un block
//      Bitcoin (délai typique 1h – 24h).
//   3. Ce CRON réveille chaque heure les preuves pending > 30min, appelle
//      attemptUpgrade() qui :
//         a. re-demande le proof au calendar (plus complet si anchor trouvé)
//         b. verify() hit blockstream.info → extrait bloc + timestamp
//   4. Si upgraded → update DB + re-upload .ots enrichi dans Storage.
//   5. Si toujours pending → incrémente compteur, réessaie prochaine exécution.
//   6. Si 24 échecs (≈1 jour) → status='failed' (calendar injoignable
//      durablement, cas rare ; proof pending reste consultable).
//
// Auth :
//   - Production : header `Authorization: Bearer $CRON_SECRET` (aligné avec
//     les autres crons SUTRA, cf. auto-plan/route.ts).
//   - Vercel native cron : envoie ce même header automatiquement si configuré
//     dans Vercel project settings (Environment Variables → CRON_SECRET).
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET
const STORAGE_BUCKET = 'video-proofs'
const BATCH_SIZE = 50 // max preuves traitées par exécution (stay < maxDuration)
const MIN_AGE_MINUTES = 30 // ne touche pas les preuves <30min (calendar pas prêt)
const MAX_ATTEMPTS = 24 // après 24 échecs → status='failed'

type PendingProof = {
  id: string
  video_id: string
  user_id: string
  content_sha256: string
  ots_proof_base64: string
  storage_path: string
  upgrade_attempts: number
}

export async function GET(request: Request): Promise<Response> {
  const startedAt = Date.now()

  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const cutoffIso = new Date(Date.now() - MIN_AGE_MINUTES * 60_000).toISOString()

  const { data: pending, error: queryErr } = await supabase
    .from('video_proofs')
    .select(
      'id, video_id, user_id, content_sha256, ots_proof_base64, storage_path, upgrade_attempts',
    )
    .eq('status', 'pending')
    .lte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
    .returns<PendingProof[]>()

  if (queryErr) {
    await logApiCall(
      null,
      'opentimestamps',
      '/api/cron/upgrade-ots-proofs',
      'error',
      Date.now() - startedAt,
      `db query: ${queryErr.message}`,
    )
    return NextResponse.json(
      { error: 'db_query', detail: queryErr.message },
      { status: 500 },
    )
  }

  const rows = pending ?? []
  let upgraded = 0
  let stillPending = 0
  let failed = 0

  for (const proof of rows) {
    const result = await attemptUpgrade(proof.ots_proof_base64, proof.content_sha256)
    const nextAttemptCount = proof.upgrade_attempts + 1

    if (result.status === 'upgraded') {
      // Re-upload le .ots enrichi (Bitcoin attestation incluse) au même path.
      const upgradedBytes = Buffer.from(result.proofBase64, 'base64')
      const upload = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(proof.storage_path, upgradedBytes, {
          contentType: 'application/x-opentimestamps',
          upsert: true,
        })

      const nowIso = new Date().toISOString()
      const update = await supabase
        .from('video_proofs')
        .update({
          ots_upgraded_proof: result.proofBase64,
          bitcoin_block_height: result.bitcoinBlockHeight,
          bitcoin_timestamp: result.bitcoinTimestamp.toISOString(),
          status: 'verified',
          upgraded_at: nowIso,
          verified_at: nowIso,
          last_upgrade_attempt_at: nowIso,
          upgrade_attempts: nextAttemptCount,
          failure_reason: upload.error
            ? `storage_reupload_warning: ${upload.error.message}`
            : null,
        })
        .eq('id', proof.id)

      if (update.error) {
        failed += 1
        await logApiCall(
          proof.user_id,
          'opentimestamps',
          '/api/cron/upgrade-ots-proofs',
          'error',
          undefined,
          `update verified row ${proof.id}: ${update.error.message}`,
        )
      } else {
        upgraded += 1
      }
      continue
    }

    if (result.status === 'pending') {
      const update = await supabase
        .from('video_proofs')
        .update({
          ots_proof_base64: result.proofBase64, // calendar peut avoir enrichi sans anchor
          last_upgrade_attempt_at: new Date().toISOString(),
          upgrade_attempts: nextAttemptCount,
        })
        .eq('id', proof.id)
      if (update.error) {
        await logApiCall(
          proof.user_id,
          'opentimestamps',
          '/api/cron/upgrade-ots-proofs',
          'error',
          undefined,
          `update pending row ${proof.id}: ${update.error.message}`,
        )
      }
      stillPending += 1
      continue
    }

    // result.status === 'failed'
    const shouldGiveUp = nextAttemptCount >= MAX_ATTEMPTS
    const update = await supabase
      .from('video_proofs')
      .update({
        last_upgrade_attempt_at: new Date().toISOString(),
        upgrade_attempts: nextAttemptCount,
        failure_reason: result.error,
        ...(shouldGiveUp ? { status: 'failed' } : {}),
      })
      .eq('id', proof.id)

    if (update.error) {
      await logApiCall(
        proof.user_id,
        'opentimestamps',
        '/api/cron/upgrade-ots-proofs',
        'error',
        undefined,
        `update failed row ${proof.id}: ${update.error.message}`,
      )
    }
    failed += 1
  }

  const durationMs = Date.now() - startedAt
  await logApiCall(
    null,
    'opentimestamps',
    '/api/cron/upgrade-ots-proofs',
    'success',
    durationMs,
    undefined,
  )

  return NextResponse.json({
    scanned: rows.length,
    upgraded,
    still_pending: stillPending,
    failed,
    duration_ms: durationMs,
  })
}
