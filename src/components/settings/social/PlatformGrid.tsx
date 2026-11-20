import { motion } from 'framer-motion'
import { Check, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { OAUTH_PLATFORMS, PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'
import { accountLabel, isAccountAvailable, type SocialAccount } from './accounts'

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
  accountsByPlatform: Partial<Record<SocialPlatform, SocialAccount | SocialAccount[]>>
  connecting: SocialPlatform | null
  connectingAccountId?: string | null
  disconnectingId: string | null
  onConnect: (platform: SocialPlatform, accountId?: string) => void
  onDisconnectClick: (account: SocialAccount) => void
}

export function PlatformGrid({
  loading,
  accountsByPlatform,
  connecting,
  connectingAccountId = null,
  disconnectingId,
  onConnect,
  onDisconnectClick,
}: PlatformGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {PLATFORMS_ORDER.map((platform, i) => {
        const info = PLATFORM_INFO[platform]
        const entry = accountsByPlatform[platform]
        const accounts = Array.isArray(entry) ? entry : entry ? [entry] : []
        const connectedCount = accounts.filter(account => isAccountAvailable(account)).length
        const isConnected = connectedCount > 0
        const isConnecting = connecting === platform
        const canConnect = (OAUTH_PLATFORMS as readonly string[]).includes(platform)
        const busy = connecting !== null || disconnectingId !== null

        return (
          <motion.div
            key={platform}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.35 }}
            className={cn(
              'relative min-w-0 overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex flex-col',
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

            <div className="flex flex-wrap gap-2 items-start justify-between mb-3">
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
                  {connectedCount} connecté{connectedCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <h3 className="text-base font-semibold text-white mb-1">{info.label}</h3>
            <p className="text-xs text-white/70 line-clamp-2 mb-4 flex-1">{info.description}</p>

            <div className="space-y-3 mb-3">
              {accounts.map(account => {
                const available = isAccountAvailable(account)
                return <div key={account.id} data-testid={`social-account-${account.id}`} className="space-y-2 rounded-xl border border-white/[0.08] p-3">
                  <p className="break-words text-xs font-medium text-white/90">{accountLabel(account)}</p>
                  <p className={cn('text-xs', available ? 'text-emerald-300' : 'text-amber-200')}>
                    {available ? 'Connecté' : account.status === 'revoked' ? 'Déconnecté' : 'Connexion à renouveler'}
                  </p>
                  <Button variant="secondary" size="sm" className="w-full whitespace-normal h-auto min-h-9"
                    disabled={busy || !canConnect}
                    loading={isConnecting && connectingAccountId === account.id}
                    aria-label={`Reconnecter ${info.label} : ${accountLabel(account)}`}
                    onClick={() => onConnect(platform, account.id)} data-testid={`reconnect-${account.id}`}>
                    Reconnecter ce compte
                  </Button>
                  {account.status !== 'revoked' && <Button variant="ghost" size="sm" className="w-full whitespace-normal h-auto min-h-9"
                    disabled={busy} loading={disconnectingId === account.id}
                    aria-label={`Déconnecter ${info.label} : ${accountLabel(account)}`}
                    onClick={() => onDisconnectClick(account)} data-testid={`disconnect-${account.id}`}>
                    <X className="w-3 h-3" aria-hidden /> Déconnecter
                  </Button>}
                </div>
              })}
            </div>
            <Button variant="primary" size="sm" className="w-full whitespace-normal h-auto min-h-9 mt-auto"
              loading={isConnecting && connectingAccountId === null} disabled={!canConnect || busy}
              onClick={() => onConnect(platform)} data-testid={`connect-${platform}`}>
              {canConnect && <Plus className="w-3 h-3 shrink-0" aria-hidden />}
              {canConnect ? accounts.length ? 'Ajouter un autre compte' : 'Connecter un compte' : 'Connexion indisponible'}
            </Button>
          </motion.div>
        )
      })}
    </div>
  )
}
