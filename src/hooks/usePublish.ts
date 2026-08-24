import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { Video as VideoType, ScheduledPost } from '@/types'
import type { SocialPlatform, PublishResult } from '@/lib/zernio'

const supabase = createClient()

type PlatformId = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x' | 'linkedin'

export interface PublishVideoState {
  videoId: string
  platforms: Record<PlatformId, boolean>
  scheduledAt: string
  useZernio: boolean
}

export function usePublish(userId: string | undefined) {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [pastPosts, setPastPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [publishStates, setPublishStates] = useState<Record<string, PublishVideoState>>({})
  const [publishing, setPublishing] = useState<string | null>(null)
  const [zernioResults, setZernioResults] = useState<Record<string, PublishResult[]>>({})

  const fetchData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [videosRes, scheduledRes, pastRes] = await Promise.all([
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['ready', 'published'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('scheduled_posts')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('scheduled_posts')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['published', 'failed'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (videosRes.data) setVideos(videosRes.data as VideoType[])
      if (scheduledRes.data) setScheduledPosts(scheduledRes.data as ScheduledPost[])
      if (pastRes.data) setPastPosts(pastRes.data as ScheduledPost[])

      if (videosRes.data) {
        const states: Record<string, PublishVideoState> = {}
        for (const v of videosRes.data as VideoType[]) {
          states[v.id] = {
            videoId: v.id,
            platforms: { youtube: false, tiktok: false, instagram: false, facebook: false, x: false, linkedin: false },
            scheduledAt: '',
            useZernio: true,
          }
        }
        setPublishStates(states)
      }
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (userId) fetchData()
  }, [userId, fetchData])

  const togglePlatform = useCallback((videoId: string, platform: PlatformId) => {
    setPublishStates((prev) => ({
      ...prev,
      [videoId]: {
        ...prev[videoId],
        platforms: {
          ...prev[videoId].platforms,
          [platform]: !prev[videoId].platforms[platform],
        },
      },
    }))
  }, [])

  const setScheduleDate = useCallback((videoId: string, date: string) => {
    setPublishStates((prev) => ({
      ...prev,
      [videoId]: { ...prev[videoId], scheduledAt: date },
    }))
  }, [])

  const getSelectedPlatforms = useCallback(
    (videoId: string): PlatformId[] => {
      const state = publishStates[videoId]
      if (!state) return []
      return Object.entries(state.platforms)
        .filter(([, v]) => v)
        .map(([k]) => k as PlatformId)
    },
    [publishStates]
  )

  const publishViaZernio = useCallback(
    async (videoId: string, scheduled: boolean) => {
      const selected = getSelectedPlatforms(videoId)
      const state = publishStates[videoId]

      if (selected.length === 0) {
        toast.error('Selectionne au moins une plateforme')
        return
      }

      if (scheduled && !state.scheduledAt) {
        toast.error('Choisis une date de programmation')
        return
      }

      setPublishing(videoId)
      try {
        const res = await fetch('/api/publish/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            platforms: selected,
            scheduledAt: scheduled ? new Date(state.scheduledAt).toISOString() : undefined,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erreur' }))
          throw new Error(err.error ?? 'Publication echouee')
        }

        const data = await res.json()
        const results: PublishResult[] = data.results ?? []

        setZernioResults((prev) => ({ ...prev, [videoId]: results }))

        const successes = results.filter((r: PublishResult) => r.success)
        const failures = results.filter((r: PublishResult) => !r.success)

        if (successes.length > 0) {
          toast.success(
            scheduled
              ? `Publication programmee sur ${successes.length} plateforme${successes.length > 1 ? 's' : ''}`
              : `Publie sur ${successes.map((r: PublishResult) => r.platform).join(', ')}`
          )
        }
        if (failures.length > 0) {
          toast.error(
            `Echec sur ${failures.map((r: PublishResult) => r.platform).join(', ')}: ${failures[0]?.error ?? 'Erreur'}`
          )
        }

        await fetchData()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur publication'
        toast.error(message)
      } finally {
        setPublishing(null)
      }
    },
    [publishStates, getSelectedPlatforms, fetchData]
  )

  const publishNow = useCallback(
    async (videoId: string) => {
      const state = publishStates[videoId]
      if (state?.useZernio) {
        return publishViaZernio(videoId, false)
      }

      const selected = getSelectedPlatforms(videoId)
      if (selected.length === 0) {
        toast.error('Selectionne au moins une plateforme')
        return
      }

      setPublishing(videoId)
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId, platforms: selected, immediate: true }),
        })

        if (!res.ok) throw new Error('Publish failed')
        toast.success('Publication lancee avec succes !')
        await fetchData()
      } catch {
        toast.error('Erreur lors de la publication')
      } finally {
        setPublishing(null)
      }
    },
    [publishStates, getSelectedPlatforms, publishViaZernio, fetchData]
  )

  const schedulePostAction = useCallback(
    async (videoId: string) => {
      const state = publishStates[videoId]
      if (state?.useZernio) {
        return publishViaZernio(videoId, true)
      }

      const selected = getSelectedPlatforms(videoId)
      if (selected.length === 0) {
        toast.error('Selectionne au moins une plateforme')
        return
      }
      if (!state?.scheduledAt) {
        toast.error('Choisis une date de programmation')
        return
      }

      setPublishing(videoId)
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            platforms: selected,
            scheduled_at: new Date(state.scheduledAt).toISOString(),
          }),
        })

        if (!res.ok) throw new Error('Schedule failed')
        toast.success('Publication programmee !')
        await fetchData()
      } catch {
        toast.error('Erreur lors de la programmation')
      } finally {
        setPublishing(null)
      }
    },
    [publishStates, getSelectedPlatforms, publishViaZernio, fetchData]
  )

  const toggleZernio = useCallback((videoId: string) => {
    setPublishStates((prev) => ({
      ...prev,
      [videoId]: { ...prev[videoId], useZernio: !prev[videoId].useZernio },
    }))
  }, [])

  return {
    videos,
    scheduledPosts,
    pastPosts,
    loading,
    publishStates,
    publishing,
    zernioResults,
    fetchData,
    togglePlatform,
    setScheduleDate,
    publishNow,
    schedulePostAction,
    toggleZernio,
  }
}
