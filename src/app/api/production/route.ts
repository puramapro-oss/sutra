import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  reserveQuota, completeQuota, releaseQuota,
  enqueueJob, claimJobByKey, getJobByKey, cancelJobByKey, checkpoint, finishJob, heartbeat,
} from '@/lib/video-queue'
import { executeProductionStep, type ProductionJobInput, type ProductionStep } from '@/lib/production-pipeline'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { type AssembleClip } from '@/lib/shotstack'
import { logApiCall, logActivity, sendNotification } from '@/lib/logger'
import { productionSchema, sanitizeScriptData, MAX_SCENES } from '@/lib/production-schema'
import type { Plan, Profile, ScriptData } from '@/types'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
export const maxDuration = 300

/** Étapes à coût fournisseur : exécutées comme TÂCHES DURABLES (reprise sans
 *  double génération ni double débit — checkpoint par résultat, audit #10/#14). */
const COST_STEPS = new Set<ProductionStep>(['script', 'video', 'voice', 'music', 'assembly', 'all'])

const STEP_PROVIDER: Record<string, string> = {
  script: 'claude', video: 'ltx', voice: 'elevenlabs', music: 'suno', assembly: 'shotstack', all: 'multi',
}

/** Validations AVANT réservation de quota : une erreur client ne doit jamais
 *  consommer de place ni partir en worker-retry (400 immédiat). */
function validateStepInputs(step: string, previousData: Record<string, unknown>): string | null {
  if (step === 'video' || step === 'voice') {
    const scriptData = sanitizeScriptData(previousData.script)
    if (step === 'video' && !scriptData?.scenes?.length) return 'Script requis pour generer les scenes'
    if (step === 'voice' && !scriptData?.narration) return 'Script requis pour la narration'
  }
  if (step === 'assembly') {
    const videoData = previousData.video as Array<Partial<AssembleClip>> | undefined
    const voiceData = previousData.voice as { url?: string } | undefined
    if (!videoData?.length || !voiceData?.url) return 'Video et voix requises pour l\'assemblage'
  }
  return null
}

