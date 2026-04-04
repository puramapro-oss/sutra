'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Crown, Medal, Award, Star, Clock, Send, Film } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import Button from '@/components/ui/Button'
import type { Video } from '@/types'

const supabase = createClient()

const CRITERIA = [
  { name: 'Amour', max: 25, color: 'text-pink-400' },
  { name: 'Impact', max: 25, color: 'text-violet-400' },
  { name: 'Creativite', max: 20, color: 'text-cyan-400' },
  { name: 'Qualite', max: 15, color: 'text-emerald-400' },
  { name: 'Inspiration', max: 15, color: 'text-amber-400' },
]

const DISTRIBUTION = ['30%', '20%', '15%', '10%', '8%', '3.4%', '3.4%', '3.4%', '3.4%', '3.4%']
const RANK_ICONS = [Crown, Medal, Award]
const RANK_COLORS = ['text-amber-400', 'text-gray-300', 'text-amber-600']

interface ContestData {
  id: string
  type: string
  period_label: string
  period_end: string
  status: string
  prize_pool_amount: number
  rankings: { user_id: string; name: string; score: number; prize: number; rank: number }[] | null
}

function useCountdown(target: string) {
  const [t, setT] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    const end = new Date(target).getTime()
    const tick = () => {
      const diff = Math.max(0, end - Date.now())
      setT({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])
  return t
}

export default function ClassementPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeContest, setActiveContest] = useState<ContestData | null>(null)
  const [pastContests, setPastContests] = useState<ContestData[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedVideo, setSelectedVideo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const countdown = useCountdown(activeContest?.period_end ?? new Date().toISOString())

  const fetchData = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [activeRes, pastRes, videosRes, subRes] = await Promise.all([
        supabase.from('contests').select('*').eq('type', 'monthly').eq('status', 'open').order('period_end', { ascending: true }).limit(1).single(),
        supabase.from('contests').select('*').eq('type', 'monthly').eq('status', 'completed').order('period_end', { ascending: false }).limit(5),
        supabase.from('videos').select('*').eq('user_id', profile.id).in('status', ['ready', 'published']).order('created_at', { ascending: false }),
        supabase.from('contest_submissions').select('id').eq('user_id', profile.id).limit(1),
      ])

      if (activeRes.data) setActiveContest(activeRes.data as ContestData)
      if (pastRes.data) setPastContests(pastRes.data as ContestData[])
      if (videosRes.data) setVideos(videosRes.data as Video[])
      if (subRes.data && subRes.data.length > 0) setHasSubmitted(true)
    } catch {
      // defaults
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

  const handleSubmit = async () => {
    if (!selectedVideo || !activeContest || !profile) return
    setSubmitting(true)
    try {
      const video = videos.find((v) => v.id === selectedVideo)
      const { error } = await supabase.from('contest_submissions').insert({
        contest_id: activeContest.id,
        user_id: profile.id,
        video_id: selectedVideo,
        title: video?.title ?? 'Ma soumission',
        status: 'submitted',
      })
      if (error) throw error
      toast.success('Video soumise au classement !')
      setHasSubmitted(true)
    } catch {
      toast.error('Erreur lors de la soumission')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton width={250} height={32} rounded="lg" />
        <Skeleton width="100%" height={200} rounded="xl" />
        <Skeleton width="100%" height={400} rounded="xl" />
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Classement Purama Impact</h1>
        <p className="text-sm text-white/40 mt-1">Soumets ta meilleure video et gagne des prix</p>
      </div>

      {/* Criteria bar */}
      <Card>
        <CardContent className="py-4">
          <h2 className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wider">Bareme d&apos;evaluation — 100 points</h2>
          <div className="flex gap-2">
            {CRITERIA.map((c) => (
              <div key={c.name} className="flex-1 text-center">
                <p className={cn('text-lg font-bold', c.color)}>{c.max}</p>
                <p className="text-[10px] text-white/40">{c.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active contest */}
      {activeContest ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{activeContest.period_label}</h2>
                <p className="text-xs text-white/40">Classement mensuel en cours</p>
              </div>
              <Badge variant="premium" className="ml-auto">
                3% du CA a gagner
              </Badge>
            </div>

            {/* Countdown */}
            <div className="flex items-center justify-center gap-4 py-4">
              {[
                { value: countdown.days, label: 'Jours' },
                { value: countdown.hours, label: 'Heures' },
                { value: countdown.minutes, label: 'Min' },
                { value: countdown.seconds, label: 'Sec' },
              ].map((u) => (
                <div key={u.label} className="text-center">
                  <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                    <span className="text-xl font-bold text-white font-mono tabular-nums">{String(u.value).padStart(2, '0')}</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">{u.label}</p>
                </div>
              ))}
            </div>

            {/* Distribution */}
            <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <p className="text-xs text-white/30 mb-2">Distribution Top 10</p>
              <div className="flex gap-1">
                {DISTRIBUTION.map((pct, i) => (
                  <div key={i} className={cn(
                    'flex-1 text-center py-1 rounded-md text-[10px] font-medium',
                    i === 0 ? 'bg-amber-500/20 text-amber-400' : i < 3 ? 'bg-violet-500/10 text-violet-400' : 'bg-white/[0.03] text-white/30'
                  )}>
                    #{i + 1} {pct}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Clock className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/30">Aucun classement en cours</p>
          </CardContent>
        </Card>
      )}

      {/* Submit video */}
      {activeContest && (
        <Card>
          <CardContent>
            <h2 className="text-sm font-semibold text-white/60 mb-4">Soumettre ta video</h2>
            {hasSubmitted ? (
              <div className="py-6 text-center">
                <Star className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-white/70">Ta video a ete soumise</p>
                <p className="text-xs text-white/30 mt-1">Resultats a la fin du mois</p>
              </div>
            ) : videos.length === 0 ? (
              <EmptyState
                icon={Film}
                title="Aucune video prete"
                description="Cree une video pour pouvoir participer au classement."
                action={{ label: 'Creer une video', onClick: () => window.location.assign('/create') }}
              />
            ) : (
              <div className="space-y-4">
                <select
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  data-testid="classement-video-select"
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer focus:border-violet-500/60 transition-colors"
                >
                  <option value="" className="bg-[#0c0b14]">Choisis ta meilleure video...</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0c0b14]">{v.title ?? 'Sans titre'} ({v.quality})</option>
                  ))}
                </select>
                <Button onClick={handleSubmit} loading={submitting} disabled={!selectedVideo} data-testid="classement-submit-btn">
                  <Send className="h-4 w-4" />
                  Soumettre au classement
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past rankings */}
      {pastContests.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Classements precedents</h2>
          <div className="space-y-4">
            {pastContests.map((c) => (
              <Card key={c.id}>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">{c.period_label}</span>
                    </div>
                    <Badge variant="premium" size="sm">{formatPrice(c.prize_pool_amount)}</Badge>
                  </div>
                  {c.rankings && c.rankings.length > 0 ? (
                    <div className="space-y-1.5">
                      {c.rankings.slice(0, 10).map((r, i) => {
                        const Icon = RANK_ICONS[i] ?? Star
                        const color = RANK_COLORS[i] ?? 'text-white/30'
                        return (
                          <div key={r.user_id} className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg',
                            i < 3 ? 'bg-white/[0.02]' : ''
                          )}>
                            <Icon className={cn('h-4 w-4', color)} />
                            <span className="flex-1 text-sm text-white/60">{r.name}</span>
                            <span className="text-xs text-white/30 font-mono">{r.score} pts</span>
                            <span className="text-xs font-medium text-emerald-400">{formatPrice(r.prize)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 text-center py-4">Pas de classement disponible</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
