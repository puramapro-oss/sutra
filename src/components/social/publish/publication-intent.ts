import type { SocialPlatform } from '@/lib/zernio'
import type { SocialAccount } from '@/components/settings/social/accounts'

export interface PublicationIntent {
  videoId: string
  platforms: SocialPlatform[]
  destinations: Array<{ platform: SocialPlatform; accountId: string }>
  autoCaption: boolean
  caption?: string
  hashtags?: string[]
  scheduledAt?: string
}

export interface PublicationSnapshot {
  payload: PublicationIntent
  accounts: SocialAccount[]
}