export async function POST(req: Request) {
  let authUserId: string | null = null
  let jobId: string | null = null
  let quotaReserved = false
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    authUserId = user.id

    const parsed = productionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    const { step, idea, template, format, engine, voice, musicStyle, tone, requestId } = parsed.data
    const previousData = (parsed.data.previousData ?? {}) as Record<string, unknown>

    // Annulation : tâche plus jamais claimable + place réservée libérée (RPC).
    if (step === 'cancel') {
      const target = parsed.data.targetStep
      if (!requestId || !target) {
        return NextResponse.json({ error: 'requestId et targetStep requis pour annuler une etape' }, { status: 400 })
      }
      const cancelled = await cancelJobByKey(`production-${user.id}-${target}-${requestId}`)
      return NextResponse.json({ data: { cancelled } })
    }

    if (step === 'thumbnail') {
      const scriptData = sanitizeScriptData(previousData.script)
      const thumbnailPrompt = scriptData?.thumbnail_prompt ?? `cinematic thumbnail for ${idea}`
      return NextResponse.json({
        data: { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(thumbnailPrompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true` },
      })
    }

    if (!COST_STEPS.has(step as ProductionStep)) {
      return NextResponse.json({ error: 'Etape inconnue' }, { status: 400 })
    }
    const invalid = validateStepInputs(step, previousData)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    const userPlan = (profile as Profile).plan ?? 'free'
    // Plafond qualité par plan appliqué AVANT tout appel payant (audit #16).
    const qualityCap = clampQualityToPlan(profile.preferred_quality ?? '1080p', userPlan, user.email)
    const mediaFormat = (['9:16', '16:9', '1:1'].includes(format ?? '') ? format : '16:9') as ProductionJobInput['mediaFormat']
    const genPlan: Plan = engine === 'wan-classic' ? 'free' : userPlan

    const requestKey = requestId ?? randomUUID()
    const jobKey = `production-${user.id}-${step}-${requestKey}`

    // Idempotence de RETRY : tâche déjà faite → résultat checkpointé renvoyé
    // tel quel (AUCUN nouvel appel fournisseur, AUCUNE nouvelle réservation).
    const existing = await getJobByKey(jobKey)
    if (existing?.status === 'done') {
      const cached = (existing.progress as { result?: unknown } | null)?.result
      if (cached !== undefined) return NextResponse.json({ data: cached })
    }
    if (existing?.status === 'processing') {
      return NextResponse.json({ error: 'Etape deja en cours — reessaie dans un instant' }, { status: 409 })
    }
    if (existing?.status === 'cancelled') {
      return NextResponse.json({ error: 'Etape annulee — relance avec un nouveau requestId' }, { status: 409 })
    }

    // Réservation ATOMIQUE (migration v10) — fail-closed.
    if (!(await reserveQuota(profile as unknown as Profile))) {
      return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
    }
    quotaReserved = true

    const input: ProductionJobInput = {
      step: step as ProductionStep,
      userId: user.id,
      userEmail: user.email ?? null,
      userPlan,
      genPlan,
      qualityCap,
      mediaFormat,
      idea,
      template: template ?? null,
      format: format ?? null,
      voice: voice ?? null,
      musicStyle: musicStyle ?? null,
      tone: tone ?? null,
      previousData,
      brandKit: (profile as Profile).brand_kit ?? null,
      requestKey,
    }

    // Tâche durable AVANT tout appel fournisseur, claim ciblé inline.
    await enqueueJob({ videoId: null, userId: user.id, kind: 'production', payload: { input }, idempotencyKey: jobKey })
    const job = await claimJobByKey(jobKey, `inline-${requestKey}`, 600)
    if (!job) {
      await releaseQuota(user.id).catch(() => {})
      quotaReserved = false
      return NextResponse.json({ error: 'Etape deja en cours — reessaie dans un instant' }, { status: 409 })
    }
    jobId = job.id
    const worker = `inline-${requestKey}`
    const stepsDone = { ...(((job.progress as { steps?: Record<string, unknown> } | null)?.steps) ?? {}) }

    const result = await executeProductionStep(input, { steps: stepsDone }, {
      heartbeat: () => heartbeat(job.id, worker, 600),
      onStepResolved: async (key, value) => {
        stepsDone[key] = value
        await checkpoint(job.id, worker, { steps: stepsDone })
      },
    })

    const finalData = await persistAndShape(step, result, stepsDone, input, serviceClient)
    // Résultat final checkpointé : un retry du même requestId ne paie plus rien.
    await checkpoint(job.id, worker, { steps: stepsDone, result: finalData })
    await finishJob(job.id, 'done')
    await completeQuota(user.id)
    quotaReserved = false
    await logApiCall(user.id, STEP_PROVIDER[step] ?? 'multi', `production-${step}`, 'success')
    return NextResponse.json({ data: finalData })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    if (jobId) {
      // Tâche requeueée : le worker reprendra AVEC les checkpoints (les scènes
      // déjà payées ne sont pas régénérées) ; épuisée → place libérée.
      const { data: fresh } = await createServiceClient()
        .from('video_jobs').select('attempts, max_attempts').eq('id', jobId).single()
      const exhausted = (fresh?.attempts ?? 0) >= (fresh?.max_attempts ?? 3)
      await finishJob(jobId, exhausted ? 'failed' : 'queued', message).catch(() => {})
      if (exhausted) { await releaseQuota(authUserId!).catch(() => {}); quotaReserved = false }
    } else if (quotaReserved && authUserId) {
      await releaseQuota(authUserId).catch(() => {})
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Persistance finale (assembly/all → table videos) + mise en forme réponse,
 *  formes strictement IDENTIQUES aux réponses historiques (contrat client). */
async function persistAndShape(
  step: string,
  result: unknown,
  stepsDone: Record<string, unknown>,
  input: ProductionJobInput,
  serviceClient: ReturnType<typeof createServiceClient>
): Promise<unknown> {
  if (step === 'assembly') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    const assembled = result as { url: string; videoId: string | null; quality: string; duration: number }
    const { data: videoRow } = await serviceClient.from('videos').insert({
      user_id: input.userId,
      title: scriptData?.title ?? 'Production',
      description: scriptData?.description ?? '',
      video_url: assembled.url,
      duration: assembled.duration,
      format: input.format ?? '16:9',
      quality: assembled.quality,
      status: 'ready',
      tags: scriptData?.tags ?? [],
      script_data: scriptData ?? null,
    }).select('id').single()
    await sendNotification(input.userId, {
      type: 'success',
      title: 'Production terminee',
      message: `Ta video "${scriptData?.title ?? 'Production'}" est prete !`,
    })
    return { url: assembled.url, videoId: videoRow?.id }
  }

  if (step === 'all') {
    const script = stepsDone.script as ScriptData
    const clips: AssembleClip[] = []
    for (let i = 0; i < MAX_SCENES; i++) {
      const visual = stepsDone[`scene:${i}`] as { url: string; source: string } | undefined
      if (!visual) break
      const scene = script.scenes[i]
      clips.push({
        url: visual.url,
        type: visual.source === 'pexels-stock' ? 'stock' : 'ia',
        kind: 'video',
        duration: Math.max(1, scene?.duration_seconds || 5),
      })
    }
    const assembled = result as { url: string; quality: string; duration: number }
    const voiceUrl = stepsDone.voice_url as string
    const musicUrl = stepsDone.music as string | null
    // Miniature : IMAGE uniquement (jamais un MP4 dans une balise <img>).
    const thumbnailUrl = clips.find((c) => c.kind === 'photo')?.url
      ?? `https://image.pollinations.ai/prompt/${encodeURIComponent(script.thumbnail_prompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true`
    // La qualité RÉELLE (plafonnée renderer) est déjà calculée par le pipeline.
    const actualQuality = assembled.quality
    await serviceClient.from('videos').insert({
      user_id: input.userId,
      title: script.title,
      description: script.description,
      video_url: assembled.url,
      thumbnail_url: thumbnailUrl,
      duration: assembled.duration,
      format: input.format ?? '16:9',
      quality: actualQuality,
      status: 'ready',
      tags: script.tags,
      script_data: script,
    })
    await logActivity(input.userId, 'production_completed', `Production "${script.title}" terminee`)
    return {
      script,
      video: clips,
      voice: { url: voiceUrl },
      music: { url: musicUrl ?? null },
      assembly: { url: assembled.url },
      thumbnail: { url: thumbnailUrl },
    }
  }

  return result
}
