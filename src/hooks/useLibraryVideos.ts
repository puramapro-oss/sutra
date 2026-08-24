import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { PAGE_SIZE } from '@/lib/library-constants'
import type { Video } from '@/types'
import type { FilterId } from '@/types/library'

const supabase = createClient()

export function useLibraryVideos(
  userId: string | undefined,
  filter: FilterId,
  search: string,
  sort: string
) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const fetchVideos = useCallback(
    async (offset: number, append: boolean) => {
      if (!userId) return

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
    [userId, filter, search, sort]
  )

  useEffect(() => {
    fetchVideos(0, false)
  }, [fetchVideos])

  const loadMore = useCallback(() => {
    if (!loadingMore) {
      fetchVideos(videos.length, true)
    }
  }, [fetchVideos, videos.length, loadingMore])

  const handleDelete = useCallback(async (videoId: string) => {
    const confirmed = window.confirm('Supprimer cette video ? Cette action est irreversible.')
    if (!confirmed) return

    const { error } = await supabase.from('videos').delete().eq('id', videoId)
    if (!error) {
      setVideos((prev) => prev.filter((v) => v.id !== videoId))
      setTotalCount((prev) => prev - 1)
    }
  }, [])

  const refetch = useCallback(() => {
    fetchVideos(0, false)
  }, [fetchVideos])

  return {
    videos,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    handleDelete,
    refetch,
  }
}
