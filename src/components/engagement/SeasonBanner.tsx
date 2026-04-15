'use client'

import { getCurrentSeason, getDaysUntilSeasonEnd } from '@/lib/seasons'

export function SeasonBanner() {
  const season = getCurrentSeason()
  const daysLeft = getDaysUntilSeasonEnd()

  return (
    <div
      className="glass-card p-5 relative overflow-hidden"
      style={{ borderColor: `${season.color}40` }}
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${season.color}, transparent 60%)` }}
      />
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-white/60">{season.period}</div>
          <div className="text-2xl font-bold mt-0.5" style={{ color: season.color }}>
            {season.emoji} {season.display}
          </div>
          <p className="text-sm text-white/70 mt-1">
            Top 1% = 500 € • Top 5% = 200 € • Top 10% = 100 €
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">Fin dans</div>
          <div className="text-xl font-bold font-mono">{daysLeft} j</div>
        </div>
      </div>
    </div>
  )
}
