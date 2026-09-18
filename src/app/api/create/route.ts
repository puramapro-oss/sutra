import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createVideoSchema } from '@/lib/validators'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { resolveVoiceProviderId } from '@/lib/constants'
import { enqueueJob, reserveQuota, completeQuota, releaseQuota, claimJobByKey, checkpoint, finishJob, heartbeat } from '@/lib/video-queue'
import { executeCreateJob, type CreateJobInput, type CreateJobResume } from '@/lib/video-pipeline'
import type { AssembleClip } from '@/lib/shotstack'
import type { Plan, Profile } from '@/types'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
// Le pipeline est enregistré en tâche DURABLE avant exécution : si la requête
// meurt, le worker (/api/cron/video-worker) REPREND sans régénérer les scènes
// déjà obtenues (checkpoint par scène).
export const maxDuration = 300

export async function POST(req: Request) {
  let createdVideoId: string | null = null
  let jobId: string | null = null
  let userId: string | null = null
  let quotaReserved = false
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    userId = user.id

    const parsed = createVideoSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    // Réservation ATOMIQUE de la place (migration v10) — fail-closed : aucune
    // génération ne démarre si le quota ne peut pas être réservé.
    const reserved = await reserveQuota(profile as Profile)
    if (!reserved) {
      return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan. Passez au plan superieur.' }, { status: 403 })
    }
    quotaReserved = true

    const { topic, format, quality: requestedQuality, voice_id, voice, engine, script: manualScript, niche, style, mode, mediaMode, stockSelections } = parsed.data
    const userPlan = (profile as Profile).plan ?? 'free'
    const quality = clampQualityToPlan(requestedQuality, userPlan, user.email)
    const genPlan: Plan = engine === 'wan-classic' ? 'free' : userPlan
    const voiceId = resolveVoiceProviderId(voice_id ?? voice)

    const { data: videoRow } = await serviceClient
      .from('videos')
      .insert({ user_id: user.id, status: 'generating', format, quality, tags: [], media_mode: mediaMode, stock_sources: stockSelections ?? [] })
      .select('id')
      .single()
    if (!videoRow) return NextResponse.json({ error: 'Erreur creation video' }, { status: 500 })
    const videoId = videoRow.id
    createdVideoId = videoId

    const input: CreateJobInput = {
      videoId,
      userId: user.id,
      userEmail: user.email ?? null,
      userPlan,
      genPlan,
      quality,
      format,
      mediaFormat: (['9:16', '16:9', '1:1'].includes(format) ? format : '16:9') as CreateJobInput['mediaFormat'],
      topic,
      niche,
      style,
      mode,
      mediaMode,
      voiceId,
      manualScript,
      stockSelections: stockSelections ?? [],
      brandKit: (profile as Profile).brand_kit ?? null,
    }

    // Tâche durable AVANT tout appel fournisseur (idempotente par videoId) —
    // le payload complet permet au worker de reprendre TOUT, sans nous.
    await enqueueJob({
      videoId,
      userId: user.id,
      kind: 'create',
      idempotencyKey: `create-${videoId}`,
      payload: { input },
    })

    // Claim ciblé par clé (atomique) : jamais la tâche d'un autre. Reprise du
    // checkpoint si la tâche existait déjà (retry du même videoId / bail expiré).
    const claimedJob = await claimJobByKey(`create-${videoId}`, `inline-${videoId}`, 600)
    if (claimedJob) {
      jobId = claimedJob.id
    } else {
      // Déjà en cours saine OU épuisée : on relit l'état pour répondre honnêtement.
      const { data: existing } = await serviceClient
        .from('video_jobs')
        .select('id, status')
        .eq('idempotency_key', `create-${videoId}`)
        .single()
      jobId = existing?.id ?? null
    }
    const resumeScenes = (((claimedJob?.progress as CreateJobResume | undefined)?.scenes) ?? {}) as Record<string, AssembleClip>
    const scenesDone = { ...resumeScenes }

    await executeCreateJob(input, { scenes: resumeScenes }, {
      heartbeat: () => heartbeat(jobId!, `inline-${videoId}`, 600),
      onSceneResolved: async (idx, clip) => {
        scenesDone[String(idx)] = clip
        await checkpoint(jobId!, `inline-${videoId}`, { scenes: scenesDone })
      },
    })

    if (jobId) await finishJob(jobId, 'done')
    await completeQuota(user.id)

    const { data: video } = await serviceClient.from('videos').select('*').eq('id', videoId).single()
    return NextResponse.json({ success: true, video, jobId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    if (createdVideoId) {
      await createServiceClient()
        .from('videos')
        .update({ status: 'failed' })
        .eq('id', createdVideoId)
        .then(() => undefined, () => undefined)
    }
    // Échec logiciel → tâche failed + quota LIBÉRÉ (jamais consommé pour rien).
    if (jobId) await finishJob(jobId, 'failed', message).catch(() => {})
    void createdVideoId
    if (quotaReserved && userId) await releaseQuota(userId).catch(() => {})
    return NextResponse.json({ error: 'Erreur lors de la generation de la video', details: message }, { status: 500 })
  }
}
