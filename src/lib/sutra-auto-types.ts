import type { SocialPlatform } from '@/lib/zernio'

// ---------------------------------------------------------------
// Types — Mode autonome
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
