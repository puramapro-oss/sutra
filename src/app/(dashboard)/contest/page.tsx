'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { Timer } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { DataUnavailable } from '@/components/ui/DataUnavailable'
import ContestBanner from '@/components/contest/ContestBanner'
import ContestSubmissionForm from '@/components/contest/ContestSubmissionForm'
import ContestLeaderboard from '@/components/contest/ContestLeaderboard'
import PastContestsSection from '@/components/contest/PastContestsSection'
import HallOfFame from '@/components/contest/HallOfFame'
import type { Video as VideoType } from '@/types'

const supabase = createClient()

interface Contest {
  id: string
  type: 'weekly' | 'monthly'
  period_label: string
  period_start: string
  period_end: string
  prize_pool_amount: number
  total_submissions: number
  status: 'open' | 'judging' | 'completed'
  rankings: { user_id: string; name: string; score: number; prize: number; rank: number }[] | null
  created_at: string
}

export default function ContestPage() {
  const auth = useAuth()
  return <ContestPageContent key={auth.profile?.id ?? 'signed-out'} auth={auth} />
}

function ContestPageContent({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { profile, loading: authLoading } = auth

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [pastContests, setPastContests] = useState<Contest[]>([])
  const [videos, setVideos] = useState<VideoType[]>([])
  const [userEntries, setUserEntries] = useState(0)

  // Submission form
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [submissionTitle, setSubmissionTitle] = useState('')
  const [submissionDesc, setSubmissionDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const dataRequest = useRef<AbortController | null>(null)
  const userId = profile?.id
  const loadFetchData = useCallback(() => {
    if (!userId) return
    dataRequest.current?.abort()
    const controller = new AbortController()
    dataRequest.current = controller
    const active = () => dataRequest.current === controller && !controller.signal.aborted
    const commit = (write: () => void) => { if (active()) write() }
    return Promise.all([
        supabase
          .from('contests')
          .select('*')
          .eq('status', 'open')
          .order('period_end', { ascending: true })
          .limit(1)
          .abortSignal(controller.signal).maybeSingle(),
        supabase
          .from('contests')
          .select('*')
          .eq('status', 'completed')
          .order('period_end', { ascending: false })
          .limit(10).abortSignal(controller.signal),
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .in('status', ['ready', 'published'])
          .order('created_at', { ascending: false }).abortSignal(controller.signal),
        supabase
          .from('contest_submissions')
          .select('id')
          .eq('user_id', userId)
          .limit(1).abortSignal(controller.signal),
      ]).then(async ([activeRes, pastRes, videosRes, submissionRes]) => {
      if (!active()) return
      for (const result of [activeRes, pastRes, videosRes, submissionRes]) {
        if (result.error) throw result.error
      }
      const entriesRes = await supabase
        .from('contest_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).abortSignal(controller.signal)
      if (entriesRes.error) throw entriesRes.error
      const entries = entriesRes.count
      if (entries === null || !Number.isSafeInteger(entries) || entries < 0) {
        throw new Error('Participation count unavailable')
      }
      commit(() => {
        setLoadError(null)
        setActiveContest(activeRes.data as Contest | null)
        setPastContests((pastRes.data ?? []) as Contest[])
        setVideos((videosRes.data ?? []) as VideoType[])
        setHasSubmitted(Boolean(submissionRes.data?.length))
        setUserEntries(entries)
      })
    }).catch(() => {
      if (!active()) return
      setActiveContest(null)
      setLoadError('Les concours sont indisponibles. Les résultats et les participations ne peuvent pas être confirmés.')
    }).finally(() => {
      commit(() => setLoading(false))
      if (dataRequest.current === controller) dataRequest.current = null
    })
  }, [userId])

  const fetchData = useCallback(() => {
    setLoading(true)
    return loadFetchData()
  }, [loadFetchData])

  useEffect(() => {
    if (!authLoading && profile?.id) loadFetchData()

    return () => { dataRequest.current?.abort(); dataRequest.current = null }
  }, [authLoading, profile?.id, loadFetchData])

  const handleSubmit = useCallback(async () => {
    if (!selectedVideoId) {
      toast.error('Selectionne une video')
      return
    }
    if (!submissionTitle.trim()) {
      toast.error('Ajoute un titre')
      return
    }
    if (!activeContest || !profile) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('contest_submissions').insert({
        contest_id: activeContest.id,
        user_id: profile.id,
        video_id: selectedVideoId,
        title: submissionTitle.trim(),
        description: submissionDesc.trim() || null,
        content_data: {},
        status: 'submitted',
      })

      if (error) throw error
      toast.success('Participation envoyee !')
      setHasSubmitted(true)
      setSelectedVideoId('')
      setSubmissionTitle('')
      setSubmissionDesc('')
    } catch {
      toast.error('Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }, [selectedVideoId, submissionTitle, submissionDesc, activeContest, profile])

  const hallOfFame = useMemo(() => {
    const scores: Record<string, { name: string; totalPrize: number; wins: number }> = {}
    for (const c of pastContests) {
      if (!c.rankings) continue
      for (const r of c.rankings) {
        if (!scores[r.user_id]) {
          scores[r.user_id] = { name: r.name, totalPrize: 0, wins: 0 }
        }
        scores[r.user_id].totalPrize += r.prize
        if (r.rank === 1) scores[r.user_id].wins += 1
      }
    }
    return Object.entries(scores)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalPrize - a.totalPrize)
      .slice(0, 5)
  }, [pastContests])

  const contestSkeleton = (
    <div className="space-y-6" data-testid="contest-loading">
      <Skeleton width={200} height={32} rounded="lg" />
      <Skeleton width="100%" height={200} rounded="xl" />
      <Skeleton width="100%" height={300} rounded="xl" />
    </div>
  )

  if (authLoading) return contestSkeleton

  if (loadError && !loading) return <DataUnavailable title="Concours" message={loadError} onRetry={fetchData} />

  return (
    <LoadingTimeout loading={loading} onRetry={fetchData} skeleton={contestSkeleton}>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white" data-testid="contest-title">
          Concours
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Participe et gagne des prix chaque semaine
        </p>
      </div>

      {/* Active contest banner */}
      {activeContest ? (
        <ContestBanner contest={activeContest} userEntries={userEntries} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Timer className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/60">Aucun concours en cours</p>
            <p className="text-xs text-white/60 mt-1">Le prochain concours commencera bientot</p>
          </CardContent>
        </Card>
      )}

      {/* Submit entry */}
      {activeContest && (
        <ContestSubmissionForm
          hasSubmitted={hasSubmitted}
          videos={videos}
          selectedVideoId={selectedVideoId}
          setSelectedVideoId={setSelectedVideoId}
          submissionTitle={submissionTitle}
          setSubmissionTitle={setSubmissionTitle}
          submissionDesc={submissionDesc}
          setSubmissionDesc={setSubmissionDesc}
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      )}

      {/* Leaderboard */}
      {activeContest?.rankings && <ContestLeaderboard rankings={activeContest.rankings} />}

      {/* Past contests */}
      <PastContestsSection contests={pastContests} />

      {/* Hall of Fame */}
      <HallOfFame entries={hallOfFame} />
    </motion.div>
    </LoadingTimeout>
  )
}
