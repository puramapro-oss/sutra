/**
 * SUTRA - Mode autonome — Orchestrateur
 * ----------------------------------------------------------------
 * Orchestre la planification, la generation et la publication
 * automatiques de videos selon les preferences utilisateur.
 *
 * Pipeline:
 *   plan → generate (video + audio) → composite → publish → learn
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase'
import { generateVideoSmart } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { uploadToStorage } from '@/lib/storage'
import { publishToPlatforms, type SocialPlatform } from '@/lib/zernio'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface AutoConfig {
  id: string
  user_id: string
  is_active: boolean
  schedules: AutoSchedule[]
  default_style: string
  default_duration: number
  default_aspect_ratio: string
  default_music_genre: string
  default_voice_enabled: boolean
  default_voice_id: string | null
  default_language: string
  publish_platforms: string[]
  auto_publish: boolean
  require_approval_before_publish: boolean
  zernio_connected_platforms: Array<{ platform: SocialPlatform; account_id: string; username: string }>
  watermark_url: string | null
  intro_clip_url: string | null
  outro_clip_url: string | null
  brand_colors: Record<string, string> | null
  preferred_model: string
  quality_level: string
}

export interface AutoSchedule {
  id: string
  name: string
  is_active: boolean
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  days: string[] // ["MO","TU"...]
  time: string // "10:00"
  timezone: string
  theme_ids?: string[]
}

export interface AutoTheme {
  id: string
  user_id: string
  schedule_id: string | null
  theme: string
  description: string | null
  example_prompts: string[]
  must_include: string[]
  never_include: string[]
  target_audience: string | null
  tone: string | null
  weight: number
  last_used_at: string | null
  times_used: number
  is_active: boolean
}

export interface AutoMemory {
  id: string
  user_id: string
  memory_type: 'preference' | 'performance' | 'feedback' | 'trend' | 'learning'
  content: string
  importance: number
  related_video_id: string | null
  related_theme: string | null
  related_platform: string | null
  expires_at: string | null
}

export interface AutoVideoRecord {
  id: string
  user_id: string
  schedule_id: string | null
  theme_id: string | null
  status: string
  title: string | null
  description: string | null
  hashtags: string[]
  script: string | null
  prompt_used: string | null
  music_prompt: string | null
  video_raw_url: string | null
  video_final_url: string | null
  thumbnail_url: string | null
  scheduled_for: string | null
  ai_reasoning: string | null
}

export interface VideoPlan {
  title: string
  description: string
  hashtags: string[]
  video_prompt: string
  music_prompt: string
  script: string | null
  style_override: string | null
  theme_id: string | null
  reasoning: string
  expected_engagement: 'high' | 'medium' | 'low'
  trend_leveraged: string | null
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

/**
 * Calcule la prochaine occurrence d'un schedule.
 */
export function computeNextRun(schedule: AutoSchedule, from: Date = new Date()): Date | null {
  if (!schedule.is_active) return null
  const [h, m] = schedule.time.split(':').map(Number)
  const candidate = new Date(from)
  candidate.setHours(h, m, 0, 0)

  if (schedule.frequency === 'daily') {
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1)
    return candidate
  }

  const days = schedule.days.length ? schedule.days : ['MO']
  const targetDays = days.map((d) => DAY_MAP[d]).filter((d) => Number.isFinite(d))
  if (!targetDays.length) return null

  for (let offset = 0; offset < 31; offset++) {
    const d = new Date(candidate)
    d.setDate(d.getDate() + offset)
    if (!targetDays.includes(d.getDay())) continue
    if (d <= from) continue
    if (schedule.frequency === 'weekly') return d
    if (schedule.frequency === 'biweekly' && offset % 14 === 0) return d
    if (schedule.frequency === 'monthly') return d
  }
  return null
}

/**
 * Selectionne un theme selon la rotation par poids.
 */
export function pickTheme(themes: AutoTheme[]): AutoTheme | null {
  const active = themes.filter((t) => t.is_active)
  if (!active.length) return null

  // Pondere par weight ET inversement par times_used recents
  const scored = active.map((t) => {
    const recencyBoost = t.last_used_at
      ? Math.max(0, 1 - (Date.now() - new Date(t.last_used_at).getTime()) / (7 * 86400000))
      : 1
    return { theme: t, score: t.weight * (2 - recencyBoost) + Math.random() * 0.5 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].theme
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
}): Promise<VideoPlan> {
  const { config, themes, memories, recentVideos, topVideos } = params

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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system,
    messages: [
      {
        role: 'user',
        content: `Cree le plan de la prochaine video pour ce createur. Aujourd'hui: ${new Date().toISOString()}.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
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

// ---------------------------------------------------------------
// 4. APPRENTISSAGE - analyse des performances
// ---------------------------------------------------------------

export async function analyzePerformance(params: {
  userId: string
  recentVideos: AutoVideoRecord[]
}): Promise<string[]> {
  if (!params.recentVideos.length) return []

  const stats = params.recentVideos
    .map((v: AutoVideoRecord & { views?: number; likes?: number; engagement_rate?: number }) =>
      `- "${v.title}": views=${v.views ?? 0}, likes=${v.likes ?? 0}, engagement=${v.engagement_rate ?? 0}%`
    )
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: `Tu es un analyste de performance video. Analyse les stats et identifie 3 a 5 insights actionnables. Reponds en JSON: { "insights": ["insight 1", "insight 2"] }`,
    messages: [
      {
        role: 'user',
        content: `Stats des dernieres videos:\n${stats}\n\nDonne 3-5 insights pour les prochaines videos.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    return Array.isArray(parsed.insights) ? parsed.insights : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------
// 5. DB helpers
// ---------------------------------------------------------------

export async function loadAutoContext(userId: string): Promise<{
  config: AutoConfig | null
  themes: AutoTheme[]
  memories: AutoMemory[]
  recentVideos: AutoVideoRecord[]
  topVideos: AutoVideoRecord[]
}> {
  const supabase = createServiceClient()

  const [configRes, themesRes, memoriesRes, recentRes, topRes] = await Promise.all([
    supabase.from('sutra_auto_config').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('sutra_auto_themes').select('*').eq('user_id', userId).eq('is_active', true),
    supabase
      .from('sutra_auto_memory')
      .select('*')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('importance', { ascending: false })
      .limit(50),
    supabase
      .from('sutra_auto_videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('sutra_auto_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('engagement_rate', { ascending: false, nullsFirst: false })
      .limit(5),
  ])

  return {
    config: (configRes.data as AutoConfig | null) ?? null,
    themes: (themesRes.data as AutoTheme[] | null) ?? [],
    memories: (memoriesRes.data as AutoMemory[] | null) ?? [],
    recentVideos: (recentRes.data as AutoVideoRecord[] | null) ?? [],
    topVideos: (topRes.data as AutoVideoRecord[] | null) ?? [],
  }
}

export async function recordMemory(params: {
  userId: string
  type: AutoMemory['memory_type']
  content: string
  importance?: number
  expiresInDays?: number
  related_video_id?: string
  related_theme?: string
}): Promise<void> {
  const supabase = createServiceClient()
  const expires_at = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 86400000).toISOString()
    : null

  await supabase.from('sutra_auto_memory').insert({
    user_id: params.userId,
    memory_type: params.type,
    content: params.content,
    importance: params.importance ?? 0.5,
    expires_at,
    related_video_id: params.related_video_id ?? null,
    related_theme: params.related_theme ?? null,
  })
}
