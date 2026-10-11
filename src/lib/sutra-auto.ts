/**
 * SUTRA - Mode autonome — Orchestrateur
 * ----------------------------------------------------------------
 * Orchestre la planification, la generation et la publication
 * automatiques de videos selon les preferences utilisateur.
 *
 * Pipeline:
 *   plan → generate (video + audio) → composite → publish → learn
 */

import { smarana } from '@purama/smarana'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { generateVideoSmart, durableLtxJob, type LtxJobState } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { uploadToStorage } from '@/lib/storage'
import { publishToPlatforms, type SocialPlatform, type PublicationStatus } from '@/lib/zernio'
import type { Plan } from '@/types'

// Re-export types from dedicated modules
export type {
  AutoConfig,
  AutoSchedule,
  AutoTheme,
  AutoMemory,
  AutoVideoRecord,
  VideoPlan,
} from './sutra-auto-types'

// Re-export utils
export { computeNextRun, needsFinalComposition, pickTheme } from './sutra-auto-utils'
export { analyzePerformance, loadAutoContext, recordMemory } from './sutra-auto-helpers'

// Import for local use
import type { AutoConfig, AutoTheme, AutoMemory, AutoVideoRecord, VideoPlan } from './sutra-auto-types'

const videoPlanSchema = z.object({
  title: z.string().trim().min(3).max(60),
  description: z.string().trim().min(10).max(3000),
  hashtags: z.array(z.string().trim().regex(/^#/)).min(3).max(15),
  video_prompt: z.string().trim().min(30).max(3000),
  music_prompt: z.string().trim().min(10).max(1000),
  script: z.string().trim().min(10).max(10000).nullable(),
  style_override: z.string().trim().max(100).nullable(),
  theme_id: z.string().uuid().nullable(),
  reasoning: z.string().trim().min(10).max(2000),
  expected_engagement: z.enum(['high', 'medium', 'low']),
  trend_leveraged: z.string().trim().max(300).nullable(),
})

function parseVideoPlan(raw: string): VideoPlan {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
  let value: unknown
  try {
    value = JSON.parse(cleaned)
  } catch {
    throw new Error('SUTRA_AUTO_PLAN_INVALID_JSON')
  }
  const parsed = videoPlanSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`SUTRA_AUTO_PLAN_INVALID_SCHEMA: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
  }
  return parsed.data
}

// ---------------------------------------------------------------
// 1. PLANNING - Claude joue le role de directeur creatif
// ---------------------------------------------------------------

export async function planNextVideo(params: {
  config: AutoConfig
  themes: AutoTheme[]
  memories: AutoMemory[]
  recentVideos: AutoVideoRecord[]
  topVideos: AutoVideoRecord[]
  userId?: string
}): Promise<VideoPlan> {
  const { config, themes, memories, recentVideos, topVideos, userId } = params

  const memoryBlock = memories
    .slice(0, 30)
    .map((m) => `- [${m.memory_type}] ${m.content}`)
    .join('\n')

  const themesBlock = themes
    .filter((t) => t.is_active)
    .map(
      (t) =>
        `{ "id": "${t.id}", "theme": "${t.theme}", "tone": "${t.tone ?? ''}", ` +
        `"audience": "${t.target_audience ?? ''}", "weight": ${t.weight}, ` +
        `"must": ${JSON.stringify(t.must_include)}, "never": ${JSON.stringify(t.never_include)} }`
    )
    .join('\n')

  const recentBlock = recentVideos
    .slice(0, 10)
    .map((v) => `- "${v.title}" (theme=${v.theme_id ?? 'n/a'}, prompt=${(v.prompt_used ?? '').slice(0, 80)})`)
    .join('\n')

  const topBlock = topVideos
    .slice(0, 5)
    .map((v) => `- "${v.title}" (theme=${v.theme_id ?? 'n/a'})`)
    .join('\n')

  const trends = memories
    .filter((m) => m.memory_type === 'trend')
    .slice(0, 10)
    .map((m) => `- ${m.content}`)
    .join('\n')

  const insights = memories
    .filter((m) => m.memory_type === 'learning' || m.memory_type === 'performance')
    .slice(0, 10)
    .map((m) => `- ${m.content}`)
    .join('\n')

  const system = `Tu es le directeur creatif de SUTRA, le studio video IA le plus avance au monde.

MISSION
Creer du contenu video viral, unique, qui arrete le scroll en 0.5s.

MEMOIRE UTILISATEUR
${memoryBlock || '(vide)'}

PREFERENCES
- Style: ${config.default_style}
- Duree: ${config.default_duration}s
- Format: ${config.default_aspect_ratio}
- Musique: ${config.default_music_genre}
- Langue: ${config.default_language}
- Voix activee: ${config.default_voice_enabled}

THEMES DISPONIBLES
${themesBlock || '(aucun theme - libre creativite)'}

DERNIERES VIDEOS (eviter repetition)
${recentBlock || '(aucune)'}

TOP PERFORMANCES
${topBlock || '(aucune donnee)'}

TENDANCES ACTUELLES
${trends || '(aucune detectee)'}

INSIGHTS
${insights || '(aucun)'}

REGLES
1. JAMAIS deux videos identiques
2. Utilise les insights de performance
3. Surfe sur les tendances quand pertinent
4. video_prompt = ultra-detaille en ANGLAIS, cinematique
5. Titre irresistible (max 60 chars)
6. 10-15 hashtags pour decouvrabilite
7. Respecte must_include / never_include du theme
8. Privilegie les themes avec poids eleves et peu utilises recemment
9. N'invente aucun fait, chiffre, temoignage, marque, tendance ou fonctionnalite
10. N'ecris aucun texte ni logo dans video_prompt : ces elements sont ajoutes en postproduction
11. Decris sujet, action, decor, cadrage, lumiere, camera et progression temporelle
12. expected_engagement est une hypothese, jamais une garantie

FORMAT (JSON strict, aucun texte autour)
{
  "title": "...",
  "description": "...",
  "hashtags": ["#tag1","#tag2"],
  "video_prompt": "...",
  "music_prompt": "...",
  "script": null,
  "style_override": null,
  "theme_id": "uuid ou null",
  "reasoning": "...",
  "expected_engagement": "high",
  "trend_leveraged": null
}`

  const result = await smarana.ask({
    appSlug: 'sutra',
    userId,
    system,
    message: `Cree le plan de la prochaine video pour ce createur. Aujourd'hui: ${new Date().toISOString()}.`,
    tier: 'main',
    maxTokens: 2000,
  })

  return parseVideoPlan(result.text)
}

