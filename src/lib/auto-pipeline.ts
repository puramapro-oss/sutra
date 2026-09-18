import { assembleFinalVideo, generateSubtitlesFromScript } from '@/lib/shotstack'
import {
  loadAutoContext, planNextVideo, generateAutoVideoAssets, recordMemory,
  type AutoConfig, type VideoPlan,
} from '@/lib/sutra-auto'
import type { Plan } from '@/types'

// -----------------------------------------------------------------------------
// Pipeline AUTO — exécutable inline (/api/auto/generate) OU par le worker
// (/api/cron/video-worker), avec REPRISE sans double génération :
//   plan (LLM)     → progress.steps.plan
//   assets (payant : vidéo IA + voix + musique) → progress.steps.assets
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
  assets: (plan: VideoPlan) => Promise<AutoAssets>
  /** Montage final (rendu payant). */
  assemble: typeof assembleFinalVideo
  /** Persistance finale (statut, URLs, mémoire, usage thème) — reçoit le plan. */
  persist: (input: AutoJobInput, final: AutoFinalState, plan: VideoPlan) => Promise<void>
}

export interface AutoFinalState {
  status: 'ready' | 'pending_approval' | 'compositing_failed'
  assets: AutoAssets
  videoFinalUrl: string
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
  const step = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const cached = done[key]
    if (cached !== undefined) return cached as T
    await hooks.heartbeat?.()
    const value = await fn()
    done[key] = value
    await hooks.onStepResolved?.(key, value)
    return value
  }

  const plan = await step('plan', () => providers.plan())
  const assets = await step('assets', () => providers.assets(plan))

  // Montage FINAL (audit #12) : assemblage voix+musique — une erreur de
  // montage n'invalide pas la vidéo brute (statut compositing_failed).
  const assembly = await step('assembly', async () => {
    if (!assets.audio_voice_url) return { url: null as string | null, error: null as string | null }
    try {
      const duration = Math.max(1, input.config.default_duration ?? 6)
      const subtitles = plan.script
        ? generateSubtitlesFromScript(plan.script, [{ duration_seconds: duration }])
        : []
      const assembled = await providers.assemble({
        clips: [{ url: assets.video_raw_url, type: 'ia', kind: 'video', duration }],
        voiceUrl: assets.audio_voice_url,
        musicUrl: assets.audio_music_url ?? '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: input.config.default_aspect_ratio ?? '9:16',
        quality: input.config.quality_level ?? '720p',
        brandKit: null,
      })
      return { url: assembled.url, error: null as string | null }
    } catch (err) {
      return { url: null as string | null, error: err instanceof Error ? err.message : String(err) }
    }
  })

  const final: AutoFinalState = await step('saved', async () => {
    const state: AutoFinalState = {
      status: assembly.error
        ? 'compositing_failed'
        : input.config.require_approval_before_publish ? 'pending_approval' : 'ready',
      assets,
      videoFinalUrl: assembly.url ?? assets.video_raw_url,
      assemblyError: assembly.error,
    }
    await providers.persist(input, state, plan)
    return state
  })
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
    assets: (plan) => generateAutoVideoAssets({ videoId: videoRowId, plan, config, userEmail, plan_tier: planTier }),
    assemble: (args) => assembleFinalVideo(args),
    persist: async (input, final, plan) => {
      await service
        .from('sutra_auto_videos')
        .update({
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
        .eq('id', input.videoRowId)
      await recordMemory({
        userId,
        type: 'preference',
        content: `Video generee: "${plan.title}" — theme: ${plan.theme_id ?? 'libre'}, raison: ${plan.reasoning}`,
        importance: 0.5,
        related_video_id: input.videoRowId,
      }).catch(() => {})
      if (plan.theme_id) {
        const ctx = await loadAutoContext(userId).catch(() => null)
        const used = ctx?.themes.find((t) => t.id === plan.theme_id)?.times_used ?? 0
        await service
          .from('sutra_auto_themes')
          .update({ last_used_at: new Date().toISOString(), times_used: used + 1 })
          .eq('id', plan.theme_id)
          .eq('user_id', userId)
          .then(() => undefined, () => undefined)
      }
    },
  }
}
