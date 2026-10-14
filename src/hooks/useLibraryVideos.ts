import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { PAGE_SIZE } from '@/lib/library-constants'
import type { Video } from '@/types'
import type { FilterId } from '@/types/library'

const supabase = createClient()

export function useLibraryVideos(userId: string | undefined, filter: FilterId, search: string, sort: string) {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  // Favorites are filtered locally, like folders. Switching all/favorites must
  // preserve the loaded pages and an in-flight request for the same query.
  const statusFilter = filter === 'favorites' ? 'all' : filter

  const fetchVideos = useCallback(async (offset: number, append: boolean) => {
    // State updates are asynchronous: the ref also blocks two clicks in the same frame.
    if (append && pending.current) return
    pending.current?.abort()
    if (!userId) {
      pending.current = null
      setVideos([])
      setTotalCount(0)
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setError(null)
    setLoading(!append)
    setLoadingMore(append)
    try {
      let query = supabase.from('videos').select('*', { count: 'exact' }).eq('user_id', userId)
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)
      query = query.order(sort === 'title' ? 'title' : 'created_at', { ascending: sort === 'oldest' || sort === 'title' })
      const { data, count, error: queryError } = await query.range(offset, offset + PAGE_SIZE - 1).abortSignal(controller.signal)
      if (controller.signal.aborted || pending.current !== controller) return
      if (queryError) throw queryError
      const fetched = (data as Video[]) ?? []
      setTotalCount(count ?? 0)
      setHasMore((count ?? 0) > offset + fetched.length)
      setVideos(prev => append ? [...prev, ...fetched] : fetched)
    } catch {
      if (!controller.signal.aborted && pending.current === controller) {
        setError(append ? 'Impossible de charger la suite des vidéos. Réessaie.' : 'Impossible de charger la bibliothèque. Réessaie.')
        if (!append) {
          setVideos([])
          setTotalCount(0)
          setHasMore(false)
        }
      }
    } finally {
      if (pending.current === controller) {
        pending.current = null
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [userId, statusFilter, search, sort])

  useEffect(() => {
    void fetchVideos(0, false)
    return () => { pending.current?.abort(); pending.current = null }
  }, [fetchVideos])

  const loadMore = useCallback(() => {
    if (hasMore) void fetchVideos(videos.length, true)
  }, [fetchVideos, videos.length, hasMore])

  const handleDelete = useCallback(async (videoId: string) => {
    if (!window.confirm('Supprimer cette video ? Cette action est irreversible.')) return
    try {
      const { error: deleteError } = await supabase.from('videos').delete().eq('id', videoId)
      if (deleteError) throw deleteError
    } catch {
      setError('Impossible de supprimer cette vidéo. Réessaie depuis son bouton Supprimer.')
      return
    }
    setVideos(prev => prev.filter(v => v.id !== videoId))
    setTotalCount(prev => Math.max(0, prev - 1))
    setError(null)
  }, [])

  const refetch = useCallback(() => { void fetchVideos(0, false) }, [fetchVideos])
  return { videos, loading, loadingMore, hasMore, totalCount, error, loadMore, handleDelete, refetch }
}
