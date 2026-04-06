'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Film,
  ArrowUpDown,
  Plus,
  Heart,
  FolderPlus,
  Folder,
  Share2,
  RefreshCw,
  LayoutGrid,
  LayoutList,
  Clock,
  Calendar,
  X,
  ChevronRight,
  MoreVertical,
  Trash2,
  Pencil,
  Play,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { cn, copyToClipboard, formatRelativeDate } from '@/lib/utils'
import { VideoCard } from '@/components/dashboard/VideoCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { PublishEverywhereButton } from '@/components/social/PublishEverywhereButton'
import type { Video, VideoStatus } from '@/types'

const supabase = createClient()

const PAGE_SIZE = 12

type FilterId = VideoStatus | 'all' | 'favorites'

const FILTER_TABS: { id: string; label: string; filter: FilterId }[] = [
  { id: 'all', label: 'Toutes', filter: 'all' },
  { id: 'favorites', label: 'Favoris', filter: 'favorites' },
  { id: 'draft', label: 'Brouillons', filter: 'draft' },
  { id: 'ready', label: 'Pretes', filter: 'ready' },
  { id: 'published', label: 'Publiees', filter: 'published' },
]

const SORT_OPTIONS = [
  { id: 'recent', label: 'Plus recentes' },
  { id: 'oldest', label: 'Plus anciennes' },
  { id: 'title', label: 'Titre A-Z' },
]

// ─── localStorage helpers ───
interface FolderData {
  id: string
  name: string
  videoIds: string[]
}

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem('sutra_favorites')
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem('sutra_favorites', JSON.stringify([...favs]))
}

function loadFolders(): FolderData[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('sutra_folders')
    return raw ? (JSON.parse(raw) as FolderData[]) : []
  } catch {
    return []
  }
}

