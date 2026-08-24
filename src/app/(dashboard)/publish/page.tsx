'use client'

import { motion } from 'framer-motion'
import { Video } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePublish } from '@/hooks/usePublish'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import VideoPublishCard from '@/components/publish/VideoPublishCard'
import ScheduledPostsTable from '@/components/publish/ScheduledPostsTable'
import PastPostsList from '@/components/publish/PastPostsList'
import type { PlatformId } from '@/components/publish/constants'

export default function PublishPage() {
  const { profile, loading: authLoading } = useAuth()
  const {
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
  } = usePublish(profile?.id)

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
                  <VideoPublishCard
                    key={video.id}
                    video={video}
                    state={state}
                    publishing={isThisPublishing}
                    zernioResults={results}
                    onTogglePlatform={(platform: PlatformId) => togglePlatform(video.id, platform)}
                    onSetScheduleDate={(date: string) => setScheduleDate(video.id, date)}
                    onToggleZernio={() => toggleZernio(video.id)}
                    onSchedule={() => schedulePostAction(video.id)}
                    onPublishNow={() => publishNow(video.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Scheduled posts */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Publications programmees</h2>
          <ScheduledPostsTable posts={scheduledPosts} />
        </div>

        {/* Past publications */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Publications passees</h2>
          <PastPostsList posts={pastPosts} />
        </div>
      </motion.div>
    </LoadingTimeout>
  )
}
