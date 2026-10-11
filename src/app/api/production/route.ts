import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  reserveQuota, completeQuotaForFinishedJob, releaseQuota,
  enqueueJob, claimJobByKey, getJobByKey, cancelJobByKey, checkpoint, finishJob, heartbeat,
} from '@/lib/video-queue'
import { executeProductionStep, persistProductionResult, type ProductionJobInput, type ProductionStep } from '@/lib/production-pipeline'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { type AssembleClip } from '@/lib/shotstack'
import { logApiCall } from '@/lib/logger'
import { productionSchema, sanitizeScriptData } from '@/lib/production-schema'
import type { Plan, Profile } from '@/types'

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
    if (!videoData?.length) return 'Video requise pour l\'assemblage'
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
    if (existing?.status === 'queued') return NextResponse.json({ data: { status: 'queued', jobKey } }, { status: 202 })
    if (existing) return NextResponse.json({ error: 'Cette tache necessite une reconciliation' }, { status: 409 })

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
      quotaReserved = false // The worker owns the queued reservation.
      return NextResponse.json({ data: { status: 'queued', jobKey } }, { status: 202 })
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

    const finalData = await persistProductionResult(job.id, step, result, stepsDone, input, serviceClient)
    // Résultat final checkpointé : un retry du même requestId ne paie plus rien.
    await checkpoint(job.id, worker, { steps: stepsDone, result: finalData })
    await finishJob(job.id, 'done')
    quotaReserved = false
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, jobId!)
    jobId = null
    await logApiCall(user.id, STEP_PROVIDER[step] ?? 'multi', `production-${step}`, 'success')
    return NextResponse.json({ data: finalData, quotaReconciliationRequired: !quotaConfirmed })
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
