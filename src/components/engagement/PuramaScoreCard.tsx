'use client'

import { useEffect, useState } from 'react'

type Breakdown = {
  score: number
  nature_score: number
  streak_score: number
  filleuls_score: number
  marketplace_score: number
  missions_score: number
}

const ROWS = [
  { key: 'nature_score',       label: 'Nature',      max: 300, color: 'bg-emerald-400' },
  { key: 'streak_score',       label: 'Streak',      max: 200, color: 'bg-amber-400' },
  { key: 'filleuls_score',     label: 'Filleuls',    max: 200, color: 'bg-violet-400' },
  { key: 'marketplace_score',  label: 'Marketplace', max: 150, color: 'bg-cyan-400' },
  { key: 'missions_score',     label: 'Missions',    max: 150, color: 'bg-pink-400' },
] as const

export function PuramaScoreCard() {
  const [data, setData] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/purama-score')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-4" />
        <div className="h-24 bg-white/5 rounded" />
      </div>
    )
  }

  if (!data) return null

  const pct = (data.score / 1000) * 100

  return (
    <div className="glass-card p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold">Purama Score</h3>
        <div className="font-mono text-sm text-white/60">{data.score} / 1 000</div>
      </div>

      <div className="relative h-3 rounded-full bg-white/10 overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {ROWS.map((r) => {
          const value = (data[r.key as keyof Breakdown] as number) ?? 0
          const pctRow = (value / r.max) * 100
          return (
            <div key={r.key} className="flex items-center gap-3 text-sm">
              <span className="w-28 text-white/70">{r.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${r.color}`} style={{ width: `${pctRow}%` }} />
              </div>
              <span className="w-14 text-right font-mono text-xs text-white/60">
                {value}/{r.max}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-white/50">
        Ton Purama Score détermine ton rang au classement, ton cashback carte et ton accès aux missions premium.
      </p>
    </div>
  )
}
