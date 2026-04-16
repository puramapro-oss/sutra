'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Crown, Sparkles, ArrowRight } from 'lucide-react'
import { AMBASSADOR_TIERS, getCurrentTier, getNextTier } from '@/lib/ambassador'

export function AmbassadorBlock() {
  const router = useRouter()
  const [filleulsCount, setFilleulsCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.filleuls_count === 'number') {
          setFilleulsCount(data.filleuls_count)
        } else {
          setFilleulsCount(0)
        }
      })
      .catch(() => setFilleulsCount(0))
  }, [])

  if (filleulsCount === null) return null

  const currentTier = getCurrentTier(filleulsCount)
  const nextTier = getNextTier(filleulsCount)
  const currentIdx = currentTier ? AMBASSADOR_TIERS.indexOf(currentTier) : -1

  const progressStart = currentTier?.filleuls_required ?? 0
  const progressEnd = nextTier?.filleuls_required ?? progressStart
  const progressRange = progressEnd - progressStart
  const progressPct = nextTier && progressRange > 0
    ? ((filleulsCount - progressStart) / progressRange) * 100
    : 100

  return (
    <motion.section
      data-testid="bloc-ambassadeur"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="glass-card p-5 sm:p-6 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(139, 92, 246, 0.08))',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            'radial-gradient(600px circle at 80% 0%, rgba(251, 191, 36, 0.18), transparent 60%)',
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-600/30 border border-amber-400/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Crown className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base sm:text-lg">
                Deviens Ambassadeur Purama
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                9 paliers — de 200 € à 200 000 €
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/50">Palier actuel</div>
            <div
              data-testid="ambassador-current-tier"
              className={`text-xl sm:text-2xl font-bold ${currentTier ? 'text-amber-200' : 'text-white/70'}`}
            >
              {currentTier?.display ?? 'Démarrage'}
            </div>
          </div>
        </div>

        {nextTier && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between items-baseline gap-2 text-xs">
              <span className="text-white/70">
                Prochain palier : <strong className="text-amber-200">{nextTier.display}</strong>
              </span>
              <span className="font-mono text-white/60 tabular-nums">
                {filleulsCount} / {nextTier.filleuls_required}
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-400 to-violet-400"
              />
            </div>
            <p className="text-[11px] text-white/50 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-300" />
              {Math.max(0, nextTier.filleuls_required - filleulsCount)} filleul
              {nextTier.filleuls_required - filleulsCount > 1 ? 's' : ''} pour débloquer{' '}
              <strong className="text-amber-200">
                {nextTier.prime_eur.toLocaleString('fr-FR')} €
              </strong>{' '}
              de prime.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5 mb-5">
          {AMBASSADOR_TIERS.map((t, i) => (
            <div
              key={t.level}
              className={`p-1.5 rounded-lg border text-center ${
                i <= currentIdx
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-200'
                  : 'bg-white/[0.02] border-white/10 text-white/40'
              }`}
              title={`${t.display} — ${t.filleuls_required} filleuls → ${t.prime_eur.toLocaleString('fr-FR')} €`}
            >
              <div className="text-[10px] font-semibold truncate">{t.display}</div>
              <div className="text-[9px] font-mono">{t.filleuls_required}+</div>
            </div>
          ))}
        </div>

        <button
          data-testid="apply-ambassador"
          onClick={() => router.push('/ambassadeur')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-[#0A0A0F] text-sm font-semibold hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
        >
          Postuler comme Ambassadeur
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.section>
  )
}
