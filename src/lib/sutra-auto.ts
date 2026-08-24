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
import { createServiceClient } from '@/lib/supabase'
import { generateVideoSmart } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { uploadToStorage } from '@/lib/storage'
import { publishToPlatforms, type SocialPlatform } from '@/lib/zernio'

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
export { computeNextRun, pickTheme } from './sutra-auto-utils'
export { analyzePerformance, loadAutoContext, recordMemory } from './sutra-auto-helpers'

// Import for local use
import type { AutoConfig, AutoTheme, AutoMemory, AutoVideoRecord, VideoPlan } from './sutra-auto-types'

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

  const cleaned = result.text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleaned) as VideoPlan
}

// ---------------------------------------------------------------
// 2. GENERATION - video + musique (+ voix optionnelle)
// ---------------------------------------------------------------

export async function generateAutoVideoAssets(params: {
  videoId: string
  plan: VideoPlan
  config: AutoConfig
  userEmail: string | null
  plan_tier: 'free' | 'starter' | 'creator' | 'pro' | 'enterprise'
}): Promise<{
  video_raw_url: string
  audio_music_url: string | null
  audio_voice_url: string | null
}> {
  const { videoId, plan, config, userEmail, plan_tier } = params

  // 1. Video brute (LTX/WAN)
  const ltxResult = await generateVideoSmart(plan.video_prompt, plan_tier as never, userEmail, {
    format: config.default_aspect_ratio,
    quality: config.quality_level,
    duration: config.default_duration,
  })

  const video_raw_url = await uploadToStorage(
    `auto/${videoId}/raw.mp4`,
    ltxResult.videoBuffer,
    'video/mp4'
  )

  // 2. Musique (Suno) — best effort, ne bloque pas si echec
  let audio_music_url: string | null = null
  try {
    const music = await generateMusic({
      prompt: plan.music_prompt,
      style: (config.default_music_genre as never) ?? 'cinematic',
      duration: config.default_duration,
      instrumental: true,
    })
    audio_music_url = music.audio_url
  } catch (err) {
    console.error('[sutra-auto] music generation failed:', err)
  }

  // 3. Voix (ElevenLabs) si activee + script present
  let audio_voice_url: string | null = null
  if (config.default_voice_enabled && plan.script && config.default_voice_id) {
    try {
      const voiceBuffer = await generateVoice({
        text: plan.script,
        voice_id: config.default_voice_id,
      })
      audio_voice_url = await uploadToStorage(
        `auto/${videoId}/voice.mp3`,
        voiceBuffer,
        'audio/mpeg'
      )
    } catch (err) {
      console.error('[sutra-auto] voice generation failed:', err)
    }
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
}): Promise<Array<{ platform: string; success: boolean; postId?: string; postUrl?: string; error?: string }>> {
  const platforms = (params.config.publish_platforms ?? [])
    .map((p) => PLATFORM_ALIASES[p] ?? (p as SocialPlatform))
    .filter(Boolean) as SocialPlatform[]

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
  })

  return results
}

// Functions analyzePerformance, loadAutoContext, recordMemory
// are re-exported from sutra-auto-helpers.ts
