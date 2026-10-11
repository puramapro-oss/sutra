import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type SocialPlatform, type PublicationStatus, PLATFORM_INFO, PUBLICATION_STATUS_LABELS } from '@/lib/zernio'

export interface PublishResultUI {
  platform: SocialPlatform
  success: boolean
  status?: PublicationStatus
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
          const status = r.status ?? (r.success ? 'published' : 'unknown')
          return (
            <div
              key={r.platform}
              data-testid={`publish-result-${r.platform}`}
              className={cn(
                'flex items-center justify-between p-2.5 rounded-lg border text-xs',
                status === 'published' ? 'bg-emerald-500/10 border-emerald-500/20' : status === 'failed' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'
              )}
            >
              <div className="flex items-center gap-2">
                <span>{info.icon}</span>
                <span className="font-medium text-white/90">{info.label}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px]">{PUBLICATION_STATUS_LABELS[status]}</span>
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
