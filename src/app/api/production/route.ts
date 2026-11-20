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
import { shouldUseLocalEngine } from '@/lib/local-engine'
import { saladApplicationConfig } from '@/lib/salad/application'
import { requireActive } from '@/lib/salad/config'
import { getPollinationsUrl } from '@/lib/storyboard'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
export const maxDuration = 300

/** Étapes à coût fournisseur : exécutées comme TÂCHES DURABLES (reprise sans
 *  double génération ni double débit — checkpoint par résultat, audit #10/#14). */
const COST_STEPS = new Set<ProductionStep>(['script', 'video', 'voice', 'music', 'assembly', 'all'])

/** Recover a lost submission receipt without replaying a cancelled intent.
 * Absence is not cancellation: the original request may still be in flight. */
export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const session = await createServerClient()
    const { data: { user }, error: authError } = await session.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401, headers })
    const query = new URL(req.url).searchParams
    const parsed = productionSchema.pick({ requestId: true, targetStep: true }).required().safeParse({
      requestId: query.get('requestId'), targetStep: query.get('targetStep'),
    })
    if (!parsed.success || query.getAll('requestId').length !== 1 || query.getAll('targetStep').length !== 1) {
      return NextResponse.json({ error: 'Identite de tache invalide' }, { status: 400, headers })
    }
    const { requestId, targetStep } = parsed.data
    const { data: job, error } = await createServiceClient().from('video_jobs')
      .select('id,status,progress').eq('user_id', user.id).eq('kind', 'production')
      .eq('idempotency_key', `production-${user.id}-${targetStep}-${requestId}`).maybeSingle()
    if (error) return NextResponse.json({ error: 'Statut indisponible' }, { status: 503, headers })
    if (!job) return NextResponse.json({ error: 'Tache introuvable' }, { status: 404, headers })
    return NextResponse.json({ jobId: job.id, status: job.status,
      ...(job.status === 'done' ? { data: job.progress?.result } : {}),
    }, { headers })
  } catch {
    return NextResponse.json({ error: 'Statut indisponible' }, { status: 503, headers })
  }
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
        data: { url: getPollinationsUrl(thumbnailPrompt, format ?? '16:9') },
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

    // Reject an unavailable personal video mode before quota reservation or
    // any earlier paid script/voice phase in the all-steps pipeline.
    if ((step === 'all' || step === 'video') && shouldUseLocalEngine(user.email ?? null)) {
      try {
        requireActive(saladApplicationConfig().config)
      } catch {
        return NextResponse.json({
          error: 'Moteur GPU distant open source indisponible ; aucun repli API payant.',
          code: 'SALAD_UNAVAILABLE',
        }, { status: 503 })
      }
    }

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
    // Submission is not the only failure boundary: profile, claim and worker
    // errors may contain RPC diagnostics or credentials. Only exact public
    // codes may cross HTTP or be persisted in the user-visible task receipt.
    const candidate = err instanceof Error ? err.message : ''
    const message = [
      'SUTRA_QUOTA_EXHAUSTED', 'SUTRA_IDEMPOTENCY_CONFLICT', 'SUTRA_INVALID_REQUEST_ID',
      'SUTRA_SUBMISSION_UNCONFIRMED', 'SUTRA_JOB_FINISH_UNCONFIRMED',
      'SUTRA_CANCEL_FAILED: annulation non confirmée. Réessayez la même demande.',
    ].includes(candidate) ? candidate : 'Generation indisponible'
    try {
      if (jobId) await finishJob(jobId, worker, 'queued', message)
    } catch {
      return NextResponse.json({ error: 'Generation indisponible', status: 'write_unconfirmed' }, { status: 503 })
    }
    return NextResponse.json({ error: message }, { status: submissionErrorStatus(message) })
  }
}
