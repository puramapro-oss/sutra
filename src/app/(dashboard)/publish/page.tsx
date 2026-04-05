'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  Calendar,
  Clock,
  PlayCircle,
  Camera,
  CheckCircle2,
  XCircle,
  Video,
  Globe,
  Briefcase,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Video as VideoType, ScheduledPost } from '@/types'
import type { SocialPlatform, PublishResult } from '@/lib/zernio'

const supabase = createClient()

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88A2.89 2.89 0 019.49 12.4v-3.5a6.37 6.37 0 00-6.38 6.38 6.37 6.37 0 006.38 6.38 6.37 6.37 0 006.38-6.38V9.42a8.16 8.16 0 004.72 1.49V7.46a4.85 4.85 0 01-1-.77z" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const PLATFORMS = [
  { id: 'youtube' as const, label: 'YouTube', icon: PlayCircle, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { id: 'tiktok' as const, label: 'TikTok', icon: TikTokIcon, color: 'text-white bg-white/10 border-white/20' },
  { id: 'instagram' as const, label: 'Instagram', icon: Camera, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  { id: 'facebook' as const, label: 'Facebook', icon: Users, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'x' as const, label: 'X', icon: XIcon, color: 'text-white bg-white/10 border-white/20' },
  { id: 'linkedin' as const, label: 'LinkedIn', icon: Briefcase, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
] as const

type PlatformId = (typeof PLATFORMS)[number]['id']

interface PublishVideoState {
  videoId: string
  platforms: Record<PlatformId, boolean>
  scheduledAt: string
  useZernio: boolean
}

export default function PublishPage() {
  const { profile, loading: authLoading } = useAuth()

  const [videos, setVideos] = useState<VideoType[]>([])
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [pastPosts, setPastPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [publishStates, setPublishStates] = useState<Record<string, PublishVideoState>>({})
  const [publishing, setPublishing] = useState<string | null>(null)
  const [zernioResults, setZernioResults] = useState<Record<string, PublishResult[]>>({})

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [videosRes, scheduledRes, pastRes] = await Promise.all([
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', profile.id)
          .in('status', ['ready', 'published'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('scheduled_posts')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('scheduled_posts')
          .select('*')
          .eq('user_id', profile.id)
          .in('status', ['published', 'failed'])
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (videosRes.data) setVideos(videosRes.data as VideoType[])
      if (scheduledRes.data) setScheduledPosts(scheduledRes.data as ScheduledPost[])
      if (pastRes.data) setPastPosts(pastRes.data as ScheduledPost[])

      // Initialize publish states
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
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

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

        // Refresh data
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

  const publishSkeleton = (
    <div className="space-y-6" data-testid="publish-loading">
      <Skeleton width={250} height={32} rounded="lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={100} rounded="xl" />
        ))}
      </div>
      <Skeleton width="100%" height={300} rounded="xl" />
    </div>
  )

  if (authLoading) return publishSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchData} skeleton={publishSkeleton}>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white" data-testid="publish-title">
          Publication
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Publie tes videos sur YouTube, TikTok, Instagram, Facebook, X et LinkedIn
        </p>
      </div>

      {/* Videos ready to publish */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Videos pretes</h2>
        {videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="Aucune video prete"
            description="Cree et genere une video pour pouvoir la publier."
            action={{ label: 'Creer une video', onClick: () => window.location.assign('/create') }}
            data-testid="publish-empty"
          />
        ) : (
          <div className="space-y-4">
            {videos.map((video) => {
              const state = publishStates[video.id]
              if (!state) return null
              const isThisPublishing = publishing === video.id
              const results = zernioResults[video.id]
              return (
                <Card key={video.id} data-testid={`publish-video-${video.id}`}>
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4">
                      {/* Top row: thumbnail + info + Zernio toggle */}
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title ?? 'Video'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Video className="h-5 w-5 text-white/20" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">
                            {video.title ?? 'Sans titre'}
                          </p>
                          <p className="text-xs text-white/30">
                            {video.duration ? `${Math.round(video.duration)}s` : ''} {video.quality}
                          </p>
                        </div>
                        {/* Zernio toggle */}
                        <button
                          onClick={() => toggleZernio(video.id)}
                          data-testid={`toggle-zernio-${video.id}`}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                            state.useZernio
                              ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50'
                          )}
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Zernio
                        </button>
                      </div>

                      {/* Platform toggles — all 6 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {PLATFORMS.map((platform) => {
                          const Icon = platform.icon
                          const active = state.platforms[platform.id]
                          return (
                            <button
                              key={platform.id}
                              onClick={() => togglePlatform(video.id, platform.id)}
                              data-testid={`toggle-${platform.id}-${video.id}`}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                                active
                                  ? platform.color
                                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50'
                              )}
                            >
                              <Icon />
                              <span className="hidden sm:inline">{platform.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Schedule date + Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-white/30" />
                          <input
                            type="datetime-local"
                            value={state.scheduledAt}
                            onChange={(e) => setScheduleDate(video.id, e.target.value)}
                            data-testid={`schedule-date-${video.id}`}
                            className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 outline-none focus:border-violet-500/60 transition-colors"
                          />
                        </div>

                        <div className="flex items-center gap-2 sm:ml-auto">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => schedulePostAction(video.id)}
                            disabled={isThisPublishing}
                            data-testid={`schedule-btn-${video.id}`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Programmer
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => publishNow(video.id)}
                            loading={isThisPublishing}
                            data-testid={`publish-btn-${video.id}`}
                          >
                            <Send className="h-3.5 w-3.5" />
                            Publier maintenant
                          </Button>
                        </div>
                      </div>

                      {/* Zernio results feedback */}
                      {results && results.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {results.map((r, i) => (
                            <Badge
                              key={`${r.platform}-${i}`}
                              variant={r.success ? 'success' : 'error'}
                              size="sm"
                            >
                              {r.success ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {r.platform}
                              {r.postUrl && (
                                <a
                                  href={r.postUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Voir
                                </a>
                              )}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Scheduled posts */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Publications programmees</h2>
        {scheduledPosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-8 w-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">Aucune publication programmee</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="scheduled-table">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Video</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Plateforme</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledPosts.map((post) => (
                    <tr key={post.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 text-sm text-white/70">{post.video_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">
                        <Badge variant="info" size="sm">{post.platform}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/50">
                        {formatDate(post.scheduled_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="warning" size="sm">
                          <Clock className="h-3 w-3 mr-1" />
                          Programmee
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Past publications */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Publications passees</h2>
        {pastPosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">Aucune publication passee</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pastPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {post.status === 'published' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    <span className="text-sm text-white/70">{post.video_id.slice(0, 8)}...</span>
                    <Badge variant={post.status === 'published' ? 'success' : 'error'} size="sm">
                      {post.platform}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/30">{formatRelativeDate(post.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </motion.div>
    </LoadingTimeout>
  )
}
