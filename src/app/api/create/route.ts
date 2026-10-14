import { submissionIdentity, submitVideoJob, submissionErrorStatus } from '@/lib/pipeline-submit'
import { randomUUID } from 'node:crypto'
import { runVideoJob } from '@/lib/video-worker'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createVideoSchema } from '@/lib/validators'
import { clampQualityToPlan } from '@/lib/ltx-utils'
import { resolveVoiceProviderId } from '@/lib/constants'
import { completeQuotaForFinishedJob, claimJobByKey, finishJob } from '@/lib/video-queue'
import { type CreateJobInput } from '@/lib/video-pipeline'
import type { Plan, Profile } from '@/types'
import { shouldUseLocalEngine } from '@/lib/local-engine'
import { saladApplicationConfig } from '@/lib/salad/application'
import { requireActive } from '@/lib/salad/config'

// Aligné sur les fournisseurs les plus lents (Shotstack/WAN 300s) — audit #14.
// Le pipeline est enregistré en tâche DURABLE avant exécution : si la requête
// meurt, le worker (/api/cron/video-worker) REPREND sans régénérer les scènes
// déjà obtenues (checkpoint par scène).
export const maxDuration = 300

export async function POST(req: Request) {
  const worker = `inline-${randomUUID()}`
  let jobId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const parsed = createVideoSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

    const { topic, format, quality: requestedQuality, voice_id, voice, engine, script: manualScript, niche, style, mode, mediaMode, stockSelections } = parsed.data
    const userPlan = (profile as Profile).plan ?? 'free'
    const quality = clampQualityToPlan(requestedQuality, userPlan, user.email)
    const genPlan: Plan = engine === 'wan-classic' ? 'free' : userPlan
    const voiceId = resolveVoiceProviderId(voice_id ?? voice)

    // Refuse an impossible personal AI request before quota reservation and the
    // script/voice/music API phases. Stock-only creation needs no GPU worker.
    if (mediaMode !== 'stock' && shouldUseLocalEngine(user.email ?? null)) {
      requireActive(saladApplicationConfig().config)
    }

    const videoId = randomUUID()

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

    const identity = submissionIdentity(`create-${user.id}`, parsed.data, req.headers.get('Idempotency-Key'))
    const submitted = await submitVideoJob(profile as Profile, {
      kind: 'create', videoId, input, ...identity,
      initialVideo: { format, quality, tags: [], media_mode: mediaMode, stock_sources: stockSelections ?? [] },
    })
    const resultVideoId = (submitted.payload.input as CreateJobInput).videoId
    if (submitted.status === 'done') {
      const { data: video, error } = await serviceClient.from('videos').select('*').eq('id', resultVideoId).eq('user_id', user.id).single()
      if (error || !video) throw new Error('Lecture du resultat indisponible')
      return NextResponse.json({ success: true, video, jobId: submitted.id })
    }
    if (!['queued', 'processing'].includes(submitted.status)) return NextResponse.json({ error: 'Tache terminee ou a reconcilier', jobId: submitted.id, status: submitted.status }, { status: 409 })
    const claimedJob = await claimJobByKey(identity.key, worker, 600)
    if (!claimedJob) return NextResponse.json({ success: false, videoId: resultVideoId, jobId: submitted.id, status: submitted.status }, { status: 202 })
    jobId = claimedJob.id
    await runVideoJob(claimedJob, worker)

    if (jobId) await finishJob(jobId, worker, 'done')
    const quotaConfirmed = await completeQuotaForFinishedJob(user.id, claimedJob.id)
    jobId = null

    const { data: video, error: readError } = await serviceClient.from('videos').select('*').eq('id', resultVideoId).eq('user_id', user.id).single()
    if (readError || !video) return NextResponse.json({ error: 'Lecture du resultat indisponible', videoId: resultVideoId, jobId: claimedJob.id, status: 'done' }, { status: 503 })
    return NextResponse.json({ success: true, video, jobId: claimedJob.id, quotaReconciliationRequired: !quotaConfirmed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    try {
      if (jobId) await finishJob(jobId, worker, 'queued', message)
    } catch {
      return NextResponse.json({ error: 'Generation indisponible', status: 'write_unconfirmed' }, { status: 503 })
    }
    // Only fixed, public mode errors may cross the HTTP boundary. Never return
    // the provider message, which can contain an endpoint, prompt or credential.
    const modeErrors: Record<string, string> = {
      SUTRA_LOCAL_NOT_CONFIGURED: 'Moteur personnel non configure ; aucun repli API payant.',
      SUTRA_LOCAL_FAILED: 'Moteur personnel indisponible ; aucun repli API payant.',
      SUTRA_SALAD_NOT_CONFIGURED: 'GPU distant open source non configure ; aucun repli API payant.',
      SUTRA_SALAD_DISABLED: 'GPU distant open source desactive ; aucun repli API payant.',
      SUTRA_SALAD_UNAVAILABLE: 'GPU distant open source indisponible ; aucun repli API payant.',
      SALAD_DISABLED: 'Moteur GPU distant open source desactive ; aucun repli API payant.',
      SALAD_INVALID_CONFIG: 'Moteur GPU distant open source non configure ; aucun repli API payant.',
      SALAD_NOT_QUALIFIED: 'Moteur GPU distant open source non qualifie pour cette demande.',
      SALAD_UNSUPPORTED_PROFILE: 'Format, qualite ou duree non qualifies sur le GPU distant.',
      SALAD_UNSUPPORTED_OPERATION: 'Operation non prise en charge par le GPU distant.',
      SALAD_CAPABILITIES_UNREACHABLE: 'Moteur GPU distant open source indisponible ; aucun repli API payant.',
      SALAD_CAPABILITIES_HTTP: 'Moteur GPU distant open source indisponible ; aucun repli API payant.',
      SALAD_STALE_QUOTE: 'Devis GPU expire ; nouvelle validation du budget necessaire.',
      SALAD_ESTIMATE_EXCEEDS_BUDGET: 'Estimation GPU superieure au budget autorise.',
      SALAD_ENGINE_BUSY: 'GPU distant occupe ; aucune nouvelle generation lancee.',
      SALAD_RECONCILIATION_REQUIRED: 'Generation distante a reconcilier ; reprendre cette meme tache.',
      SALAD_UPLOAD_FAILED_RESUME_SAME_JOB: 'Resultat distant a recuperer ; reprendre cette meme tache.',
    }
    const modeCode = message.split(':', 1)[0]
    if (Object.hasOwn(modeErrors, modeCode)) {
      return NextResponse.json({ error: modeErrors[modeCode], code: modeCode }, { status: 503 })
    }
    return NextResponse.json({ error: 'Erreur lors de la generation de la video', code: 'SUTRA_GENERATION_FAILED' }, { status: submissionErrorStatus(message) })
  }
}
