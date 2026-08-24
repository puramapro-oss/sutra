import { Loader2, AlertCircle, Check } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type SocialPlatform, PLATFORM_INFO } from '@/lib/zernio'

const ALL_PLATFORMS: SocialPlatform[] = [
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

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
}

export interface PublishPlatformGridProps {
  accounts: SocialAccount[]
  selectedPlatforms: Set<SocialPlatform>
  onTogglePlatform: (platform: SocialPlatform) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  accountsLoading: boolean
  accountsError: string | null
  onRetryFetch: () => void
}

export function PublishPlatformGrid({
  accounts,
  selectedPlatforms,
  onTogglePlatform,
  onSelectAll,
  onDeselectAll,
  accountsLoading,
  accountsError,
  onRetryFetch,
}: PublishPlatformGridProps) {
  const connectedPlatforms = new Set(accounts.map((a) => a.platform))
  const allSelected = selectedPlatforms.size > 0 && selectedPlatforms.size === connectedPlatforms.size

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Plateformes</h3>
        <button
          type="button"
          data-testid="publish-toggle-all"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          {allSelected ? 'Tout deselectionner' : 'Tout selectionner'}
        </button>
      </div>

      {accountsLoading && (
        <div className="flex items-center justify-center py-8 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {accountsError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{accountsError}</p>
            <button type="button" onClick={onRetryFetch} className="mt-1 underline hover:text-red-300">
              Reessayer
            </button>
          </div>
        </div>
      )}

      {!accountsLoading && !accountsError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_PLATFORMS.map((platform) => {
            const info = PLATFORM_INFO[platform]
            const account = accounts.find((a) => a.platform === platform)
            const connected = !!account
            const selected = selectedPlatforms.has(platform)
            return (
              <button
                key={platform}
                type="button"
                data-testid={`publish-platform-${platform}`}
                onClick={() => onTogglePlatform(platform)}
                disabled={!connected}
                className={cn(
                  'relative flex flex-col items-start gap-1 p-3 rounded-xl border transition-all duration-200 text-left',
                  connected
                    ? selected
                      ? 'bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                    : 'bg-white/[0.01] border-white/[0.04] opacity-40 cursor-not-allowed'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg leading-none">{info.icon}</span>
                  {connected && selected && (
                    <div className="h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="w-full min-w-0">
                  <p className="text-xs font-medium text-white/90 truncate">{info.label}</p>
                  {connected ? (
                    <p className="text-[10px] text-white/40 truncate">@{account?.username}</p>
                  ) : (
                    <Link
                      href="/settings/social"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-violet-400/80 hover:text-violet-300 underline pointer-events-auto"
                    >
                      Connecter
                    </Link>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
