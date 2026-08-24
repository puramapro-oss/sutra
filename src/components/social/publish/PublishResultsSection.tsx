import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type SocialPlatform, PLATFORM_INFO } from '@/lib/zernio'

export interface PublishResultUI {
  platform: SocialPlatform
  success: boolean
  postUrl?: string
  error?: string
}

export interface PublishResultsSectionProps {
  results: PublishResultUI[] | null
}

export function PublishResultsSection({ results }: PublishResultsSectionProps) {
  if (!results) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white/90">Resultats</h3>
      <div className="space-y-1.5">
        {results.map((r) => {
          const info = PLATFORM_INFO[r.platform]
          return (
            <div
              key={r.platform}
              data-testid={`publish-result-${r.platform}`}
              className={cn(
                'flex items-center justify-between p-2.5 rounded-lg border text-xs',
                r.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
              )}
            >
              <div className="flex items-center gap-2">
                <span>{info.icon}</span>
                <span className="font-medium text-white/90">{info.label}</span>
                {r.success ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                    Publie
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px]">
                    Echec
                  </span>
                )}
              </div>
              {r.postUrl && (
                <a
                  href={r.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                >
                  Voir
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {r.error && !r.success && (
                <span className="text-red-400/80 truncate max-w-[180px]">{r.error}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
