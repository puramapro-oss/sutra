import { smarana } from '@purama/smarana'
import { createServiceClient } from '@/lib/supabase'
import type { AutoConfig, AutoTheme, AutoMemory, AutoVideoRecord } from './sutra-auto-types'

// ---------------------------------------------------------------
// Performance analysis
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

  const result = await smarana.ask({
    appSlug: 'sutra',
    userId: params.userId,
    system: `Tu es un analyste de performance video. Analyse les stats et identifie 3 a 5 insights actionnables. Reponds en JSON: { "insights": ["insight 1", "insight 2"] }`,
    message: `Stats des dernieres videos:\n${stats}\n\nDonne 3-5 insights pour les prochaines videos.`,
    tier: 'main',
    maxTokens: 1500,
  })

  try {
    const parsed = JSON.parse(result.text.replace(/```json\n?|\n?```/g, '').trim())
    return Array.isArray(parsed.insights) ? parsed.insights : []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------
// DB helpers
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
