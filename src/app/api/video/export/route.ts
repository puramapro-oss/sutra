import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  reserveQuota, completeQuotaForFinishedJob, releaseQuota,
  enqueueJob, claimJobByKey, getJobByKey, checkpoint, finishJob, heartbeat,
} from '@/lib/video-queue'
import { executeExportJob, persistExportResult, type ExportJobInput } from '@/lib/export-pipeline'
import { assembleFinalVideo, type AssembleClip } from '@/lib/shotstack'
import type { Profile } from '@/types'
import { clampQualityToPlan } from '@/lib/ltx-utils'

export const maxDuration = 300

/**
 * POST /api/video/export — ré-exporte une vidéo existante avec les réglages
 * de l'éditeur, en TÂCHE DURABLE (kind 'export') : le rendu Shotstack (payé)
 * est checkpointé — un crash ne re-rend JAMAIS le même montage (audit #10/#14),
 * et un retry du même requestId renvoie le résultat sans rien re-payer.
 */
const exportSchema = z.object({
  videoId: z.string().min(1),
  requestId: z.string().uuid().optional(),
  quality: z.enum(['720p', '1080p', '4k']).default('1080p'),
  script: z.string().max(60_000).optional(),
  scenes: z
    .array(
      z.object({
        url: z.string().url(),
        duration: z.number().min(1).max(120).optional(),
        type: z.enum(['ia', 'stock']).optional(),
        kind: z.enum(['video', 'photo']).optional(),
      })
    )
    .max(60)
    .optional(),
  subtitles: z
    .array(
      z.object({
        text: z.string().max(500),
        start: z.number().min(0),
        end: z.number().min(0),
      })
    )
    .max(600)
    .optional(),
  voiceVolume: z.number().min(0).max(2).optional(),
  musicVolume: z.number().min(0).max(2).optional(),
})

/** Clé déterministe sans requestId : retry des MÊMES réglages = même tâche. */
function payloadHash(parsed: z.infer<typeof exportSchema>): string {
  return createHash('sha256').update(JSON.stringify(parsed)).digest('hex').slice(0, 16)
}

export async function POST(req: Request) {
  let quotaReserved = false
  let authUserId: string | null = null
  let jobId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    authUserId = user.id

    const parsed = exportSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    const { videoId, quality, scenes, subtitles, musicVolume } = parsed.data

    const service = createServiceClient()
    const { data: video } = await service
      .from('videos')
      .select('id, user_id, voice_url, music_url, format, status')
      .eq('id', videoId)
      .single()

    // Permission : uniquement le propriétaire (audit #13).
    if (!video || video.user_id !== user.id) {
      return NextResponse.json({ error: 'Video introuvable ou non autorisee' }, { status: 404 })
    }

    const clips: AssembleClip[] = (scenes && scenes.length > 0 ? scenes : []).map((s) => ({
      url: s.url,
      type: s.type ?? 'ia',
      kind: s.kind,
      duration: s.duration,
    }))
    if (clips.length === 0) {
      return NextResponse.json({ error: 'Aucune scene a exporter' }, { status: 400 })
    }

    // Idempotence de RETRY : même export déjà fait → résultat en cache.
    const jobKey = `export-${videoId}-${parsed.data.requestId ?? payloadHash(parsed.data)}`
    const existing = await getJobByKey(jobKey)
    if (existing?.status === 'done') {
      const cached = (existing.progress as { result?: unknown } | null)?.result
      if (cached !== undefined) return NextResponse.json({ success: true, ...(cached as object) })
    }
    if (existing?.status === 'processing') {
      return NextResponse.json({ error: 'Export deja en cours — reessaie dans un instant' }, { status: 409 })
    }
    if (existing?.status === 'cancelled') {
      return NextResponse.json({ error: 'Export annule — relance avec un nouveau requestId' }, { status: 409 })
    }
    if (existing?.status === 'queued') return NextResponse.json({ status: 'queued', jobKey }, { status: 202 })
    if (existing) return NextResponse.json({ error: 'Cette tache necessite une reconciliation' }, { status: 409 })

    // Un export re-rend chez Shotstack = un coût : garde de quota.
    const { data: profile } = await service.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    if (clampQualityToPlan(quality, profile.plan ?? 'free', user.email) !== quality) {
      return NextResponse.json({ error: 'Qualite non autorisee par votre plan' }, { status: 403 })
    }
    {
      const reserved = await reserveQuota(profile as Profile)
      if (!reserved) {
        return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
      }
      quotaReserved = true
    }

    const input: ExportJobInput = {
      videoId,
      userId: user.id,
      quality,
      format: video.format ?? '16:9',
      voiceUrl: video.voice_url ?? '',
      musicUrl: video.music_url ?? null,
      musicVolume: musicVolume ?? 0.3,
      clips,
      subtitles: subtitles ?? [],
    }

    await enqueueJob({ videoId, userId: user.id, kind: 'export', payload: { input }, idempotencyKey: jobKey })
    const job = await claimJobByKey(jobKey, `inline-export-${videoId}`, 600)
    if (!job) {
      quotaReserved = false // The durable worker owns this reservation.
      return NextResponse.json({ status: 'queued', jobKey }, { status: 202 })
    }
    jobId = job.id
    const worker = `inline-export-${videoId}`
    const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }

    const result = await executeExportJob(input, { steps: stepsDone }, {
      heartbeat: () => heartbeat(job.id, worker, 600),
      onStepResolved: async (key, value) => {
        stepsDone[key] = value
        await checkpoint(job.id, worker, { steps: stepsDone })
      },
    }, {
      assemble: (args) => assembleFinalVideo(args),
      persist: (jobInput, update) => persistExportResult(jobInput, update, service),
    })

    await checkpoint(job.id, worker, { steps: stepsDone, result })
    await finishJob(job.id, 'done')
    quotaReserved = false
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, jobId!)
    jobId = null
    return NextResponse.json({ success: true, url: result.url, quality: result.quality, quotaReconciliationRequired: !quotaConfirmed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    if (jobId) {
      const { data: fresh } = await createServiceClient()
        .from('video_jobs').select('attempts, max_attempts').eq('id', jobId).single()
      const exhausted = (fresh?.attempts ?? 0) >= (fresh?.max_attempts ?? 3)
      await finishJob(jobId, exhausted ? 'failed' : 'queued', message).catch(() => {})
      if (exhausted) { await releaseQuota(authUserId!).catch(() => {}); quotaReserved = false }
    } else if (quotaReserved && authUserId) {
      await releaseQuota(authUserId).catch(() => {})
    }
    return NextResponse.json({ error: 'Erreur lors de l\'export', details: message }, { status: 500 })
  }
}
