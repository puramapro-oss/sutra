import { assembleFinalVideo } from './final-composition'
import { pipelineSteps, checkpointStage, assertFinalMedia, persistPipelineVideo } from '@/lib/pipeline-state'
import { generateSubtitlesFromScript, durableRenderJob, verifyAndStoreRenderedVideo } from '@/lib/shotstack'
import {
  loadAutoContext, planNextVideo, generateAutoVideoAssets,
  type AutoConfig, type VideoPlan,
} from '@/lib/sutra-auto'
import type { Plan } from '@/types'

// -----------------------------------------------------------------------------
// Pipeline AUTO — exécutable inline (/api/auto/generate) OU par le worker
// (/api/cron/video-worker), avec REPRISE sans double génération :
//   plan (LLM)     → progress.steps.plan
//   vidéo, musique, voix → progress.steps['asset:video|music|voice']
//   agrégat assets      → progress.steps.assets
//   assembly       → progress.steps.assembly
//   persistance    → progress.steps.saved
// Un crash ne régénère JAMAIS une étape déjà checkpointée (audit #10/#14).
// -----------------------------------------------------------------------------

export interface AutoJobInput {
  userId: string
  videoRowId: string
  scheduleId: string | null
  userEmail: string | null
  planTier: Plan
  config: AutoConfig
  /** ISO — sert au calcul de generation_duration_seconds au persist. */
  generationStartedAt: string
}

export interface AutoJobResume {
  steps: Record<string, unknown>
}

export interface AutoJobHooks {
  onStepResolved?: (key: string, value: unknown) => Promise<void>
  heartbeat?: () => Promise<void>
}

export interface AutoAssets {
  video_raw_url: string
  audio_music_url: string | null
  audio_voice_url: string | null
}

export interface AutoProviders {
  /** Planification LLM (recharge le contexte auto elle-même). */
  plan: () => Promise<VideoPlan>
  /** Génération payante : vidéo IA + voix + musique. */
  assets: (plan: VideoPlan, progress?: AutoJobResume & AutoJobHooks) => Promise<AutoAssets>
  /** Montage final (rendu payant). */
  assemble: typeof assembleFinalVideo
  /** Persistance finale (statut, URLs, mémoire, usage thème) — reçoit le plan. */
  persist: (input: AutoJobInput, final: AutoFinalState, plan: VideoPlan) => Promise<void>
}

export interface AutoFinalState {
  status: 'ready' | 'pending_approval' | 'compositing'
  assets: AutoAssets
  videoFinalUrl: string | null
  assemblyError: string | null
}

/**
 * Exécute la génération auto. Chaque clé de `resume.steps` court-circuite
 * l'étape correspondante — reprise sans double génération ni double débit.
 */
