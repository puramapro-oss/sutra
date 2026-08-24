import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Film,
  Play,
  Calendar,
  Clock,
  Share2,
  RefreshCw,
  Heart,
  Trash2,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { formatDuration } from '@/lib/library-helpers'
import { Badge } from '@/components/ui/Badge'
import { PublishEverywhereButton } from '@/components/social/PublishEverywhereButton'
import { statusConfig } from '@/types/library'
import type { Video } from '@/types'

interface VideoListProps {
  videos: Video[]
  favorites: Set<string>
  onDelete: (videoId: string) => void
  onShare: (videoId: string) => void
  onRegenerate: (video: Video) => void
  onToggleFavorite: (videoId: string) => void
}

export default function VideoList({
  videos,
  favorites,
  onDelete,
  onShare,
  onRegenerate,
  onToggleFavorite,
}: VideoListProps) {
  const router = useRouter()

  return (
    <div className="space-y-2">
      {videos.map((video, index) => {
        const status = statusConfig[video.status] ?? statusConfig.draft
        return (
          <motion.div
            key={video.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.4) }}
            data-testid={`video-list-${video.id}`}
            onClick={() => {
              if (video.status === 'ready' || video.status === 'published') {
                router.push(`/library/${video.id}`)
              } else if (video.status === 'draft') {
                router.push(`/create?draft=${video.id}`)
              }
            }}
            className={cn(
              'group flex items-center gap-4 p-3 rounded-xl cursor-pointer',
              'bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]',
              'hover:border-violet-500/20 hover:bg-white/[0.04] transition-all duration-200'
            )}
          >
            {/* Thumbnail */}
            <div className="relative w-24 sm:w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-white/[0.02]">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title ?? 'Video'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/30 to-purple-900/20">
                  <Film className="h-6 w-6 text-violet-500/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white/90 truncate">
                {video.title ?? 'Video sans titre'}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/40 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatRelativeDate(video.created_at)}
                </span>
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(video.duration)}
                  </span>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              {video.format && (
                <Badge size="sm" variant="default">
                  {video.format}
                </Badge>
              )}
              <Badge size="sm" variant="premium">
                {video.quality}
              </Badge>
              <Badge size="sm" variant={status.variant}>
                {status.label}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                data-testid={`list-share-${video.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onShare(video.id)
                }}
                className="p-1.5 rounded-lg text-white/30 hover:text-violet-400 transition-colors"
                aria-label="Partager"
              >
                <Share2 className="h-4 w-4" />
              </button>

              {video.status === 'ready' && video.video_url && (
                <PublishEverywhereButton
                  videoId={video.id}
                  videoTitle={video.title ?? 'Video sans titre'}
                  videoUrl={video.video_url}
                  variant="compact"
                />
              )}

              {video.script_data && (
                <button
                  data-testid={`list-regenerate-${video.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRegenerate(video)
                  }}
                  className="p-1.5 rounded-lg text-white/30 hover:text-violet-400 transition-colors"
                  aria-label="Regenerer"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}

              <button
                data-testid={`list-favorite-${video.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(video.id)
                }}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  favorites.has(video.id)
                    ? 'text-red-400'
                    : 'text-white/30 hover:text-red-400'
                )}
                aria-label="Favori"
              >
                <Heart
                  className={cn(
                    'h-4 w-4',
                    favorites.has(video.id) && 'fill-current'
                  )}
                />
              </button>

              <button
                data-testid={`list-delete-${video.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(video.id)
                }}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
