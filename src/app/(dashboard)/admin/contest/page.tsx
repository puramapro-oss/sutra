'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Trophy,
  Star,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle,
  Award,
  ThumbsUp,
  Eye,
  Loader2,
  Medal,
  Crown,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Contest {
  id: string
  type: 'weekly' | 'monthly'
  period_label: string
  period_start: string
  period_end: string
  total_submissions: number
  prize_pool_amount: number
  status: 'open' | 'judging' | 'completed'
  created_at: string
}

interface Submission {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  video_title: string
  ai_score: number | null
  community_votes: number
  status: string
  created_at: string
}

interface HallOfFameEntry {
  id: string
  user_name: string
  contest_label: string
  rank: number
  prize_amount: number
}

const STATUS_CONFIG = {
  open: { variant: 'success' as const, label: 'Ouvert', icon: Play },
  judging: { variant: 'warning' as const, label: 'Evaluation', icon: Clock },
  completed: { variant: 'default' as const, label: 'Termine', icon: CheckCircle },
}

const RANK_ICONS = [Crown, Medal, Award]

function GoldCard({
  children,
  className,
  glow = false,
  ...props
}: {
  children: React.ReactNode
  className?: string
  glow?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
        glow
          ? 'bg-amber-500/[0.04] border-amber-500/20'
          : 'bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default function AdminContestPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [judgingId, setJudgingId] = useState<string | null>(null)
  const [confirmingWinners, setConfirmingWinners] = useState(false)
  const [triggeringDraw, setTriggeringDraw] = useState<string | null>(null)

  const triggerDraw = async (type: 'weekly' | 'monthly') => {
    setTriggeringDraw(type)
    try {
      const res = await fetch(`/api/cron/contest-${type}`)
      const data = await res.json()
      if (res.ok) {
        toast.success(`Tirage ${type === 'weekly' ? 'hebdomadaire' : 'mensuel'} declenche`)
        fetchData()
      } else {
        toast.error(data?.error ?? 'Erreur lors du tirage')
      }
    } catch {
      toast.error('Erreur lors du declenchement')
    } finally {
      setTriggeringDraw(null)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Erreur chargement concours')

      // Set empty defaults as contest data may not exist yet
      setContests([])
      setActiveContest(null)
      setSubmissions([])
      setHallOfFame([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleJudge = async (submissionId: string) => {
    setJudgingId(submissionId)
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'judge_submission', submission_id: submissionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, ai_score: data.score ?? 0, status: 'judged' } : s
          )
        )
        toast.success('Evaluation terminee')
      } else {
        toast.error('Erreur lors de l\'evaluation')
      }
    } catch {
      toast.error('Erreur lors de l\'evaluation')
    } finally {
      setJudgingId(null)
    }
  }

  const handleConfirmWinners = async () => {
    if (!activeContest) return
    setConfirmingWinners(true)
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'confirm_winners',
          contest_id: activeContest.id,
        }),
      })
      if (res.ok) {
        toast.success('Gagnants confirmes et recompenses distribues')
        fetchData()
      } else {
        toast.error('Erreur lors de la confirmation')
      }
    } catch {
      toast.error('Erreur lors de la confirmation')
    } finally {
      setConfirmingWinners(false)
    }
  }

  if (error && !contests.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-contest-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-contest-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Gestion des concours</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerDraw('weekly')}
            disabled={triggeringDraw !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            data-testid="trigger-weekly-draw"
          >
            {triggeringDraw === 'weekly' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Tirage hebdo
          </button>
          <button
            onClick={() => triggerDraw('monthly')}
            disabled={triggeringDraw !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            data-testid="trigger-monthly-draw"
          >
            {triggeringDraw === 'monthly' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Tirage mensuel
          </button>
        </div>
      </div>

      {/* Active Contest */}
      <GoldCard glow className="p-5" data-testid="admin-contest-active">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
            Concours actif
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton height={60} width="100%" rounded="xl" />
            <Skeleton height={40} width="60%" rounded="lg" />
          </div>
        ) : activeContest ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">{activeContest.period_label}</p>
                <p className="text-xs text-white/40">
                  {formatDate(activeContest.period_start)} &mdash; {formatDate(activeContest.period_end)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={STATUS_CONFIG[activeContest.status].variant}
                  size="md"
                >
                  {STATUS_CONFIG[activeContest.status].label}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Soumissions</p>
                <p className="text-xl font-bold text-white">{activeContest.total_submissions}</p>
              </div>
              <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-3 text-center">
                <p className="text-xs text-amber-400/60 mb-1">Pool de prix</p>
                <p className="text-xl font-bold text-amber-400">
                  {activeContest.prize_pool_amount.toFixed(2)} EUR
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                <p className="text-xs text-white/40 mb-1">Type</p>
                <p className="text-xl font-bold text-white capitalize">{activeContest.type}</p>
              </div>
            </div>

            {activeContest.status === 'judging' && (
              <button
                onClick={handleConfirmWinners}
                disabled={confirmingWinners}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                data-testid="admin-contest-confirm-winners"
              >
                {confirmingWinners ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Confirmer les gagnants
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30">Aucun concours actif</p>
            <p className="text-xs text-white/15 mt-1">Les concours sont crees automatiquement par le CRON</p>
          </div>
        )}
      </GoldCard>

      {/* Submissions List */}
      <GoldCard className="p-5" data-testid="admin-contest-submissions">
        <div className="flex items-center gap-2 mb-4">
          <Star className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
            Soumissions
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={72} width="100%" rounded="lg" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30">Aucune soumission</p>
            <p className="text-xs text-white/15 mt-1">Les soumissions apparaitront ici quand les utilisateurs participeront</p>
          </div>
        ) : (
          <div className="space-y-2">
            {submissions.map((sub, idx) => (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                data-testid={`admin-submission-${sub.id}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                    {(sub.user_name ?? sub.user_email)[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/90 truncate">
                      {sub.video_title}
                    </p>
                    <p className="text-xs text-white/30 truncate">
                      {sub.user_name ?? sub.user_email} &mdash; {formatRelativeDate(sub.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {/* AI Score */}
                  <div className="text-center">
                    <p className="text-xs text-white/30">IA</p>
                    <p className={cn(
                      'text-sm font-bold',
                      sub.ai_score !== null
                        ? sub.ai_score >= 80 ? 'text-emerald-400' : sub.ai_score >= 50 ? 'text-amber-400' : 'text-red-400'
                        : 'text-white/20'
                    )}>
                      {sub.ai_score !== null ? `${sub.ai_score}/100` : '--'}
                    </p>
                  </div>

                  {/* Community Votes */}
                  <div className="text-center">
                    <p className="text-xs text-white/30">Votes</p>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3 text-blue-400" />
                      <span className="text-sm font-bold text-blue-400">{sub.community_votes}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <Badge
                    variant={sub.status === 'judged' ? 'success' : sub.status === 'pending' ? 'warning' : 'default'}
                    size="sm"
                  >
                    {sub.status === 'judged' ? 'Evalue' : sub.status === 'pending' ? 'En attente' : sub.status}
                  </Badge>

                  {/* Judge button */}
                  {sub.ai_score === null && (
                    <button
                      onClick={() => handleJudge(sub.id)}
                      disabled={judgingId === sub.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      data-testid={`admin-judge-${sub.id}`}
                    >
                      {judgingId === sub.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      Evaluer
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </GoldCard>

      {/* Past Contests */}
      <GoldCard className="p-5" data-testid="admin-contest-past">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
            Concours passes
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={56} width="100%" rounded="lg" />
            ))}
          </div>
        ) : contests.filter((c) => c.status === 'completed').length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30">Aucun concours termine</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contests
              .filter((c) => c.status === 'completed')
              .map((contest) => (
                <div
                  key={contest.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white/70">{contest.period_label}</p>
                    <p className="text-xs text-white/30">
                      {contest.total_submissions} soumissions &mdash; {contest.prize_pool_amount.toFixed(2)} EUR
                    </p>
                  </div>
                  <Badge variant="default" size="sm">Termine</Badge>
                </div>
              ))}
          </div>
        )}
      </GoldCard>

      {/* Hall of Fame */}
      <GoldCard glow className="p-5" data-testid="admin-contest-hall-of-fame">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
            Hall of Fame
          </h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={56} width="100%" rounded="lg" />
            ))}
          </div>
        ) : hallOfFame.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Award className="h-10 w-10 text-amber-400/10 mb-3" />
            <p className="text-sm text-white/30">Le Hall of Fame est vide</p>
            <p className="text-xs text-white/15 mt-1">Les gagnants de concours apparaitront ici</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hallOfFame.map((entry, idx) => {
              const RankIcon = RANK_ICONS[entry.rank - 1] ?? Award
              const rankColors = ['text-amber-400', 'text-gray-300', 'text-orange-400']
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <RankIcon className={cn('h-5 w-5', rankColors[entry.rank - 1] ?? 'text-white/40')} />
                    <div>
                      <p className="text-sm font-medium text-white/80">{entry.user_name}</p>
                      <p className="text-xs text-white/30">{entry.contest_label}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{entry.prize_amount.toFixed(2)} EUR</span>
                </motion.div>
              )
            })}
          </div>
        )}
      </GoldCard>
    </div>
  )
}
