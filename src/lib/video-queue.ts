import { isDeepStrictEqual } from 'node:util'
import { assertFinalMedia } from '@/lib/pipeline-state'
import type { AssembleResult } from '@/lib/shotstack'
import { createServiceClient } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/constants'
import { isAdmin } from '@/lib/utils'
import type { Plan, Profile } from '@/types'

// -----------------------------------------------------------------------------
// File de tâches durable + réservation de quota ATOMIQUE (migration v10).
//
// Garanties :
//   - reserveQuota : UNE instruction SQL côté Postgres (aucune fenêtre de
//     course entre requêtes concurrentes — audit #8/#9). Fail-closed : une
//     erreur RPC (migration absente, base indisponible) REFUSE la génération.
//   - enqueue/claim/checkpoint : une génération crashée à mi-chemin est
//     REPRISE (bail expiré) sans régénérer les scènes déjà obtenues
//     (progress.scenes), avec idempotency_key UNIQUE par rendu (audit #10/#14).
// -----------------------------------------------------------------------------

export type VideoJobKind = 'create' | 'production' | 'auto' | 'export'

export interface VideoJob {
  id: string
  video_id: string | null
  user_id: string
  kind: VideoJobKind
  payload: Record<string, unknown>
  progress: Record<string, unknown>
  provider_job_ids: Record<string, unknown>
  status: 'queued' | 'processing' | 'done' | 'failed' | 'cancelled' | 'reconciliation_required'
  attempts: number
  max_attempts: number
  locked_by: string | null
  last_error: string | null
  idempotency_key: string
}

/** A terminal receipt must agree with its durable stage outputs, including on replay. */
export function hasCompletedJobResult(job: Pick<VideoJob, 'kind' | 'payload' | 'progress'>): boolean {
  const result = job.progress.result
  const input = job.payload.input as { step?: unknown; musicStyle?: unknown; requiredTracks?: { voice?: boolean; music?: boolean }; config?: { default_voice_enabled?: boolean; default_music_genre?: string } } | undefined
  const steps = job.progress.steps as Record<string, { status?: unknown; value?: unknown }> | undefined
  const music = steps?.['stage:music']
  if (result === null) return job.kind === 'production' && input?.step === 'music' && input.musicStyle === 'none'
      && music?.status === 'skipped' && music.value === null
  if (result === undefined || !steps) return false
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  const url = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value !== 'null'
  if (job.kind === 'production') {
    const stage = input?.step === 'video' ? 'scenes' : input?.step
    if (['script', 'scenes', 'voice', 'music'].includes(String(stage))) {
      const checkpoint = steps[`stage:${stage}`]
      if (checkpoint?.status !== 'complete') return false
      if (stage === 'music') return url(result) && result === checkpoint.value
      if (stage === 'voice') return record(result) && url(result.url) && result.url === checkpoint.value
      if (stage === 'scenes') return Array.isArray(result) && result.length > 0
        && result.every(item => record(item) && url(item.url)) && isDeepStrictEqual(result, checkpoint.value)
      return record(result) && Array.isArray(result.scenes) && result.scenes.length > 0 && isDeepStrictEqual(result, checkpoint.value)
    }
    if (input?.step !== 'all' && input?.step !== 'assembly') return false
  }
  if (!record(result)) return false
  for (const stage of ['script', 'scenes', 'images', 'voice', 'music', 'subtitles', 'composition', 'export']) {
    if (!['complete', 'skipped'].includes(String(steps[`stage:${stage}`]?.status))) return false
  }
  if (['scenes', 'composition', 'export'].some(stage => steps[`stage:${stage}`].status !== 'complete')) return false
  const scenes = steps['stage:scenes'].value
  if (!Array.isArray(scenes) || !scenes.length) return false
  const raw = scenes.map(scene => typeof scene === 'string' ? scene : record(scene) ? scene.url : undefined)
  if (!raw.every(url)) return false
  const voice = steps['stage:voice'], script = steps['stage:script'].value
  const voiceRequired = job.kind === 'auto' ? input?.config?.default_voice_enabled === true
    : job.kind === 'export' ? input?.requiredTracks?.voice !== false
    : record(script) && typeof script.narration === 'string' && !!script.narration.trim()
  const musicRequired = job.kind === 'auto' ? !!input?.config?.default_music_genre && input.config.default_music_genre !== 'none'
    : job.kind === 'export' ? input?.requiredTracks?.music !== false
    : job.kind === 'create' ? record(script) && typeof script.music_style === 'string' && !['', 'none'].includes(script.music_style)
    : job.kind === 'production' && input?.musicStyle !== 'none'
  if ((voiceRequired && (voice.status !== 'complete' || !url(voice.value)))
    || (musicRequired && (music?.status !== 'complete' || !url(music.value)))) return false
  const media = steps['stage:export'].value
  if (!record(media)) return false
  try { assertFinalMedia(media as unknown as AssembleResult, raw, url(voice.value) || url(music?.value)) }
  catch { return false }
  const output = job.kind === 'create' ? result.videoUrl : job.kind === 'auto' ? result.videoFinalUrl
    : job.kind === 'production' && input?.step === 'all' ? (record(result.assembly) ? result.assembly.url : undefined) : result.url
  return output === media.url && (job.kind !== 'auto'
    || (['ready', 'pending_approval'].includes(String(result.status)) && result.assemblyError === null))
}

