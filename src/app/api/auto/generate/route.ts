import { submissionIdentity, submitVideoJob, submissionErrorStatus } from '@/lib/pipeline-submit'
import type { Profile } from '@/types'
import { randomUUID } from 'node:crypto'
import { runVideoJob } from '@/lib/video-worker'
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
  completeQuotaForFinishedJob, claimJobByKey, finishJob,
} from '@/lib/video-queue'
import { type AutoJobInput } from '@/lib/auto-pipeline'
import { loadAutoContext, type AutoConfig } from '@/lib/sutra-auto'

export const maxDuration = 300

export async function POST(req: Request) {
  const worker = `inline-${randomUUID()}`
  let jobId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const scheduleId: string | null = body.schedule_id ?? null

    const ctx = await loadAutoContext(user.id)
    if (!ctx.config) {
      return NextResponse.json({ error: 'Configuration auto introuvable' }, { status: 400 })
    }
    const config = ctx.config as AutoConfig

    const service = createServiceClient()

    // Garde de quota AVANT tout appel payant (audit #8).
    const { data: quotaProfile, error: quotaProfileError } = await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (quotaProfileError || !quotaProfile) throw new Error('Profil et quota non verifiables')
    const startedAt = new Date().toISOString()
    const videoRowId = randomUUID()

    const input: AutoJobInput = {
      userId: user.id,
      videoRowId,
      scheduleId,
      userEmail: quotaProfile.email ?? null,
      planTier: (quotaProfile.plan ?? 'free') as never,
      config,
      generationStartedAt: startedAt,
    }

    const identity = submissionIdentity(`auto-${user.id}`, { schedule_id: scheduleId, config }, body.requestId ?? req.headers.get('Idempotency-Key'))
    const submitted = await submitVideoJob(quotaProfile as Profile, {
      kind: 'auto', videoId: null, input, ...identity,
      initialVideo: { schedule_id: scheduleId, generation_started_at: startedAt },
    })
    const resultVideoId = (submitted.payload.input as AutoJobInput).videoRowId
    if (submitted.status === 'done') {
      const { data: video, error } = await service.from('sutra_auto_videos').select('*').eq('id', resultVideoId).eq('user_id', user.id).single()
      if (error || !video) throw new Error('Lecture du resultat indisponible')
      return NextResponse.json({ video })
    }
    if (!['queued', 'processing'].includes(submitted.status)) return NextResponse.json({ error: 'Tache terminee ou a reconcilier', status: submitted.status }, { status: 409 })
    const job = await claimJobByKey(identity.key, worker, 600)
    if (!job) return NextResponse.json({ jobId: submitted.id, status: submitted.status, video: { id: resultVideoId, status: 'planning' }, jobStatus: submitted.status, queued: true }, { status: 202 })
    jobId = job.id
    const final = await runVideoJob(job, worker) as import('@/lib/auto-pipeline').AutoFinalState

    await finishJob(job.id, worker, 'done')
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, job.id)
    jobId = null
    return NextResponse.json({ quotaReconciliationRequired: !quotaConfirmed, video: { id: resultVideoId, schedule_id: scheduleId, status: final.status, video_final_url: final.videoFinalUrl, video_raw_url: final.assets.video_raw_url, audio_voice_url: final.assets.audio_voice_url, audio_music_url: final.assets.audio_music_url, error_message: final.assemblyError } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    try {
      if (jobId) await finishJob(jobId, worker, 'queued', message)
    } catch {
      return NextResponse.json({ error: 'Generation indisponible', status: 'write_unconfirmed' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erreur generation', code: 'SUTRA_GENERATION_FAILED' }, { status: submissionErrorStatus(message) })
  }
}
