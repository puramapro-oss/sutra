'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  Timer,
  Star,
  Crown,
  Medal,
  ChevronDown,
  ChevronUp,
  Video,
  Send,
  Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { CONTEST_DISTRIBUTION } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { Video as VideoType, ContestSubmission } from '@/types'

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

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const target = new Date(targetDate).getTime()

    function update() {
      const diff = Math.max(0, target - Date.now())
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

const RANK_ICONS = [Crown, Medal, Award]
const RANK_COLORS = ['text-amber-400', 'text-gray-300', 'text-amber-600']

export default function ContestPage() {
  const { profile, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [pastContests, setPastContests] = useState<Contest[]>([])
  const [videos, setVideos] = useState<VideoType[]>([])
  const [expandedContest, setExpandedContest] = useState<string | null>(null)

  // Submission form
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [submissionTitle, setSubmissionTitle] = useState('')
  const [submissionDesc, setSubmissionDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const countdown = useCountdown(activeContest?.period_end ?? new Date().toISOString())

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [activeRes, pastRes, videosRes, submissionRes] = await Promise.all([
        supabase
          .from('contests')
          .select('*')
          .eq('status', 'open')
          .order('period_end', { ascending: true })
          .limit(1)
          .single(),
        supabase
          .from('contests')
          .select('*')
          .eq('status', 'completed')
          .order('period_end', { ascending: false })
          .limit(10),
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', profile.id)
          .in('status', ['ready', 'published'])
          .order('created_at', { ascending: false }),
        supabase
          .from('contest_submissions')
          .select('id')
          .eq('user_id', profile.id)
          .limit(1),
      ])

      if (activeRes.data) setActiveContest(activeRes.data as Contest)
      if (pastRes.data) setPastContests(pastRes.data as Contest[])
      if (videosRes.data) setVideos(videosRes.data as VideoType[])
      if (submissionRes.data && submissionRes.data.length > 0) setHasSubmitted(true)

    } catch {
      // Keep defaults
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

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

  // Hall of fame: top performers across all completed contests
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
        <p className="text-sm text-white/40 mt-1">
          Participe et gagne des prix chaque semaine
        </p>
      </div>

      {/* Active contest banner */}
      {activeContest ? (
        <Card data-testid="contest-banner">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 border border-amber-500/30 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Concours {activeContest.type === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                </h2>
                <p className="text-sm text-white/40">{activeContest.period_label}</p>
              </div>
              <Badge variant="premium" className="ml-auto">
                {formatPrice(activeContest.prize_pool_amount)} a gagner
              </Badge>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-4 py-4" data-testid="contest-countdown">
              {[
                { value: countdown.days, label: 'Jours' },
                { value: countdown.hours, label: 'Heures' },
                { value: countdown.minutes, label: 'Min' },
                { value: countdown.seconds, label: 'Sec' },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                    <span className="text-2xl font-bold text-white font-mono tabular-nums">
                      {String(unit.value).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">{unit.label}</p>
                </div>
              ))}
            </div>

            {/* Prize distribution */}
            <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <p className="text-xs text-white/30 mb-2">Distribution des prix (Top 10)</p>
              <div className="flex gap-1">
                {CONTEST_DISTRIBUTION.map((pct, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 text-center py-1.5 rounded-md text-[10px] font-medium',
                      i === 0
                        ? 'bg-amber-500/20 text-amber-400'
                        : i < 3
                          ? 'bg-violet-500/10 text-violet-400'
                          : 'bg-white/[0.03] text-white/30'
                    )}
                  >
                    #{i + 1} {pct}%
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-white/30 text-center mt-3">
              {activeContest.total_submissions} participant{activeContest.total_submissions !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Timer className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/30">Aucun concours en cours</p>
            <p className="text-xs text-white/20 mt-1">Le prochain concours commencera bientot</p>
          </CardContent>
        </Card>
      )}

      {/* Submit entry */}
      {activeContest && (
        <Card data-testid="contest-submit">
          <CardContent>
            <h2 className="text-sm font-semibold text-white/60 mb-4">Participer</h2>
            {hasSubmitted ? (
              <div className="py-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Star className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm text-white/70">Tu as deja participe a ce concours !</p>
                <p className="text-xs text-white/30 mt-1">Les resultats seront annonces a la fin du concours.</p>
              </div>
            ) : videos.length === 0 ? (
              <EmptyState
                icon={Video}
                title="Aucune video disponible"
                description="Cree et genere une video pour pouvoir participer."
                action={{ label: 'Creer une video', onClick: () => window.location.assign('/create') }}
              />
            ) : (
              <div className="space-y-4">
                {/* Video selector */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-2 block">Selectionne une video</label>
                  <select
                    value={selectedVideoId}
                    onChange={(e) => setSelectedVideoId(e.target.value)}
                    data-testid="contest-video-select"
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer focus:border-violet-500/60 transition-colors"
                  >
                    <option value="" className="bg-[#0c0b14]">Choisis une video...</option>
                    {videos.map((v) => (
                      <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                        {v.title ?? 'Sans titre'} ({v.quality})
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Titre de la participation"
                  value={submissionTitle}
                  onChange={(e) => setSubmissionTitle(e.target.value)}
                  placeholder="Un titre accrocheur..."
                  data-testid="contest-title-input"
                />

                <div>
                  <label className="text-xs font-medium text-white/40 mb-2 block">Description (optionnel)</label>
                  <textarea
                    value={submissionDesc}
                    onChange={(e) => setSubmissionDesc(e.target.value)}
                    data-testid="contest-desc-input"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 outline-none resize-none focus:border-violet-500/60 transition-colors"
                    placeholder="Decris ta video et pourquoi elle devrait gagner..."
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  data-testid="contest-submit-btn"
                >
                  <Send className="h-4 w-4" />
                  Soumettre ma participation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {activeContest?.rankings && activeContest.rankings.length > 0 && (
        <Card data-testid="contest-leaderboard">
          <CardContent>
            <h2 className="text-sm font-semibold text-white/60 mb-4">Classement</h2>
            <div className="space-y-2">
              {activeContest.rankings.slice(0, 10).map((entry, i) => {
                const RankIcon = RANK_ICONS[i] ?? Star
                const rankColor = RANK_COLORS[i] ?? 'text-white/40'
                return (
                  <div
                    key={entry.user_id}
                    data-testid={`leaderboard-rank-${i + 1}`}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                      i < 3 ? 'bg-white/[0.03] border border-white/[0.06]' : ''
                    )}
                  >
                    <div className="flex items-center justify-center w-8">
                      {i < 3 ? (
                        <RankIcon className={cn('h-5 w-5', rankColor)} />
                      ) : (
                        <span className="text-sm font-mono text-white/30">#{i + 1}</span>
                      )}
                    </div>
                    <span className="flex-1 text-sm text-white/70">{entry.name}</span>
                    <span className="text-sm font-mono text-white/50">{entry.score} pts</span>
                    <Badge variant={i === 0 ? 'premium' : 'default'} size="sm">
                      {formatPrice(entry.prize)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past contests */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Concours passes</h2>
        {pastContests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-8 w-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">Aucun concours passe</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pastContests.map((c) => (
              <Card key={c.id} data-testid={`past-contest-${c.id}`}>
                <button
                  onClick={() => setExpandedContest(expandedContest === c.id ? null : c.id)}
                  className="w-full"
                >
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span className="text-sm text-white/70">{c.period_label}</span>
                      <Badge variant={c.type === 'weekly' ? 'info' : 'premium'} size="sm">
                        {c.type === 'weekly' ? 'Hebdo' : 'Mensuel'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-white/40">{formatPrice(c.prize_pool_amount)}</span>
                      {expandedContest === c.id ? (
                        <ChevronUp className="h-4 w-4 text-white/30" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/30" />
                      )}
                    </div>
                  </CardContent>
                </button>
                <AnimatePresence>
                  {expandedContest === c.id && c.rankings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 space-y-1.5">
                        {c.rankings.slice(0, 10).map((r, i) => (
                          <div
                            key={r.user_id}
                            className="flex items-center justify-between text-sm py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-white/30 w-6">#{i + 1}</span>
                              <span className="text-white/60">{r.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/30">{r.score} pts</span>
                              <span className="text-xs font-medium text-emerald-400">
                                {formatPrice(r.prize)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Hall of Fame */}
      {hallOfFame.length > 0 && (
        <Card data-testid="hall-of-fame">
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Crown className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Hall of Fame</h2>
            </div>
            <div className="space-y-3">
              {hallOfFame.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02]"
                >
                  <span className={cn(
                    'text-lg font-bold',
                    i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/20'
                  )}>
                    #{i + 1}
                  </span>
                  <span className="flex-1 text-sm text-white/70">{entry.name}</span>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-400">{formatPrice(entry.totalPrize)}</p>
                    <p className="text-[10px] text-white/30">
                      {entry.wins} victoire{entry.wins > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
    </LoadingTimeout>
  )
}