// ---------------------------------------------------------------
// 2. GENERATION - video + musique (+ voix optionnelle)
// ---------------------------------------------------------------

export async function generateAutoVideoAssets(params: {
  videoId: string
  plan: VideoPlan
  config: AutoConfig
  userEmail: string | null
  plan_tier: Plan
  progress?: {
    steps: Record<string, unknown>
    onStepResolved?: (key: string, value: unknown) => Promise<void>
  }
}): Promise<{
  video_raw_url: string
  audio_music_url: string | null
  audio_voice_url: string | null
}> {
  const { videoId, plan, config, userEmail, plan_tier } = params

  if (config.default_voice_enabled && (!plan.script || !config.default_voice_id)) {
    throw new Error('Voix demandee: script et identifiant vocal requis avant generation')
  }
  const done = params.progress?.steps ?? {}
  const save = async (key: string, value: unknown) => {
    await params.progress?.onStepResolved?.(key, value)
    done[key] = value
  }
  const asset = async (key: string, generate: () => Promise<string>): Promise<string> => {
    if (typeof done[key] === 'string' && done[key]) return done[key] as string
    const remote = done[`${key}:ltx`] as LtxJobState | undefined
    if (done[`${key}:started`] && !(key === 'asset:video' && remote?.id)) throw new Error(`SUTRA_RECONCILIATION_REQUIRED: ${key}`)
    await save(`${key}:started`, true)
    const value = await generate()
    if (!value) throw new Error(`Resultat obligatoire manquant: ${key}`)
    await save(key, value)
    return value
  }

  // 1. Video brute (LTX/WAN)
  const video_raw_url = await asset('asset:video', async () => {
    const ltxResult = await generateVideoSmart(plan.video_prompt, plan_tier, userEmail, {
      format: config.default_aspect_ratio,
      quality: config.quality_level,
      duration: config.default_duration,
      userId: config.user_id,
      videoId,
      job: durableLtxJob(done, 'asset:video:ltx', params.progress?.onStepResolved),
    })
    return uploadToStorage(`auto/${videoId}/raw.mp4`, ltxResult.videoBuffer, 'video/mp4')
  })

  // Chaque piste demandée doit être obtenue et checkpointée séparément.
  let audio_music_url: string | null = null
  if (config.default_music_genre && config.default_music_genre !== 'none') {
    audio_music_url = await asset('asset:music', async () => {
      const music = await generateMusic({
        prompt: plan.music_prompt,
        style: config.default_music_genre as never,
        duration: config.default_duration,
        instrumental: true,
      })
      return music.audio_url
    })
  }

  // 3. Voix (ElevenLabs) si activee + script present
  let audio_voice_url: string | null = null
  if (config.default_voice_enabled && plan.script && config.default_voice_id) {
    audio_voice_url = await asset('asset:voice', async () => {
      const voiceBuffer = await generateVoice({
        text: plan.script!,
        voice_id: config.default_voice_id!,
      })
      return uploadToStorage(
        `auto/${videoId}/voice.mp3`,
        voiceBuffer,
        'audio/mpeg'
      )
    })
  }

  return { video_raw_url, audio_music_url, audio_voice_url }
}

