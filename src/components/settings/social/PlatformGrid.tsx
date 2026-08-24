import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
  display_name: string
  avatar_url: string | null
  status: string
  connected_at: string
}

const PLATFORMS_ORDER: SocialPlatform[] = [
  'tiktok',
  'youtube',
  'instagram',
  'facebook',
  'x',
  'linkedin',
  'pinterest',
  'reddit',
  'threads',
  'snapchat',
  'tumblr',
  'mastodon',
  'bluesky',
  'vimeo',
]

export interface PlatformGridProps {
  loading: boolean
  accountsByPlatform: Partial<Record<SocialPlatform, SocialAccount>>
  connecting: SocialPlatform | null
  disconnectingId: string | null
  onConnect: (platform: SocialPlatform) => void
  onDisconnectClick: (account: SocialAccount) => void
}

export function PlatformGrid({
  loading,
  accountsByPlatform,
  connecting,
  disconnectingId,
  onConnect,
  onDisconnectClick,
}: PlatformGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {PLATFORMS_ORDER.map((platform, i) => {
        const info = PLATFORM_INFO[platform]
        const account = accountsByPlatform[platform]
        const isConnected = !!account
        const isConnecting = connecting === platform
        const isDisconnecting = account && disconnectingId === account.id

        return (
          <motion.div
            key={platform}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.35 }}
            className={cn(
              'relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex flex-col',
              'hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300'
            )}
            style={{ boxShadow: isConnected ? `0 0 0 1px ${info.color}40` : undefined }}
            data-testid={`platform-card-${platform}`}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: info.color }}
              aria-hidden
            />

            <div className="flex items-start justify-between mb-3">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-lg',
                  info.bgColor
                )}
              >
                <span aria-hidden>{info.icon}</span>
              </div>
              {isConnected && (
                <Badge variant="success" className="gap-1">
                  <Check className="w-3 h-3" />
                  Connecte
                </Badge>
              )}
            </div>

            <h3 className="text-base font-semibold text-white mb-1">{info.label}</h3>
            <p className="text-xs text-white/50 line-clamp-2 mb-4 flex-1">{info.description}</p>

            {isConnected && account ? (
              <div className="space-y-2">
                <div className="text-xs text-white/70 truncate">
                  @{account.username || account.display_name || 'compte'}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  loading={!!isDisconnecting}
                  onClick={() => onDisconnectClick(account)}
                  data-testid={`disconnect-${platform}`}
                >
                  <X className="w-3 h-3" />
                  Deconnecter
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                loading={isConnecting}
                onClick={() => onConnect(platform)}
                data-testid={`connect-${platform}`}
              >
                Se connecter
              </Button>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
