'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, Users, TrendingUp, Wallet, ExternalLink, Info } from 'lucide-react'
import { AmbassadorTierBadge } from '@/components/engagement/AmbassadorTierBadge'
import { AMBASSADOR_TIERS } from '@/lib/ambassador'

interface Stats {
  filleuls_count: number
  total_earned: number
  pending_amount: number
  wallet_balance: number
}

export default function AmbassadorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data)
        else setStats({ filleuls_count: 0, total_earned: 0, pending_amount: 0, wallet_balance: 0 })
      })
      .catch(() =>
        setStats({ filleuls_count: 0, total_earned: 0, pending_amount: 0, wallet_balance: 0 })
      )
  }, [])

  const filleuls = stats?.filleuls_count ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs font-semibold mb-3">
          <Crown className="h-3.5 w-3.5" />
          Programme Ambassadeur
        </div>
        <h1
          data-testid="ambassador-page-title"
          className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]"
        >
          Ton parcours d&apos;Ambassadeur
        </h1>
        <p className="text-sm text-white/50 mt-1">
          9 paliers. 3 niveaux de commissions. Primes à vie.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Filleuls actifs"
          value={filleuls.toString()}
          testid="stat-filleuls"
        />
        <StatCard
          icon={Wallet}
          label="Gains cumulés"
          value={`${(stats?.total_earned ?? 0).toFixed(2)} €`}
          testid="stat-total-earned"
        />
        <StatCard
          icon={TrendingUp}
          label="En attente"
          value={`${(stats?.pending_amount ?? 0).toFixed(2)} €`}
          testid="stat-pending"
        />
      </div>

      <AmbassadorTierBadge filleulsCount={filleuls} />

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-violet-300" />
          <h2 className="text-lg font-semibold text-white">Comment ça marche</h2>
        </div>
        <ul className="space-y-3 text-sm text-white/75">
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span>
              Partage ton lien unique — chaque filleul qui s&apos;abonne te rapporte{' '}
              <strong className="text-violet-200">50 % du premier paiement</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center justify-center">
              2
            </span>
            <span>
              Ensuite tu touches <strong className="text-violet-200">50 % / 15 % / 7 %</strong> sur
              chaque mois payé par ton filleul, son filleul et le filleul de son filleul.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span>
              À chaque palier (Bronze → Éternel), on te verse une{' '}
              <strong className="text-amber-200">prime automatique</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-200 text-xs font-bold flex items-center justify-center">
              4
            </span>
            <span className="text-white/60">
              Anti-fraude : la commission se déclenche après 30 jours d&apos;activité réelle du
              filleul.
            </span>
          </li>
        </ul>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Tous les paliers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AMBASSADOR_TIERS.map((tier) => {
            const unlocked = filleuls >= tier.filleuls_required
            return (
              <div
                key={tier.level}
                className={`p-4 rounded-xl border ${
                  unlocked
                    ? 'bg-amber-500/10 border-amber-400/40'
                    : 'bg-white/[0.02] border-white/10'
                }`}
                data-testid={`tier-card-${tier.name}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`font-semibold text-sm ${unlocked ? 'text-amber-200' : 'text-white/70'}`}
                  >
                    {tier.display}
                  </span>
                  {unlocked && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-300">
                      Débloqué
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-white tabular-nums">
                  {tier.prime_eur.toLocaleString('fr-FR')} €
                </div>
                <div className="text-xs text-white/50 mt-0.5">
                  {tier.filleuls_required.toLocaleString('fr-FR')} filleul
                  {tier.filleuls_required > 1 ? 's' : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/referral"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-semibold hover:from-violet-400 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/20"
        >
          Mon arbre de parrainage
        </Link>
        <Link
          href="/devenir-ambassadeur"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Candidater au programme officiel
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  testid,
}: {
  icon: typeof Users
  label: string
  value: string
  testid: string
}) {
  return (
    <div className="glass-card p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <Icon className="h-5 w-5 text-violet-200" />
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-wide text-white/50 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
    </div>
  )
}
