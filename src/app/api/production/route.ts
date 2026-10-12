import { submissionIdentity, submitVideoJob, submissionErrorStatus } from '@/lib/pipeline-submit'
import { runVideoJob } from '@/lib/video-worker'
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  completeQuotaForFinishedJob,
  claimJobByKey, cancelJobByKey, finishJob,
} from '@/lib/video-queue'
import { type ProductionJobInput, type ProductionStep } from '@/lib/production-pipeline'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { type AssembleClip } from '@/lib/shotstack'
import { productionSchema, sanitizeScriptData } from '@/lib/production-schema'
import type { Plan, Profile } from '@/types'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
export const maxDuration = 300

/** Étapes à coût fournisseur : exécutées comme TÂCHES DURABLES (reprise sans
 *  double génération ni double débit — checkpoint par résultat, audit #10/#14). */
const COST_STEPS = new Set<ProductionStep>(['script', 'video', 'voice', 'music', 'assembly', 'all'])

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
  const worker = `inline-${randomUUID()}`
  let jobId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

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

    const { requestId: _requestId, ...requestContent } = parsed.data
    const identity = submissionIdentity(`production-${user.id}-${step}`, requestContent, requestId ?? req.headers.get('Idempotency-Key'))
    const requestKey = identity.key
    const jobKey = identity.key

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

    const submitted = await submitVideoJob(profile as Profile, { kind: 'production', videoId: null, input, ...identity })
    if (submitted.status === 'done') return NextResponse.json({ data: submitted.progress.result })
    if (!['queued', 'processing'].includes(submitted.status)) return NextResponse.json({ error: 'Tache terminee ou a reconcilier', status: submitted.status }, { status: 409 })
    const job = await claimJobByKey(jobKey, worker, 600)
    if (!job) return NextResponse.json({ jobId: submitted.id, status: submitted.status, jobKey }, { status: 202 })
    jobId = job.id
    const finalData = await runVideoJob(job, worker) as unknown

    await finishJob(job.id, worker, 'done')
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, jobId!)
    jobId = null
    return NextResponse.json({ data: finalData, quotaReconciliationRequired: !quotaConfirmed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    try {
      if (jobId) await finishJob(jobId, worker, 'queued', message)
    } catch {
      return NextResponse.json({ error: 'Generation indisponible', status: 'write_unconfirmed' }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: submissionErrorStatus(message) })
  }
}
