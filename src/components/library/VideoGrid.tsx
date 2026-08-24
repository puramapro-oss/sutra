import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  FolderPlus,
  Heart,
  RefreshCw,
  Folder,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { VideoCard } from '@/components/dashboard/VideoCard'
import { PublishEverywhereButton } from '@/components/social/PublishEverywhereButton'
import type { Video } from '@/types'
import type { FolderData } from '@/types/library'

interface VideoGridProps {
  videos: Video[]
  favorites: Set<string>
  folders: FolderData[]
  onDelete: (videoId: string) => void
  onShare: (videoId: string) => void
  onRegenerate: (video: Video) => void
  onToggleFavorite: (videoId: string) => void
  onAddToFolder: (folderId: string, videoId: string) => void
}

export default function VideoGrid({
  videos,
  favorites,
  folders,
  onDelete,
  onShare,
  onRegenerate,
  onToggleFavorite,
  onAddToFolder,
}: VideoGridProps) {
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.05, 0.5) }}
          className="relative"
        >
          <VideoCard video={video} onDelete={onDelete} />

          {/* Action buttons overlay */}
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1">
            {/* Share */}
            <button
              data-testid={`share-${video.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onShare(video.id)
              }}
              className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/50 hover:text-violet-400 transition-colors"
              aria-label="Partager"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>

            {/* Publish everywhere — only ready videos */}
            {video.status === 'ready' && video.video_url && (
              <PublishEverywhereButton
                videoId={video.id}
                videoTitle={video.title ?? 'Video sans titre'}
                videoUrl={video.video_url}
                variant="compact"
              />
            )}

            {/* Add to folder */}
            {folders.length > 0 && (
              <div className="relative">
                <button
                  data-testid={`add-folder-${video.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenFolderMenu((prev) =>
                      prev === video.id ? null : video.id
                    )
                  }}
                  className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/50 hover:text-violet-400 transition-colors"
                  aria-label="Ajouter au dossier"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>

                <AnimatePresence>
                  {openFolderMenu === video.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      className="absolute bottom-full right-0 mb-1 w-44 rounded-xl bg-[#0c0b14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl z-40 overflow-hidden"
                    >
                      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/30 border-b border-white/[0.06]">
                        Ajouter au dossier
                      </div>
                      {folders.map((folder) => {
                        const alreadyIn = folder.videoIds.includes(video.id)
                        return (
                          <button
                            key={folder.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!alreadyIn) {
                                onAddToFolder(folder.id, video.id)
                                setOpenFolderMenu(null)
                              }
                            }}
                            disabled={alreadyIn}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                              alreadyIn
                                ? 'text-white/20 cursor-default'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            )}
                          >
                            <Folder className="h-3.5 w-3.5" />
                            {folder.name}
                            {alreadyIn && (
                              <span className="ml-auto text-[10px] text-white/20">
                                deja
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Regenerate */}
            {video.script_data && (
              <button
                data-testid={`regenerate-${video.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onRegenerate(video)
                }}
                className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/50 hover:text-violet-400 transition-colors"
                aria-label="Regenerer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Favorite */}
            <button
              data-testid={`favorite-${video.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(video.id)
              }}
              className={cn(
                'p-1.5 rounded-lg backdrop-blur-sm transition-all duration-200',
                favorites.has(video.id)
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-black/40 text-white/50 hover:text-red-400'
              )}
              aria-label={favorites.has(video.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              <Heart
                className={cn(
                  'h-3.5 w-3.5 transition-all',
                  favorites.has(video.id) && 'fill-current'
                )}
              />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
