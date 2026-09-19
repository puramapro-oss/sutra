/**
 * /api/auto/generate
 * Declenche la generation de la prochaine video pour un user — TÂCHE
 * DURABLE (kind 'auto', clé auto-{videoRowId}) : reprise sans double
 * génération ni double débit (checkpoints plan/assets/assembly, audit
 * #10/#14). Pipeline: plan → assets → montage → ready/pending_approval.
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  reserveQuota, completeQuota, releaseQuota,
  enqueueJob, claimJobByKey, checkpoint, finishJob, heartbeat,
} from '@/lib/video-queue'
import { executeAutoJob, buildAutoProviders, type AutoJobInput } from '@/lib/auto-pipeline'
import { loadAutoContext, type AutoConfig } from '@/lib/sutra-auto'

export const maxDuration = 300

export async function POST(req: Request) {
  let quotaReserved = false
  let authUserId: string | null = null
  let jobId: string | null = null
  let videoRowId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    authUserId = user.id

    const body = await req.json().catch(() => ({}))
    const scheduleId: string | null = body.schedule_id ?? null

    const ctx = await loadAutoContext(user.id)
    if (!ctx.config) {
      return NextResponse.json({ error: 'Configuration auto introuvable' }, { status: 400 })
    }
    const config = ctx.config as AutoConfig

    const service = createServiceClient()

    // Garde de quota AVANT tout appel payant (audit #8).
    const { data: quotaProfile } = await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (quotaProfile) {
      const reserved = await reserveQuota(quotaProfile as never)
      if (!reserved) {
        return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
      }
      quotaReserved = true
    }

    const { data: profile } = await service
      .from('profiles')
      .select('plan, email')
      .eq('id', user.id)
      .single()

    // La ligne auto existe AVANT la tâche durable : la reprise s'y accroche.
    const startedAt = new Date().toISOString()
    const { data: videoRow } = await service
      .from('sutra_auto_videos')
      .insert({
        user_id: user.id,
        schedule_id: scheduleId,
        status: 'generating_video',
        generation_started_at: startedAt,
      })
      .select('id')
      .single()
    if (!videoRow) throw new Error('Insert echoue')
    videoRowId = videoRow.id

    const input: AutoJobInput = {
      userId: user.id,
      videoRowId: videoRow.id,
      scheduleId,
      userEmail: profile?.email ?? null,
      planTier: (profile?.plan ?? 'free') as never,
      config,
      generationStartedAt: startedAt,
    }

    // Tâche durable AVANT tout appel fournisseur, claim ciblé inline.
    const jobKey = `auto-${videoRow.id}`
    await enqueueJob({ videoId: null, userId: user.id, kind: 'auto', payload: { input }, idempotencyKey: jobKey })
    const job = await claimJobByKey(jobKey, `inline-auto-${videoRow.id}`, 600)
    if (!job) {
      await releaseQuota(user.id).catch(() => {})
      quotaReserved = false
      return NextResponse.json({ error: 'Generation deja en cours pour cette video' }, { status: 409 })
    }
    jobId = job.id
    const worker = `inline-auto-${videoRow.id}`
    const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }

    const final = await executeAutoJob(input, { steps: stepsDone }, {
      heartbeat: () => heartbeat(job.id, worker, 600),
      onStepResolved: async (key, value) => {
        stepsDone[key] = value
        await checkpoint(job.id, worker, { steps: stepsDone })
      },
    }, buildAutoProviders(user.id, videoRow.id, config, input.userEmail, input.planTier, service))

    await finishJob(job.id, 'done')
    await completeQuota(user.id)
    quotaReserved = false
    return NextResponse.json({ video: { id: videoRow.id, schedule_id: scheduleId, status: final.status, video_final_url: final.videoFinalUrl, video_raw_url: final.assets.video_raw_url, audio_voice_url: final.assets.audio_voice_url, audio_music_url: final.assets.audio_music_url, error_message: final.assemblyError } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    if (jobId) {
      const { data: fresh } = await createServiceClient()
        .from('video_jobs').select('attempts, max_attempts').eq('id', jobId).single()
      const exhausted = (fresh?.attempts ?? 0) >= (fresh?.max_attempts ?? 3)
      await finishJob(jobId, exhausted ? 'failed' : 'queued', message).catch(() => {})
      if (exhausted) {
        await releaseQuota(authUserId!).catch(() => {})
        quotaReserved = false
        if (authUserId && videoRowId) {
          await createServiceClient()
            .from('sutra_auto_videos')
            .update({ status: 'failed', error_message: message })
            .eq('id', videoRowId)
            .then(() => undefined, () => undefined)
        }
      }
    } else if (quotaReserved && authUserId) {
      await releaseQuota(authUserId).catch(() => {})
    }
    return NextResponse.json({ error: 'Erreur generation', details: message }, { status: 500 })
  }
}
