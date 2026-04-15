'use client'

import { AMBASSADOR_TIERS, getCurrentTier, getNextTier } from '@/lib/ambassador'

export function AmbassadorTierBadge({ filleulsCount }: { filleulsCount: number }) {
  const current = getCurrentTier(filleulsCount)
  const next = getNextTier(filleulsCount)

  const currentIdx = current ? AMBASSADOR_TIERS.indexOf(current) : -1
  const progressStart = current?.filleuls_required ?? 0
  const progressEnd = next?.filleuls_required ?? (current?.filleuls_required ?? 10)
  const progressPct = next
    ? ((filleulsCount - progressStart) / (progressEnd - progressStart)) * 100
    : 100

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Palier ambassadeur</h3>
          <div className="mt-1 text-2xl font-bold">
            {current ? `${current.display} ✨` : 'Aucun palier encore'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">Filleuls actifs</div>
          <div className="text-2xl font-bold font-mono">{filleulsCount}</div>
        </div>
      </div>

      {next && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Prochain palier : <strong>{next.display}</strong> ({next.prime_eur.toLocaleString('fr-FR')} €)</span>
            <span className="font-mono text-white/60">
              {filleulsCount} / {next.filleuls_required}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-violet-400 transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
          <p className="text-xs text-white/50">
            Plus que <strong className="text-white/80">{Math.max(0, next.filleuls_required - filleulsCount)}</strong> filleul{next.filleuls_required - filleulsCount > 1 ? 's' : ''} pour débloquer {next.prime_eur.toLocaleString('fr-FR')} € de prime.
          </p>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-[10px]">
        {AMBASSADOR_TIERS.map((t, i) => (
          <div
            key={t.level}
            className={`p-2 rounded-lg border ${
              i <= currentIdx
                ? 'bg-amber-400/15 border-amber-400/40 text-amber-200'
                : 'bg-white/[0.02] border-white/10 text-white/40'
            }`}
          >
            <div className="font-semibold">{t.display}</div>
            <div className="font-mono text-[9px]">{t.filleuls_required}+</div>
          </div>
        ))}
      </div>
    </div>
  )
}
