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
  status: 'queued' | 'processing' | 'done' | 'failed' | 'cancelled'
  attempts: number
  max_attempts: number
  locked_by: string | null
  last_error: string | null
  idempotency_key: string
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
  await supabase.rpc('complete_video_quota', { p_user_id: userId })
}

export async function releaseQuota(userId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.rpc('release_video_quota', { p_user_id: userId })
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
      { onConflict: 'idempotency_key', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Enregistrement de tache impossible : ${error?.message ?? 'reponse invalide'}`)
  }
  return data as VideoJob
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
  await supabase.rpc('heartbeat_video_job', {
    p_job_id: jobId,
    p_worker: worker,
    p_lease_seconds: leaseSeconds,
  })
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
  await supabase.rpc('checkpoint_video_job', {
    p_job_id: jobId,
    p_worker: worker,
    p_progress: progress,
    p_provider_job_ids: providerJobIds ?? null,
  })
}

export async function finishJob(
  jobId: string,
  status: 'done' | 'failed' | 'cancelled' | 'queued',
  lastError?: string | null
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('video_jobs')
    .update({ status, last_error: lastError ?? null, lease_until: null, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}
