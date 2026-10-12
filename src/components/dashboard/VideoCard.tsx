'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { motion } from 'framer-motion'
import {
  Play,
  Clock,
  Calendar,
  Pencil,
  Trash2,
  Share2,
  MoreVertical,
  Film,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { Video, VideoStatus } from '@/types'

interface VideoCardProps {
  video: Video
  onDelete?: (id: string) => void
  className?: string
  'data-testid'?: string
}

const statusConfig: Record<
  VideoStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }
> = {
  draft: { label: 'Brouillon', variant: 'default' },
  generating: { label: 'En cours', variant: 'warning' },
  ready: { label: 'Prete', variant: 'success' },
  published: { label: 'Publiee', variant: 'info' },
  failed: { label: 'Erreur', variant: 'error' },
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoCard({
  video,
  onDelete,
  className,
  'data-testid': testId,
}: VideoCardProps) {
  const router = useRouter()
  const [showActions, setShowActions] = useState(false)
  const status = statusConfig[video.status] ?? statusConfig.draft


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      data-testid={testId ?? `video-card-${video.id}`}
      className={cn(
        'group relative overflow-hidden rounded-2xl',
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]',
        'hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5',
        'transition-all duration-300',
        className
      )}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full overflow-hidden bg-white/[0.02]">
        {(video.status === 'draft' || video.status === 'ready' || video.status === 'published') && (
          <Link href={video.status === 'draft' ? `/create?draft=${video.id}` : `/library/${video.id}`} aria-label={`Ouvrir : ${video.title ?? 'Vidéo sans titre'}`} className="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400" />
        )}
        {video.thumbnail_url ? (
          <img loading="lazy" decoding="async"
            src={video.thumbnail_url}
            alt={video.title ?? 'Video'}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/30 to-purple-900/20">
            <Film className="h-10 w-10 text-violet-500/40" />
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-violet-600/90 flex items-center justify-center backdrop-blur-sm">
            <Play className="h-5 w-5 text-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-medium text-white/90 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Quality badge */}
        <div className="absolute top-2 left-2">
          <Badge size="sm" variant="premium">
            {video.quality}
          </Badge>
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <Badge size="sm" variant={status.variant}>
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Info area */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white/90 truncate mb-1">
          {video.status === 'draft' || video.status === 'ready' || video.status === 'published' ? (
            <Link href={video.status === 'draft' ? `/create?draft=${video.id}` : `/library/${video.id}`} className="hover:underline">{video.title ?? 'Video sans titre'}</Link>
          ) : (video.title ?? 'Video sans titre')}
        </h3>
        <div className="flex items-center gap-2 text-xs text-white/65">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{formatRelativeDate(video.created_at)}</span>
          {video.format && (
            <>
              <span className="text-white/65">|</span>
              <span>{video.format}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions menu */}
      <div className="flex justify-end px-4 pb-3">
        <button
          data-testid={`video-actions-${video.id}`}
          aria-label={`Actions : ${video.title ?? 'Vidéo sans titre'}`}
          aria-haspopup="dialog"
          aria-expanded={showActions}
          onClick={(e) => {
            e.stopPropagation()
            setShowActions((prev) => !prev)
          }}
          className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/80 transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        <Modal open={showActions} onClose={() => setShowActions(false)} title="Actions de la vidéo">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/create?draft=${video.id}`)
                setShowActions(false)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                try {
                if (video.video_url) {
                  await navigator.clipboard.writeText(video.video_url)
                } else {
                  await navigator.clipboard.writeText(`${window.location.origin}/library/${video.id}`)
                }
                setShowActions(false)
                import('sonner').then(({ toast }) => toast.success('Lien copie'))
                } catch {
                  import('sonner').then(({ toast }) => toast.error('Impossible de copier le lien. Réessaie.'))
                }
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
            {onDelete && (
              <button
                data-testid={`video-delete-${video.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(video.id)
                  setShowActions(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            )}
        </Modal>
      </div>
    </motion.div>
  )
}

export default VideoCard