export async function executeAutoJob(
  input: AutoJobInput,
  resume: AutoJobResume,
  hooks: AutoJobHooks = {},
  providers: AutoProviders
): Promise<AutoFinalState> {
  const done = resume.steps
  const step = pipelineSteps(done, hooks)

  const plan = await step('plan', () => providers.plan(), true)
  await checkpointStage(done, hooks, 'script', plan)
  const assets = await step('assets', () => providers.assets(plan, { steps: done, ...hooks }))

  await checkpointStage(done, hooks, 'scenes', [assets.video_raw_url])
  await checkpointStage(done, hooks, 'images', [], 'skipped')
  await checkpointStage(done, hooks, 'voice', assets.audio_voice_url, assets.audio_voice_url ? 'complete' : 'skipped')
  await checkpointStage(done, hooks, 'music', assets.audio_music_url, assets.audio_music_url ? 'complete' : 'skipped')
  // A failed required composition must never expose the raw URL as final.
  let assembly: { url: string | null; error: string | null; outputVerified?: boolean }
  try {
    if (!assets.video_raw_url) throw new Error('Video brute manquante')
    if (input.config.default_voice_enabled && !assets.audio_voice_url) throw new Error('Voix demandee manquante')
    if (input.config.default_music_genre && input.config.default_music_genre !== 'none' && !assets.audio_music_url) {
      throw new Error('Musique demandee manquante')
    }
    const cached = done.assembly as { error?: string; url?: string } | undefined
    if (cached?.error) throw new Error('SUTRA_RECONCILIATION_REQUIRED: ancien montage en echec')
    assembly = await step('assembly', async () => {
      const duration = Math.max(1, input.config.default_duration ?? 6)
      const subtitles = await step('subtitles', async () => plan.script
        ? generateSubtitlesFromScript(plan.script, [{ duration_seconds: duration }]) : [])
      await checkpointStage(done, hooks, 'subtitles', subtitles)
      // Even a silent clip is exported to the requested format/size, then verified.
      // A raw provider URL is never treated as a validated final export.
      const rendered = await step('rendered', () => providers.assemble({
        clips: [{ url: assets.video_raw_url, type: 'ia', kind: 'video', duration }],
        voiceUrl: assets.audio_voice_url ?? '',
        musicUrl: assets.audio_music_url ?? '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: input.config.default_aspect_ratio ?? '9:16',
        quality: input.config.quality_level ?? '720p',
        brandKit: {
          intro_template: input.config.intro_clip_url ?? undefined,
          outro_template: input.config.outro_clip_url ?? undefined,
          logo_url: input.config.watermark_url ?? undefined,
        },
        renderJob: durableRenderJob(done, hooks.onStepResolved),
      }), true, typeof done.assembly_render_id === 'string')
      await checkpointStage(done, hooks, 'composition', rendered)
      const assembled = await step('verified', () => verifyAndStoreRenderedVideo(rendered, {
        userId: input.userId, mediaId: input.videoRowId,
        requireAudio: Boolean(assets.audio_music_url || assets.audio_voice_url),
      }))
      assertFinalMedia(assembled, [assets.video_raw_url], Boolean(assets.audio_music_url || assets.audio_voice_url))
      await checkpointStage(done, hooks, 'export', assembled)
      return { url: assembled.url, error: null as string | null, outputVerified: true, verification: assembled.verification }
    })
    if (!done.verified) throw new Error('SUTRA_RECONCILIATION_REQUIRED: missing export checkpoint')
    assertFinalMedia(done.verified as import('@/lib/shotstack').AssembleResult, [assets.video_raw_url], Boolean(assets.audio_music_url || assets.audio_voice_url))
    if (!assembly.outputVerified) throw new Error('SUTRA_RECONCILIATION_REQUIRED: ancien resultat final non verifie')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await providers.persist(input, { status: 'compositing', assets, videoFinalUrl: null, assemblyError: message }, plan)
    throw err
  }
  if (!assembly.url) throw new Error('Montage final absent — validation refusee')

  const final: AutoFinalState = await step('saved', async () => {
    const state: AutoFinalState = {
      status: input.config.require_approval_before_publish ? 'pending_approval' : 'ready',
      assets,
      videoFinalUrl: assembly.url,
      assemblyError: assembly.error,
    }
    await providers.persist(input, state, plan)
    return state
  })
  await checkpointStage(done, hooks, 'publication', { reason: input.config.require_approval_before_publish ? 'approval required' : 'scheduler publication pending' }, 'pending')
  return final
}

/** Fournisseurs réels (route + worker) — les tests injectent des doublures. */
export function buildAutoProviders(
  userId: string,
  videoRowId: string,
  config: AutoConfig,
  userEmail: string | null,
  planTier: Plan,
  service: ReturnType<typeof import('@/lib/supabase').createServiceClient>
): AutoProviders {
  return {
    plan: async () => {
      const ctx = await loadAutoContext(userId)
      return planNextVideo({
        config,
        themes: ctx.themes,
        memories: ctx.memories,
        recentVideos: ctx.recentVideos,
        topVideos: ctx.topVideos,
        userId,
      })
    },
    assets: (plan, progress) => generateAutoVideoAssets({ videoId: videoRowId, plan, config, userEmail, plan_tier: planTier, progress }),
    assemble: (args) => assembleFinalVideo(args),
    persist: async (input, final, plan) => {
      await persistPipelineVideo(service, 'sutra_auto_videos', input.videoRowId, {
          status: final.status,
          title: plan.title,
          description: plan.description,
          hashtags: plan.hashtags,
          script: plan.script,
          theme_id: plan.theme_id,
          prompt_used: plan.video_prompt,
          music_prompt: plan.music_prompt,
          ai_reasoning: plan.reasoning,
          ai_confidence: plan.expected_engagement === 'high' ? 0.9 : plan.expected_engagement === 'medium' ? 0.6 : 0.3,
          video_raw_url: final.assets.video_raw_url,
          video_final_url: final.videoFinalUrl,
          audio_music_url: final.assets.audio_music_url,
          audio_voice_url: final.assets.audio_voice_url,
          error_message: final.assemblyError,
          generation_completed_at: new Date().toISOString(),
          generation_duration_seconds: Math.max(
            1,
            Math.floor((Date.now() - new Date(input.generationStartedAt).getTime()) / 1000)
          ),
        })

    },
  }
}
