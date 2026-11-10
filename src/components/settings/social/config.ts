import { PLATFORM_INFO } from '@/lib/zernio'
import type { AutopilotConfig } from './AutopilotSection'
import { validAccountIds } from './accounts'

export interface AutoVideoConfig {
  default_style: string
  default_duration: number
  default_aspect_ratio: string
  default_music_genre: string
  default_voice_enabled: boolean
  default_voice_id: string | null
  default_language: string
  publish_platforms: string[]
  publish_account_ids: string[]
  auto_publish: boolean
  require_approval_before_publish: boolean
  preferred_model: string
  quality_level: string
}

// Failed reads are unknown, never defaults that could overwrite saved preferences.
export function readAutopilotConfig(value: unknown): AutopilotConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_autopilot')
  const config = value as Record<string, unknown>
  if (!(['enabled', 'auto_caption', 'auto_hashtags', 'include_cta'].every(key => typeof config[key] === 'boolean')
    && Array.isArray(config.default_platforms)
    && config.default_platforms.every(platform => typeof platform === 'string' && Object.hasOwn(PLATFORM_INFO, platform))
    && validAccountIds(config.publish_account_ids ?? [])
    && typeof config.caption_style === 'string'
    && ['engaging', 'professional', 'casual', 'educational', 'humorous'].includes(config.caption_style)
    && typeof config.max_hashtags === 'number' && Number.isInteger(config.max_hashtags)
    && config.max_hashtags >= 0 && config.max_hashtags <= 30)) throw new Error('invalid_autopilot')
  // A legacy platform preference is never consent for every account on that network.
  return { ...(value as AutopilotConfig), publish_account_ids: (config.publish_account_ids ?? []) as string[] }
}

export function readAutoVideoConfig(value: unknown): AutoVideoConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_auto_config')
  const config = value as Record<string, unknown>
  if (!validAccountIds(config.publish_account_ids ?? [])
    || !Array.isArray(config.publish_platforms) || !config.publish_platforms.every(platform => typeof platform === 'string' && Object.hasOwn(PLATFORM_INFO, platform))
    || !['default_voice_enabled', 'auto_publish', 'require_approval_before_publish'].every(key => typeof config[key] === 'boolean')
    || !['default_style', 'default_aspect_ratio', 'preferred_model', 'quality_level'].every(key => typeof config[key] === 'string')
    || typeof config.default_duration !== 'number' || !Number.isFinite(config.default_duration)) throw new Error('invalid_auto_config')
  return { ...(value as AutoVideoConfig), publish_account_ids: (config.publish_account_ids ?? []) as string[] }
}
