export type Plan = 'free' | 'starter' | 'creator' | 'empire' | 'enterprise' | 'admin'
export type Role = 'user' | 'admin' | 'super_admin' | 'influencer'
export type VideoStatus = 'draft' | 'generating' | 'ready' | 'published' | 'failed'
export type VideoQuality = '720p' | '1080p' | '4k'
export type VideoFormat = '16:9' | '9:16' | '1:1'
export type MusicStyle = 'cinematic' | 'lo-fi' | 'epic' | 'chill' | 'motivational' | 'dramatic' | 'upbeat' | 'ambient'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'incomplete'
export type CommissionType = 'first_payment_50pct' | 'recurring_10pct' | 'milestone_bonus_30pct' | 'contest_reward' | 'influencer_commission'
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid'
export type ContestStatus = 'open' | 'judging' | 'completed'

export interface Profile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  plan: Plan
  is_admin: boolean
  credits: number
  referral_code: string | null
  referred_by: string | null
  wallet_balance: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus | null
  preferred_niche: string | null
  preferred_voice_style: string | null
  preferred_quality: VideoQuality
  brand_kit: BrandKit | null
  theme_mode: 'dark' | 'light'
  email_preferences: EmailPreferences
  onboarding_completed: boolean
  tutorial_completed: boolean
  monthly_video_count: number
  created_at: string
  updated_at: string
}

export interface BrandKit {
  logo_url?: string
  colors?: { primary: string; secondary: string }
  font?: string
  intro_template?: string
  outro_template?: string
}

export interface EmailPreferences {
  welcome: boolean
  digest: boolean
  inactivity: boolean
  tips: boolean
  contest: boolean
  referral: boolean
}

export interface Video {
  id: string
  user_id: string
  title: string | null
  description: string | null
  tags: string[]
  video_url: string | null
  thumbnail_url: string | null
  voice_url: string | null
  music_url: string | null
  script_data: ScriptData | null
  shotstack_json: Record<string, unknown> | null
  quality: VideoQuality
  format: VideoFormat
  duration: number | null
  status: VideoStatus
  cost_estimate: number | null
  publish_data: PublishData | null
  created_at: string
  updated_at: string
}

export interface ScriptData {
  title: string
  description: string
  tags: string[]
  narration: string
  scenes: Scene[]
  music_prompt: string
  music_style: MusicStyle
  thumbnail_prompt: string
  estimated_duration: number
}

export interface Scene {
  visual_prompt: string
  duration_seconds: number
  use_stock: boolean
}

export interface PublishData {
  youtube_id?: string
  tiktok_id?: string
  instagram_id?: string
  scheduled_at?: string
}

export interface Draft {
  id: string
  user_id: string
  type: string
  data: Record<string, unknown>
  updated_at: string
  created_at: string
}

export interface VideoVersion {
  id: string
  video_id: string
  version_number: number
  shotstack_json: Record<string, unknown>
  created_at: string
}

export interface ClonedVoice {
  id: string
  user_id: string
  name: string
  elevenlabs_voice_id: string
  preview_url: string | null
  created_at: string
}

export interface UserNotification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export interface AdminNotification {
  id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export interface ReferralCommission {
  id: string
  referrer_id: string
  referred_id: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  amount: number
  method: 'paypal' | 'bank'
  details: Record<string, unknown>
  status: WithdrawalStatus
  created_at: string
}

export interface ContestSubmission {
  id: string
  user_id: string
  video_id: string
  contest_id: string
  ai_score: number | null
  community_votes: number
  status: string
  created_at: string
}

export interface AutopilotSeries {
  id: string
  user_id: string
  name: string
  niche: string
  frequency: 'daily' | 'weekly'
  networks: string[]
  approval_mode: 'auto' | 'manual'
  is_active: boolean
  last_run_at: string | null
  next_run_at: string | null
  config: Record<string, unknown>
  created_at: string
}

export interface ApiLog {
  id: string
  user_id: string | null
  service: string
  endpoint: string
  status: string
  response_time_ms: number | null
  estimated_cost: number | null
  error_message: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  type: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AppConfig {
  key: string
  value: Record<string, unknown>
  updated_at: string
}

export interface Testimonial {
  id: string
  name: string
  role: string
  content: string
  avatar_url: string | null
  rating: number
  is_visible: boolean
  created_at: string
}

export interface ChangelogEntry {
  id: string
  title: string
  description: string
  badge: string
  published_at: string
}

export interface ScheduledPost {
  id: string
  user_id: string
  video_id: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  scheduled_at: string
  status: 'scheduled' | 'published' | 'failed'
  platform_post_id: string | null
  created_at: string
}

export interface UserTemplate {
  id: string
  user_id: string
  name: string
  description: string | null
  format: VideoFormat
  template_data: Record<string, unknown>
  is_public: boolean
  created_at: string
}

export interface PipelineStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'completed' | 'error'
  duration?: string
}
