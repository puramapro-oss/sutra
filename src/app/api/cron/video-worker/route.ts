/**
 * CRON WORKER — reprise des tâches vidéo durables (migration v10).
 *
 * Chaque passage :
 *   1. claim exclusif (SKIP LOCKED) des tâches prêtes : 'queued', ou
 *      'processing' au bail expiré (= requête inline morte en cours de route,
 *      audit #14) tant que attempts < max_attempts.
 *   2. exécution du pipeline AVEC le checkpoint : les scènes déjà résolues ne
 *      sont JAMAIS régénérées (audit #10 — pas de double génération payante).
 *   3. settlement du quota : complete en succès, release en échec final.
 *
 * Protégé par CRON_SECRET (obligatoire — refus explicite sinon).
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { claimJobs, checkpoint, finishJob, heartbeat, completeQuota, releaseQuota } from '@/lib/video-queue'
import { executeCreateJob, type CreateJobInput, type CreateJobResume } from '@/lib/video-pipeline'
import { executeProductionStep, type ProductionJobInput } from '@/lib/production-pipeline'
import { executeExportJob, type ExportJobInput } from '@/lib/export-pipeline'
import { executeAutoJob, buildAutoProviders, type AutoJobInput } from '@/lib/auto-pipeline'
import { assembleFinalVideo } from '@/lib/shotstack'
import { sendNotification, logActivity } from '@/lib/logger'
import type { AssembleClip } from '@/lib/shotstack'

export const maxDuration = 300

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[video-worker] CRON_SECRET non configure — execution refusee')
    return NextResponse.json(
      { error: 'CRON_SECRET non configure : definis-le avant d\'activer le worker (aucune execution non authentifiee)' },
      { status: 500 }
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const worker = `worker-${Math.random().toString(36).slice(2, 8)}`
  const limit = 1 // un rendu par passage : les phases fournisseur sont longues

  let jobs: Awaited<ReturnType<typeof claimJobs>> = []
  try {
    jobs = await claimJobs(worker, limit, 600)
  } catch (err) {
    return NextResponse.json(
      { error: `Claim impossible (migration v10 requise ?) : ${err instanceof Error ? err.message : 'erreur'}` },
      { status: 500 }
    )
  }

  const results: Array<{ jobId: string; status: string; error?: string }> = []

  for (const job of jobs) {
    try {
      if (job.kind === 'production') {
        const input = (job.payload as { input?: ProductionJobInput }).input
        if (!input?.step) {
          await finishJob(job.id, 'failed', 'payload input production manquant')
          await releaseQuota(job.user_id)
          results.push({ jobId: job.id, status: 'failed', error: 'payload invalide' })
          continue
        }
        const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }
        // Reprise : chaque clé de stepsDone court-circuite l'appel fournisseur
        // correspondant — pas de double génération, pas de second débit.
        await executeProductionStep(input, { steps: stepsDone }, {
          heartbeat: () => heartbeat(job.id, worker, 600),
          onStepResolved: async (key, value) => {
            stepsDone[key] = value
            await checkpoint(job.id, worker, { steps: stepsDone })
          },
        })
        await finishJob(job.id, 'done')
        await completeQuota(job.user_id)
        results.push({ jobId: job.id, status: 'done' })
        continue
      }

      if (job.kind === 'export') {
        const input = (job.payload as { input?: ExportJobInput }).input
        if (!input?.videoId) {
          await finishJob(job.id, 'failed', 'payload input export manquant')
          await releaseQuota(job.user_id)
          results.push({ jobId: job.id, status: 'failed', error: 'payload invalide' })
          continue
        }
        const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }
        await executeExportJob(input, { steps: stepsDone }, {
          heartbeat: () => heartbeat(job.id, worker, 600),
          onStepResolved: async (key, value) => {
            stepsDone[key] = value
            await checkpoint(job.id, worker, { steps: stepsDone })
          },
        }, {
          assemble: (args) => assembleFinalVideo(args),
          persist: async (jobInput, update) => {
            const service = createServiceClient()
            await service.from('videos').update({
              video_url: update.video_url,
              quality: update.quality,
              duration: update.duration,
              status: 'ready',
            }).eq('id', jobInput.videoId)
            await sendNotification(jobInput.userId, {
              type: 'success',
              title: 'Export termine !',
              message: 'Ton export est pret dans ta bibliotheque.',
            })
            await logActivity(jobInput.userId, 'video_exported', 'Video re-exportee (worker, apres crash)', { video_id: jobInput.videoId, quality: update.quality })
          },
        })
        await finishJob(job.id, 'done')
        await completeQuota(job.user_id)
        results.push({ jobId: job.id, status: 'done' })
        continue
      }

      if (job.kind === 'auto') {
        const input = (job.payload as { input?: AutoJobInput }).input
        if (!input?.videoRowId) {
          await finishJob(job.id, 'failed', 'payload input auto manquant')
          await releaseQuota(job.user_id)
          results.push({ jobId: job.id, status: 'failed', error: 'payload invalide' })
          continue
        }
        const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }
        await executeAutoJob(input, { steps: stepsDone }, {
          heartbeat: () => heartbeat(job.id, worker, 600),
          onStepResolved: async (key, value) => {
            stepsDone[key] = value
            await checkpoint(job.id, worker, { steps: stepsDone })
          },
        }, buildAutoProviders(input.userId, input.videoRowId, input.config, input.userEmail, input.planTier, createServiceClient()))
        await finishJob(job.id, 'done')
        await completeQuota(job.user_id)
        results.push({ jobId: job.id, status: 'done' })
        continue
      }

      if (job.kind !== 'create') {
        await finishJob(job.id, 'failed', `kind non supporte par le worker : ${job.kind}`)
        results.push({ jobId: job.id, status: 'skipped_kind' })
        continue
      }

      const input = (job.payload as { input?: CreateJobInput }).input
      if (!input?.videoId) {
        await finishJob(job.id, 'failed', 'payload input manquant')
        await releaseQuota(job.user_id)
        results.push({ jobId: job.id, status: 'failed', error: 'payload invalide' })
        continue
      }

      const resume: CreateJobResume = {
        scenes: (((job.progress as unknown as CreateJobResume | undefined)?.scenes) ?? {}) as Record<string, AssembleClip>,
      }
      const scenesDone = { ...resume.scenes }

      await executeCreateJob(input, resume, {
        heartbeat: () => heartbeat(job.id, worker, 600),
        onSceneResolved: async (idx, clip) => {
          scenesDone[String(idx)] = clip
          await checkpoint(job.id, worker, { scenes: scenesDone })
        },
      })

      await finishJob(job.id, 'done')
      await completeQuota(job.user_id)
      results.push({ jobId: job.id, status: 'done' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur'
      const { data: fresh } = await createServiceClient()
        .from('video_jobs')
        .select('attempts, max_attempts')
        .eq('id', job.id)
        .single()
      const exhausted = (fresh?.attempts ?? 0) >= (fresh?.max_attempts ?? 3)
      await finishJob(job.id, exhausted ? 'failed' : 'queued', message).catch(() => {})
      // Échec FINAL seulement → place libérée ; un retry peut encore réussir.
      if (exhausted) {
        await releaseQuota(job.user_id).catch(() => {})
        if (job.video_id) {
          await createServiceClient()
            .from('videos')
            .update({ status: 'failed' })
            .eq('id', job.video_id)
            .then(() => undefined, () => undefined)
        }
      }
      results.push({ jobId: job.id, status: exhausted ? 'failed' : 'requeued', error: message })
    }
  }

  return NextResponse.json({ status: 'ok', claimed: jobs.length, results })
}
