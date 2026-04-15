'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Wallet, Sparkles } from 'lucide-react'

type Stats = {
  active_users: number
  total_distributed_eur: number
  avg_per_user_eur: number
  daily_bonus_per_referral: number
}

export function Flywheel() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/flywheel')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <section className="my-12 md:my-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="glass-card p-6 md:p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-4xl font-bold">Plus on est nombreux, plus chacun gagne</h2>
            <p className="text-white/60 mt-2 text-sm md:text-base">
              Les gains viennent de la communauté active. Voici où on en est aujourd'hui.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <Metric icon={Users}     value={stats.active_users.toLocaleString('fr-FR')} label="Membres actifs" />
            <Metric icon={Wallet}    value={`${stats.total_distributed_eur.toLocaleString('fr-FR')} €`} label="Distribués cette année" />
            <Metric icon={Sparkles}  value={`${stats.avg_per_user_eur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`} label="Moyenne par membre" />
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:opacity-90 transition"
            >
              Inviter un ami → +{stats.daily_bonus_per_referral.toFixed(2)} €/jour
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Metric({ icon: Icon, value, label }: { icon: typeof Users; value: string; label: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 text-center">
      <Icon className="w-6 h-6 mx-auto text-[var(--color-accent)] mb-3" />
      <div className="text-3xl md:text-4xl font-bold font-mono tabular-nums">{value}</div>
      <div className="text-xs md:text-sm text-white/60 mt-1">{label}</div>
    </div>
  )
}