function saveFolders(folders: FolderData[]) {
  localStorage.setItem('sutra_folders', JSON.stringify(folders))
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Duration formatter ───
function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
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

// ─── View modes ───
type ViewMode = 'grid' | 'list'

export default function LibraryPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())

  // Folders
  const [folders, setFolders] = useState<FolderData[]>(() => loadFolders())
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Card-level folder dropdown
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null)

  // ─── Favorites toggling ───
  const toggleFavorite = useCallback((videoId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      saveFavorites(next)
      return next
    })
  }, [])

  // ─── Folder management ───
  const createFolder = useCallback(() => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const folder: FolderData = { id: generateId(), name: trimmed, videoIds: [] }
    setFolders((prev) => {
      const next = [...prev, folder]
      saveFolders(next)
      return next
    })
    setNewFolderName('')
    setShowFolderModal(false)
  }, [newFolderName])

  const deleteFolder = useCallback((folderId: string) => {
    setFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId)
      saveFolders(next)
      return next
    })
    setActiveFolder((prev) => (prev === folderId ? null : prev))
  }, [])

  const addVideoToFolder = useCallback((folderId: string, videoId: string) => {
    setFolders((prev) => {
      const next = prev.map((f) => {
        if (f.id === folderId && !f.videoIds.includes(videoId)) {
          return { ...f, videoIds: [...f.videoIds, videoId] }
        }
        return f
      })
      saveFolders(next)
      return next
    })
    setOpenFolderMenu(null)
    import('sonner').then(({ toast }) => toast.success('Ajoutee au dossier'))
  }, [])

  // ─── Share link ───
  const handleShare = useCallback(async (videoId: string) => {
    const link = `https://sutra.purama.dev/v/${videoId}`
    await copyToClipboard(link)
    import('sonner').then(({ toast }) => toast.success('Lien copie !'))
  }, [])

  // ─── Regenerate ───
  const handleRegenerate = useCallback(
    (video: Video) => {
      const params = new URLSearchParams()
      if (video.script_data?.title) params.set('topic', video.script_data.title)
      if (video.format) params.set('format', video.format)
      if (video.quality) params.set('quality', video.quality)
      router.push(`/create?${params.toString()}`)
    },
    [router]
  )

  // ─── Fetch videos ───
  const fetchVideos = useCallback(
    async (userId: string, offset: number, append: boolean) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      try {
        let query = supabase
          .from('videos')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)

        // For "favorites" filter we still fetch all and filter client-side
        if (filter !== 'all' && filter !== 'favorites') {
          query = query.eq('status', filter)
        }

        if (search.trim()) {
          query = query.ilike('title', `%${search.trim()}%`)
        }

        switch (sort) {
          case 'oldest':
            query = query.order('created_at', { ascending: true })
            break
          case 'title':
            query = query.order('title', { ascending: true })
            break
          default:
            query = query.order('created_at', { ascending: false })
        }

        query = query.range(offset, offset + PAGE_SIZE - 1)

        const { data, count } = await query

        const fetched = (data as Video[]) ?? []
        setTotalCount(count ?? 0)
        setHasMore((count ?? 0) > offset + fetched.length)

        if (append) {
          setVideos((prev) => [...prev, ...fetched])
        } else {
          setVideos(fetched)
        }
      } catch {
        if (!append) setVideos([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter, search, sort]
  )

  useEffect(() => {
    if (profile?.id) {
      fetchVideos(profile.id, 0, false)
    }
  }, [profile?.id, fetchVideos])

  const handleLoadMore = () => {
    if (profile?.id && !loadingMore) {
      fetchVideos(profile.id, videos.length, true)
    }
  }

  const handleDelete = useCallback(async (videoId: string) => {
    const confirmed = window.confirm('Supprimer cette video ? Cette action est irreversible.')
    if (!confirmed) return

    const { error } = await supabase.from('videos').delete().eq('id', videoId)
    if (!error) {
      setVideos((prev) => prev.filter((v) => v.id !== videoId))
      setTotalCount((prev) => prev - 1)
    }
  }, [])

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (profile?.id && !authLoading) {
      fetchVideos(profile.id, 0, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filter, sort])

  // ─── Filtered videos (favorites + folder) ───
  const displayedVideos = useMemo(() => {
    let result = videos

    if (filter === 'favorites') {
      result = result.filter((v) => favorites.has(v.id))
    }

    if (activeFolder) {
      const folder = folders.find((f) => f.id === activeFolder)
      if (folder) {
        const idSet = new Set(folder.videoIds)
        result = result.filter((v) => idSet.has(v.id))
      }
    }

    return result
  }, [videos, filter, favorites, activeFolder, folders])

  const activeSort = SORT_OPTIONS.find((s) => s.id === sort)

  // Focus folder input on modal open
  useEffect(() => {
    if (showFolderModal) {
      setTimeout(() => folderInputRef.current?.focus(), 50)
    }
  }, [showFolderModal])

  if (authLoading) {
    return <LibrarySkeleton />
  }

  return (
    <LoadingTimeout
      loading={loading}
      onRetry={() => profile?.id && fetchVideos(profile.id, 0, false)}
      skeleton={<LibrarySkeleton />}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]">
              Ma bibliotheque
            </h1>
            <p className="text-sm text-white/50 mt-0.5">
              {totalCount} video{totalCount !== 1 ? 's' : ''} au total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="library-new-folder-btn"
              variant="secondary"
              size="md"
              onClick={() => setShowFolderModal(true)}
            >
              <FolderPlus className="h-4 w-4" />
              Nouveau dossier
            </Button>
            <Button
              data-testid="library-create-btn"
              variant="primary"
              size="md"
              onClick={() => router.push('/create')}
            >
              <Plus className="h-4 w-4" />
              Nouvelle video
            </Button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              data-testid="library-search"
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/30',
                'bg-white/[0.03] backdrop-blur-xl',
                'border border-white/[0.06] hover:border-white/[0.12]',
                'focus:border-violet-500/60 outline-none transition-all duration-200'
              )}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                data-testid={`filter-${tab.id}`}
                onClick={() => setFilter(tab.filter)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5',
                  filter === tab.filter
                    ? 'bg-violet-600/80 text-white'
                    : 'text-white/40 hover:text-white/60'
                )}
              >
                {tab.id === 'favorites' && <Heart className="h-3 w-3" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              data-testid="sort-toggle"
              onClick={() => setShowSortMenu((prev) => !prev)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium',
                'bg-white/[0.03] border border-white/[0.06] text-white/50',
                'hover:border-white/[0.12] hover:text-white/70 transition-all duration-200'
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {activeSort?.label ?? 'Trier'}
            </button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#0c0b14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl z-30 overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      data-testid={`sort-${opt.id}`}
                      onClick={() => {
                        setSort(opt.id)
                        setShowSortMenu(false)
                      }}
                      className={cn(
                        'w-full text-left px-4 py-2.5 text-sm transition-colors',
                        sort === opt.id
                          ? 'text-violet-400 bg-violet-500/5'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <button
              data-testid="view-grid"
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                viewMode === 'grid'
                  ? 'bg-violet-600/80 text-white'
                  : 'text-white/40 hover:text-white/60'
              )}
              aria-label="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              data-testid="view-list"
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                viewMode === 'list'
                  ? 'bg-violet-600/80 text-white'
                  : 'text-white/40 hover:text-white/60'
              )}
              aria-label="Vue liste"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Folder pills */}
        {folders.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Folder className="h-4 w-4 text-white/30 shrink-0" />
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center gap-0">
                <button
                  data-testid={`folder-${folder.id}`}
                  onClick={() =>
                    setActiveFolder((prev) => (prev === folder.id ? null : folder.id))
                  }
                  className={cn(
                    'px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all duration-200 border',
                    activeFolder === folder.id
                      ? 'bg-violet-600/80 text-white border-violet-500/40'
                      : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/70 hover:border-white/[0.12]'
                  )}
                >
                  {folder.name}
                  <span className="ml-1.5 text-white/30">{folder.videoIds.length}</span>
                </button>
                <button
                  data-testid={`folder-delete-${folder.id}`}
                  onClick={() => deleteFolder(folder.id)}
                  className={cn(
                    'px-1.5 py-1.5 rounded-r-lg text-xs transition-all duration-200 border border-l-0',
                    activeFolder === folder.id
                      ? 'bg-violet-600/60 text-white/70 border-violet-500/40 hover:text-red-300'
                      : 'bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-red-400'
                  )}
                  aria-label={`Supprimer dossier ${folder.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {activeFolder && (
              <button
                onClick={() => setActiveFolder(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Tout afficher
              </button>
            )}
          </div>
        )}

        {/* Video grid / list */}
        {displayedVideos.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedVideos.map((video, index) => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    className="relative"
                  >
                    <VideoCard video={video} onDelete={handleDelete} />

                    {/* Overlay actions: favorite + share + folder + regenerate */}
                    <div className="absolute top-14 left-2 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 pointer-events-none [.group:hover_&]:pointer-events-auto">
                      {/* We use a wrapper that triggers on parent hover */}
                    </div>

                    {/* Favorite button — always visible bottom-right of card info */}
                    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1">
                      {/* Share */}
                      <button
                        data-testid={`share-${video.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShare(video.id)
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
                                          addVideoToFolder(folder.id, video.id)
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
                            handleRegenerate(video)
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
                          toggleFavorite(video.id)
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
            ) : (
              /* List view */
              <div className="space-y-2">
                {displayedVideos.map((video, index) => {
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
                            handleShare(video.id)
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
                              handleRegenerate(video)
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
                            toggleFavorite(video.id)
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
                            handleDelete(video.id)
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
            )}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  data-testid="load-more"
                  variant="secondary"
                  size="md"
                  loading={loadingMore}
                  onClick={handleLoadMore}
                >
                  {loadingMore ? 'Chargement...' : 'Charger plus'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Film}
            title="Aucune video trouvee"
            description={
              search || filter !== 'all' || activeFolder
                ? 'Aucune video ne correspond a tes filtres. Essaie de modifier ta recherche.'
                : "Tu n'as pas encore de video. Cree ta premiere !"
            }
            action={
              search || filter !== 'all' || activeFolder
                ? {
                    label: 'Reinitialiser les filtres',
                    onClick: () => {
                      setSearch('')
                      setFilter('all')
                      setSort('recent')
                      setActiveFolder(null)
                    },
                    variant: 'secondary',
                  }
                : {
                    label: 'Creer ma premiere video',
                    onClick: () => router.push('/create'),
                  }
            }
            data-testid="empty-library"
          />
        )}
      </motion.div>

      {/* Folder creation modal */}
      <AnimatePresence>
        {showFolderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFolderModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 rounded-2xl bg-[#0c0b14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl p-6"
              data-testid="folder-modal"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Nouveau dossier</h2>
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <input
                ref={folderInputRef}
                data-testid="folder-name-input"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createFolder()
                }}
                placeholder="Nom du dossier"
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/30',
                  'bg-white/[0.03] backdrop-blur-xl',
                  'border border-white/[0.06] hover:border-white/[0.12]',
                  'focus:border-violet-500/60 outline-none transition-all duration-200'
                )}
              />

              <div className="flex items-center gap-3 mt-5">
                <Button
                  data-testid="folder-cancel"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowFolderModal(false)
                    setNewFolderName('')
                  }}
                >
                  Annuler
                </Button>
                <Button
                  data-testid="folder-create"
                  variant="primary"
                  size="md"
                  disabled={!newFolderName.trim()}
                  onClick={createFolder}
                >
                  <FolderPlus className="h-4 w-4" />
                  Creer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LoadingTimeout>
  )
}

function LibrarySkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton width={240} height={32} rounded="lg" />
          <Skeleton width={120} height={16} rounded="md" className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width={140} height={40} rounded="xl" />
          <Skeleton width={160} height={40} rounded="xl" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Skeleton width={240} height={40} rounded="xl" />
        <Skeleton width={340} height={40} rounded="xl" />
        <Skeleton width={100} height={40} rounded="xl" />
        <Skeleton width={80} height={40} rounded="xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
          >
            <Skeleton height={180} rounded="sm" />
            <div className="p-4 space-y-2">
              <Skeleton width="75%" height={16} rounded="md" />
              <Skeleton width="45%" height={12} rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
