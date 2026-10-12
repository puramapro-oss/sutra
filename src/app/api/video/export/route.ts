import { submissionIdentity, submitVideoJob, submissionErrorStatus } from '@/lib/pipeline-submit'
import { runVideoJob } from '@/lib/video-worker'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  completeQuotaForFinishedJob, claimJobByKey, finishJob,
} from '@/lib/video-queue'
import { type ExportJobInput } from '@/lib/export-pipeline'
import { type AssembleClip } from '@/lib/shotstack'
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
  voiceVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
})

export async function POST(req: Request) {
  const worker = `inline-${randomUUID()}`
  let jobId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const parsed = exportSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    const { videoId, quality, scenes, subtitles, voiceVolume, musicVolume } = parsed.data

    const service = createServiceClient()
    const { data: video } = await service
      .from('videos')
      .select('id, user_id, voice_url, music_url, format, status, script_data')
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

    // Un export re-rend chez Shotstack = un coût : garde de quota.
    const { data: profile } = await service.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    if (clampQualityToPlan(quality, profile.plan ?? 'free', user.email) !== quality) {
      return NextResponse.json({ error: 'Qualite non autorisee par votre plan' }, { status: 403 })
    }
    const input: ExportJobInput = {
      videoId,
      userId: user.id,
      quality,
      format: video.format ?? '16:9',
      voiceUrl: video.voice_url ?? '',
      musicUrl: video.music_url ?? null,
      voiceVolume: voiceVolume ?? 1,
      musicVolume: musicVolume ?? 0.3,
      requiredTracks: {
        voice: (voiceVolume ?? 1) > 0 && Boolean(video.script_data?.narration || video.voice_url),
        music: (musicVolume ?? 0.3) > 0 && Boolean(video.music_url || (video.script_data?.music_style && video.script_data.music_style !== 'none')),
      },
      clips,
      subtitles: subtitles ?? [],
    }

    const { requestId: _requestId, ...requestContent } = parsed.data
    const identity = submissionIdentity(`export-${videoId}`, requestContent, parsed.data.requestId ?? req.headers.get('Idempotency-Key'))
    const submitted = await submitVideoJob(profile as Profile, { kind: 'export', videoId, input, ...identity })
    if (submitted.status === 'done') return NextResponse.json({ success: true, ...(submitted.progress.result as object) })
    if (!['queued', 'processing'].includes(submitted.status)) return NextResponse.json({ error: 'Tache terminee ou a reconcilier', status: submitted.status }, { status: 409 })
    const job = await claimJobByKey(identity.key, worker, 600)
    if (!job) return NextResponse.json({ jobId: submitted.id, status: submitted.status, jobKey: identity.key }, { status: 202 })
    jobId = job.id
    const result = await runVideoJob(job, worker) as import('@/lib/export-pipeline').ExportJobResult

    await finishJob(job.id, worker, 'done')
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, jobId!)
    jobId = null
    return NextResponse.json({ success: true, url: result.url, quality: result.quality, quotaReconciliationRequired: !quotaConfirmed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    try {
      if (jobId) await finishJob(jobId, worker, 'queued', message)
    } catch {
      return NextResponse.json({ error: 'Generation indisponible', status: 'write_unconfirmed' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erreur lors de l\'export', code: 'SUTRA_GENERATION_FAILED' }, { status: submissionErrorStatus(message) })
  }
}