/**
 * Réservation ATOMIQUE d'une place de génération pour le mois courant.
 * @throws Error explicite si le RPC est indisponible (fail-closed : aucune
 *         génération payante ne démarre sans quota vérifiable).
 */
export async function reserveQuota(user: Profile): Promise<boolean> {
  const limit = isAdmin(user.email) ? 0 : (PLAN_LIMITS[user.plan as Plan] ?? PLAN_LIMITS.free).videos
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('reserve_video_quota', {
    p_user_id: user.id,
    p_limit: limit,
  })
  if (error) {
    throw new Error(
      `Reservation de quota indisponible (${error.message}). Aucune generation lancee — verifie que la migration v10 est appliquee.`
    )
  }
  return data === true
}

export async function completeQuota(userId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('complete_video_quota', { p_user_id: userId })
  if (error) throw new Error(`Validation quota impossible: ${error.message}`)
}

/** Do not requeue already finished media because quota accounting is uncertain. */
export async function completeQuotaForFinishedJob(userId: string, jobId: string): Promise<boolean> {
  // v11 settles quota atomically with finish_video_job. This is a read-only receipt.
  const { data, error } = await createServiceClient().from('video_jobs')
    .select('status').eq('id', jobId).eq('user_id', userId).single()
  return !error && data?.status === 'done'
}

export async function releaseQuota(userId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('release_video_quota', { p_user_id: userId })
  if (error) throw new Error(`Liberation quota impossible: ${error.message}`)
}

/**
 * Enregistre la tâche durable AVANT tout appel fournisseur. `idempotencyKey`
 * (typiquement `create-{videoId}`) rend un double-enregistrement impossible.
 */
export async function enqueueJob(params: {
  videoId: string | null
  userId: string
  kind: VideoJobKind
  payload: Record<string, unknown>
  idempotencyKey: string
  maxAttempts?: number
}): Promise<VideoJob> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('video_jobs')
    .upsert(
      {
        video_id: params.videoId,
        user_id: params.userId,
        kind: params.kind,
        payload: params.payload,
        status: 'queued',
        max_attempts: params.maxAttempts ?? 3,
        idempotency_key: params.idempotencyKey,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    )
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`Enregistrement de tache impossible : ${error?.message ?? 'reponse invalide'}`)
  }
  const job = (data as VideoJob | null) ?? await getJobByKey(params.idempotencyKey)
  if (!job) throw new Error('Enregistrement de tache introuvable')
  if (job.user_id !== params.userId || job.video_id !== params.videoId || job.kind !== params.kind || !isDeepStrictEqual(job.payload, params.payload)) {
    throw new Error('SUTRA_IDEMPOTENCY_CONFLICT: cle deja utilisee pour une autre demande')
  }
  return job
}

/** Claim exclusif d'un lot (SKIP LOCKED côté Postgres) — worker de fond. */
export async function claimJobs(worker: string, limit = 1, leaseSeconds = 600): Promise<VideoJob[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('claim_video_jobs', {
    p_worker: worker,
    p_limit: limit,
    p_lease_seconds: leaseSeconds,
  })
  if (error) throw new Error(`Claim de taches impossible : ${error.message}`)
  return (data ?? []) as VideoJob[]
}

