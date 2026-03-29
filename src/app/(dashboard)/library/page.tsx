'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Film,
  SlidersHorizontal,
  ArrowUpDown,
  Plus,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { VideoCard } from '@/components/dashboard/VideoCard'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Video, VideoStatus } from '@/types'

const supabase = createClient()

const PAGE_SIZE = 12

const FILTER_TABS: { id: string; label: string; filter: VideoStatus | 'all' }[] = [
  { id: 'all', label: 'Toutes', filter: 'all' },
  { id: 'draft', label: 'Brouillons', filter: 'draft' },
  { id: 'ready', label: 'Pretes', filter: 'ready' },
  { id: 'published', label: 'Publiees', filter: 'published' },
]

const SORT_OPTIONS = [
  { id: 'recent', label: 'Plus recentes' },
  { id: 'oldest', label: 'Plus anciennes' },
  { id: 'title', label: 'Titre A-Z' },
]

export default function LibraryPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const [filter, setFilter] = useState<VideoStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const fetchVideos = useCallback(
    async (userId: string, offset: number, append: boolean) => {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      try {
        let query = supabase
          .from('videos')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)

        if (filter !== 'all') {
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

  const handleDelete = useCallback(
    async (videoId: string) => {
      const confirmed = window.confirm('Supprimer cette video ? Cette action est irreversible.')
      if (!confirmed) return

      const { error } = await supabase.from('videos').delete().eq('id', videoId)
      if (!error) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId))
        setTotalCount((prev) => prev - 1)
      }
    },
    []
  )

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

  const activeSort = SORT_OPTIONS.find((s) => s.id === sort)

  if (authLoading || loading) {
    return <LibrarySkeleton />
  }

  return (
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
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`filter-${tab.id}`}
              onClick={() => setFilter(tab.filter)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                filter === tab.filter
                  ? 'bg-violet-600/80 text-white'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
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
      </div>

      {/* Video grid */}
      {videos.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
              >
                <VideoCard video={video} onDelete={handleDelete} />
              </motion.div>
            ))}
          </div>

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
            search || filter !== 'all'
              ? 'Aucune video ne correspond a tes filtres. Essaie de modifier ta recherche.'
              : "Tu n'as pas encore de video. Cree ta premiere !"
          }
          action={
            search || filter !== 'all'
              ? {
                  label: 'Reinitialiser les filtres',
                  onClick: () => {
                    setSearch('')
                    setFilter('all')
                    setSort('recent')
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
        <Skeleton width={160} height={40} rounded="xl" />
      </div>

      <div className="flex items-center gap-3">
        <Skeleton width={240} height={40} rounded="xl" />
        <Skeleton width={280} height={40} rounded="xl" />
        <Skeleton width={100} height={40} rounded="xl" />
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
