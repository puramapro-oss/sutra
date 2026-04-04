'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Play, Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'

const supabase = createClient()

interface Contest {
  id: string
  type: string
  period_label: string
  status: string
  prize_pool_amount: number
  total_submissions: number
  rankings: { user_id: string; name: string; score: number; prize: number; rank: number }[] | null
  period_end: string
}

interface Submission {
  id: string
  user_id: string
  title: string | null
  ai_score: number | null
  status: string
  created_at: string
  content_data: Record<string, number> | null
}

export default function AdminClassementPage() {
  const [contests, setContests] = useState<Contest[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [contestsRes, subsRes] = await Promise.all([
      supabase.from('contests').select('*').eq('type', 'monthly').order('created_at', { ascending: false }).limit(10),
      supabase.from('contest_submissions').select('*').order('ai_score', { ascending: false }).limit(50),
    ])
    setContests((contestsRes.data ?? []) as Contest[])
    setSubmissions((subsRes.data ?? []) as Submission[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const triggerJudge = async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/cron/contest-judge')
      const data = await res.json()
      if (data.status === 'judged') {
        toast.success(`Classement termine — ${data.submissions} soumissions evaluees`)
      } else if (data.status === 'no_contest_to_judge') {
        toast.info('Aucun concours a juger')
      } else {
        toast.error(data.error ?? 'Erreur')
      }
      fetchData()
    } catch {
      toast.error('Erreur lors du declenchement')
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <div className="text-center py-20 text-white/30">Chargement...</div>

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Classement Purama Impact</h2>
        <Button onClick={triggerJudge} loading={triggering} variant="outline" size="sm" data-testid="trigger-judge">
          <Play className="h-4 w-4" />
          Declencher evaluation
        </Button>
      </div>

      {/* Contests */}
      <div className="space-y-4">
        {contests.map((c) => (
          <Card key={c.id}>
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-white">{c.period_label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === 'open' ? 'info' : 'success'} size="sm">
                    {c.status === 'open' ? 'En cours' : 'Termine'}
                  </Badge>
                  <span className="text-xs text-white/30">{c.total_submissions} soumissions</span>
                  <span className="text-xs text-emerald-400 font-medium">{formatPrice(c.prize_pool_amount)}</span>
                </div>
              </div>
              {c.rankings && c.rankings.length > 0 && (
                <div className="space-y-1">
                  {c.rankings.slice(0, 5).map((r, i) => (
                    <div key={r.user_id} className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.02] text-sm">
                      <span className={cn('font-bold w-6', i === 0 ? 'text-amber-400' : 'text-white/30')}>#{r.rank}</span>
                      <span className="flex-1 text-white/60">{r.name}</span>
                      <span className="text-white/30 font-mono">{r.score} pts</span>
                      <span className="text-emerald-400 font-medium">{formatPrice(r.prize)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submissions */}
      <div>
        <h3 className="text-sm font-semibold text-white/60 mb-3">Soumissions recentes</h3>
        {submissions.length === 0 ? (
          <EmptyState icon={Star} title="Aucune soumission" description="Les soumissions apparaitront ici." />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Titre</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Score IA</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Details</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-3 text-sm text-white/70">{s.title ?? 'Sans titre'}</td>
                      <td className="px-4 py-3 text-sm font-bold text-violet-400">{s.ai_score ?? '-'}/100</td>
                      <td className="px-4 py-3 text-xs text-white/30 font-mono">
                        {s.content_data ? Object.entries(s.content_data).map(([k, v]) => `${k}:${v}`).join(' ') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === 'judged' ? 'success' : 'default'} size="sm">{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/40">{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
