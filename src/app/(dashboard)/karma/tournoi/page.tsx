'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Loader2 } from 'lucide-react'
import { PILIERS } from '@/lib/karma-piliers'
import { cn } from '@/lib/utils'

interface Scores {
  mental: number; corps: number; social: number; impact: number
  vision: number; consistance: number; innovation: number
}
interface LeaderRow {
  rank: number
  user_id: string
  profile: { full_name: string | null; avatar: string | null }
  total_score: number
  scores: Scores
}
interface MyScore {
  total_score: number
  score_mental: number
  score_corps: number
  score_social: number
  score_impact: number
  score_vision: number
  score_consistance: number
  score_innovation: number
  rank_computed: number
}

export default function TournoiPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [myScore, setMyScore] = useState<MyScore | null>(null)
  const [period, setPeriod] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/tournoi', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setLeaderboard(data.leaderboard ?? [])
      setMyScore(data.my_score ?? null)
      setPeriod(data.period_month ?? '')
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const monthLabel = period
    ? new Date(period).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-20 lg:pb-10">
      <div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/karma" className="hover:text-white">KARMA</Link>
          <span>·</span>
          <span className="text-white/80">Tournoi Karma</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">Tournoi Karma</h1>
        <p className="mt-1 text-sm text-white/60">
          Mensuel. Score sur 7 piliers créatifs. Top 100 récompensés.
        </p>
        {monthLabel && (
          <p className="mt-1 text-xs uppercase tracking-wider text-amber-300/80">Période : {monthLabel}</p>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PILIERS.map(p => (
          <div key={p.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-semibold text-white">{p.label}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/60">{p.description}</p>
            {myScore && (
              <p className="mt-2 font-mono text-sm text-emerald-300">
                {(myScore[`score_${p.key}` as keyof MyScore] as number) ?? 0} pts
              </p>
            )}
          </div>
        ))}
      </section>

      {myScore && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-200/70">Mon classement</p>
              <p className="mt-1 text-3xl font-bold text-white">
                {myScore.rank_computed > 0 ? `#${myScore.rank_computed}` : 'Hors top 100'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-amber-200/70">Score total</p>
              <p className="mt-1 font-mono text-3xl font-bold text-white">{myScore.total_score}</p>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/70">
          <Trophy className="h-4 w-4 text-amber-300" /> Top 100 du mois
        </div>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="mt-4 text-sm text-white/50">
            Pas encore de score ce mois-ci. Publie une vidéo, invite un·e créateur·rice, le tournoi commence.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {leaderboard.map(row => (
              <div
                key={row.user_id}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4',
                  row.rank <= 3 && 'border-amber-400/30 bg-amber-400/5',
                  row.rank > 3 && row.rank <= 10 && 'border-emerald-400/20'
                )}
                data-testid={`tournoi-rank-${row.rank}`}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm',
                    row.rank === 1 && 'bg-amber-400 text-black',
                    row.rank === 2 && 'bg-gray-300 text-black',
                    row.rank === 3 && 'bg-amber-700 text-white',
                    row.rank > 3 && 'bg-white/5 text-white/80'
                  )}>
                    {row.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {row.profile.full_name ?? 'Anonyme'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-white">{row.total_score} pts</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