/**
 * Claim ciblé par clé d'idempotence (exécution inline côté route) : UNE
 * instruction atomique — jamais la tâche d'un autre, jamais deux exécutants.
 * Retourne null si la tâche est déjà en cours saine ou épuisée (tentatives).
 */
export async function claimJobByKey(
  idempotencyKey: string,
  worker: string,
  leaseSeconds = 600
): Promise<VideoJob | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('claim_video_job_by_key', {
    p_key: idempotencyKey,
    p_worker: worker,
    p_lease_seconds: leaseSeconds,
  })
  if (error) throw new Error(`Claim de tache impossible : ${error.message}`)
  // setof : tableau (vide si refusé)
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as VideoJob[]
  return rows[0] ?? null
}

/** Prolonge le bail pendant une phase longue (worker vivant). */
export async function heartbeat(jobId: string, worker: string, leaseSeconds = 600): Promise<void> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('heartbeat_video_job_v2', {
    p_job_id: jobId,
    p_worker: worker,
    p_lease_seconds: leaseSeconds,
  })
  if (error || data !== true) throw new Error(`SUTRA_JOB_LEASE_LOST: ${error?.message ?? 'heartbeat not confirmed'}`)
}

/**
 * Lecture d'une tâche par clé d'idempotence — SANS claim : sert au cache
 * (tâche done → résultat checkpointé renvoyé tel quel, zéro nouvel appel
 * fournisseur) et à la détection « déjà en cours ».
 */
export async function getJobByKey(idempotencyKey: string): Promise<VideoJob | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(`Lecture de tache impossible: ${error.message}`)
  return (data as VideoJob | null) ?? null
}

/**
 * Annulation utilisateur : la tâche n'est plus claimable ET la place de
 * quota réservée est LIBÉRÉE atomiquement (côté Postgres) — jamais de place
 * réservée orpheline après annulation.
 */
export async function cancelJobByKey(idempotencyKey: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('cancel_video_job', { p_key: idempotencyKey })
    if (error || typeof data !== 'boolean') throw new Error('SUTRA_CANCEL_FAILED')
    return data
  } catch {
    // A lost or malformed ACK is not proof of cancellation. Repeating this
    // idempotent RPC is safe; never expose SQL/transport diagnostics to HTTP.
    throw new Error('SUTRA_CANCEL_FAILED: annulation non confirmée. Réessayez la même demande.')
  }
}

/**
 * Checkpoint de reprise : stocke les résultats partiels (scènes résolues,
// IDs fournisseur) — un worker qui reprend ne régénère JAMAIS l'acquis.
 */
export async function checkpoint(
  jobId: string,
  worker: string,
  progress: Record<string, unknown>,
  providerJobIds?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('checkpoint_video_job_v2', {
    p_job_id: jobId,
    p_worker: worker,
    p_progress: progress,
    p_provider_job_ids: providerJobIds ?? null,
  })
  if (error || data !== true) throw new Error(`SUTRA_CHECKPOINT_FAILED: ${error?.message ?? 'checkpoint not confirmed'}`)
}

export async function finishJob(
  jobId: string, worker: string, status: 'done' | 'failed' | 'queued' | 'reconciliation_required', lastError?: string,
): Promise<string> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('finish_video_job', {
    p_job_id: jobId, p_worker: worker, p_status: status, p_error: lastError ?? null,
  })
  // SQL may quarantine a retry, but may never acknowledge a different outcome
  // as success. Callers return the media only after this receipt is confirmed.
  if (!error && (data === status || (status === 'queued' && data === 'reconciliation_required'))) return data
  // A lost HTTP acknowledgement can follow a committed finish + quota settlement.
  // Reconcile only terminal outcomes, with a read; never repeat a mutation here
  // and never infer completion from an expired lease or a transient queue state.
  if ((error || !['done', 'failed', 'queued', 'reconciliation_required'].includes(data))
      && (status === 'done' || status === 'failed')) {
    const { data: row, error: readError } = await service.from('video_jobs')
      .select('id,status,locked_by,progress,kind,payload').eq('id', jobId).maybeSingle()
    if (!readError && row?.id === jobId && row.status === status && row.locked_by === null
        && (status === 'failed' || (row.progress && row.payload && hasCompletedJobResult(row)))) return status
  }
  throw new Error('SUTRA_JOB_FINISH_UNCONFIRMED')
}