// ---------------------------------------------------------------
// 3. PUBLICATION - via Zernio sur les plateformes connectees
// ---------------------------------------------------------------

const PLATFORM_ALIASES: Record<string, SocialPlatform> = {
  youtube_shorts: 'youtube',
  instagram_reels: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'x',
  twitter: 'x',
  linkedin: 'linkedin',
  pinterest: 'pinterest',
  threads: 'threads',
  snapchat: 'snapchat',
  reddit: 'reddit',
}

export async function publishAutoVideo(params: {
  config: AutoConfig
  videoUrl: string
  title: string
  description: string
  hashtags: string[]
  scheduledFor?: string
  idempotencyKey?: string
}): Promise<Array<{ platform: string; success: boolean; status?: PublicationStatus; postId?: string; postUrl?: string; error?: string }>> {
  const platforms = [...new Set((params.config.publish_platforms ?? [])
    .map((p) => PLATFORM_ALIASES[p] ?? (p as SocialPlatform))
    .filter(Boolean))] as SocialPlatform[]

  if (!platforms.length) {
    return [{ platform: 'none', success: false, error: 'no platforms configured' }]
  }

  const accountIds: Record<string, string> = {}
  for (const conn of params.config.zernio_connected_platforms ?? []) {
    accountIds[conn.platform] = conn.account_id
  }

  // Si aucun compte connecte, mode "stub" — on log mais ne fail pas
  const missing = platforms.filter((p) => !accountIds[p])
  if (missing.length === platforms.length) {
    return platforms.map((p) => ({
      platform: p,
      success: false,
      error: 'compte non connecte',
    }))
  }

  const results = await publishToPlatforms({
    videoUrl: params.videoUrl,
    caption: `${params.title}\n\n${params.description}`,
    hashtags: params.hashtags,
    platforms: platforms.filter((p) => accountIds[p]),
    accountIds: accountIds as Record<SocialPlatform, string>,
    scheduledAt: params.scheduledFor,
    idempotencyKey: params.idempotencyKey,
  })

  // Include disconnected requested platforms so callers cannot report full success.
  return [
    ...results,
    ...missing.map((platform) => ({
      platform,
      success: false,
      error: 'compte non connecte',
    })),
  ]
}

