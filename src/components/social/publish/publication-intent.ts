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
  videoId: string
  destinations: PublicationIntent['destinations']
  accounts: SocialAccount[]
  /** Only a current-session legacy confirmation retains an intent for retry. */
  payload?: PublicationIntent
  /** Undefined means the admission response was lost, not a legacy confirmation. */
  durable?: boolean
  hasPending?: boolean
}