// Functions analyzePerformance, loadAutoContext, recordMemory
// are re-exported from sutra-auto-helpers.ts

/** One claim shared by manual and cron publication. An uncertain outcome keeps
 * the row in publishing so a repeated HTTP request cannot submit it again. */
export async function publishAutoVideoRecord(
  userId: string,
  videoId: string,
  explicitApproval: boolean,
  service = createServiceClient(),
  publish = publishAutoVideo,
) {
  const { data: video, error: videoError } = await service.from('sutra_auto_videos')
    .select('*').eq('id', videoId).eq('user_id', userId).maybeSingle()
  if (videoError) throw new Error('Lecture video impossible')
  const allowed = explicitApproval ? ['ready', 'pending_approval'] : ['ready']
  if (!video?.video_final_url || !allowed.includes(video.status)) throw new Error('Video non publiable ou deja prise en charge')
  const { data: completedJob, error: jobError } = await service.from('video_jobs').select('progress')
    .eq('user_id', userId).eq('kind', 'auto').eq('status', 'done')
    .contains('payload', { input: { videoRowId: videoId } }).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const verification = completedJob?.progress?.steps?.assembly?.verification
  if (jobError || verification?.url !== video.video_final_url || !/^[a-f\d]{64}$/.test(verification?.sha256 ?? '')) {
    throw new Error('SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED')
  }

  const { data: config, error: configError } = await service.from('sutra_auto_config')
    .select('*').eq('user_id', userId).single()
  if (configError || !config) throw new Error('Configuration publication indisponible')
  if (!explicitApproval && (!config.auto_publish || config.require_approval_before_publish || !video.scheduled_for || new Date(video.scheduled_for).getTime() > Date.now())) {
    throw new Error('Publication automatique non autorisee a cet instant')
  }
  // Account IDs come from server-verified ownership, never from a writable preference.
  const { data: accounts, error: accountsError } = await service.schema('public').from('social_accounts')
    .select('platform,external_id,username').eq('user_id', userId).eq('status', 'connected')
  if (accountsError) throw new Error('Verification des comptes impossible')
  const verifiedConfig = {
    ...config,
    zernio_connected_platforms: (accounts ?? []).filter(a => a.external_id).map(a => ({
      platform: a.platform, account_id: a.external_id, username: a.username,
    })),
  } as AutoConfig

  const { data: claimed, error: claimError } = await service.from('sutra_auto_videos')
    .update({ status: 'publishing' }).eq('id', videoId).eq('user_id', userId)
    .eq('status', video.status).eq('video_final_url', video.video_final_url).select('id').maybeSingle()
  if (claimError) throw new Error('Reservation publication impossible')
  if (!claimed) throw new Error('Publication deja prise en charge')

  const results = await publish({ config: verifiedConfig, videoUrl: video.video_final_url,
    title: video.title ?? '', description: video.description ?? '', hashtags: video.hashtags ?? [], idempotencyKey: `sutra-auto-${videoId}` })
  const successes = results.filter(result => result.success && result.status === 'published').length
  const status = results.length > 0 && successes === results.length ? 'published'
    : results.some(result => result.status === 'publishing' || result.status === 'unknown' || result.status === 'scheduled') ? 'publishing'
    : successes > 0 ? 'partially_published' : 'failed'
  const { data: saved, error: saveError } = await service.from('sutra_auto_videos').update({
    status, published_at: successes > 0 ? new Date().toISOString() : null,
    published_platforms: results,
    error_message: results.map(result => result.error).filter(Boolean).join(' | ') || null,
  }).eq('id', videoId).eq('user_id', userId).eq('status', 'publishing')
    .eq('video_final_url', video.video_final_url).select('id').single()
  if (saveError || !saved) throw new Error('SUTRA_RECONCILIATION_REQUIRED: resultat publication non enregistre')
  return { success: status === 'published', status, results }
}
