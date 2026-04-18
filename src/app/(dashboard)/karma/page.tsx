'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Sprout, Target, Zap, Trophy, Heart, Waves, Flame, CircleDashed,
} from 'lucide-react'
import { SeedsBalance } from '@/components/karma/SeedsBalance'
import { useSeeds } from '@/hooks/useSeeds'
import { cn } from '@/lib/utils'

interface GameCard {
  href: string
  icon: typeof Target
  title: string
  description: string
  color: string
  testId: string
}

const GAMES: GameCard[] = [
  {
    href: '/karma/missions',
    icon: Target,
    title: 'Missions créatives',
    description: '15 missions. Rythme, partage, maîtrise. Graines garanties.',
    color: 'from-violet-500/20 to-purple-500/10 border-violet-400/30',
    testId: 'karma-card-missions',
  },
  {
    href: '/karma/dharma',
    icon: CircleDashed,
    title: 'Roue du Dharma',
    description: '1 tour par jour. Jusqu\'à 1000 graines. 12 segments.',
    color: 'from-emerald-500/20 to-cyan-500/10 border-emerald-400/30',
    testId: 'karma-card-dharma',
  },
  {
    href: '/karma/defi-collectif',
    icon: Heart,
    title: 'Défi Collectif',
    description: 'Thème hebdo. Top 10 partagent 5 000 🌱.',
    color: 'from-cyan-500/20 to-blue-500/10 border-cyan-400/30',
    testId: 'karma-card-defi',
  },
  {
    href: '/karma/tournoi',
    icon: Trophy,
    title: 'Tournoi Karma',
    description: 'Mensuel. 7 piliers. Top 100 récompensés.',
    color: 'from-amber-500/20 to-orange-500/10 border-amber-400/30',
    testId: 'karma-card-tournoi',
  },
  {
    href: '/karma/jeu-creatif',
    icon: Sprout,
    title: 'Jeu Créatif',
    description: 'Vote communautaire 48h. Les plus aimés gagnent.',
    color: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-400/30',
    testId: 'karma-card-creatif',
  },
  {
    href: '/karma/vague',
    icon: Waves,
    title: 'La Vague',
    description: 'Cascade virale. Chaque niveau double les graines.',
    color: 'from-sky-500/20 to-indigo-500/10 border-sky-400/30',
    testId: 'karma-card-vague',
  },
  {
    href: '/karma/quete-rare',
    icon: Flame,
    title: 'Quête Rare',
    description: '21 vidéos consécutives. 21 000 🌱 à la clé.',
    color: 'from-rose-500/20 to-orange-500/10 border-rose-400/30',
    testId: 'karma-card-quete',
  },
  {
    href: '/karma/lightning',
    icon: Zap,
    title: 'Lightning Deals',
    description: 'Deals flash 10 min. Réactivité récompensée.',
    color: 'from-yellow-500/20 to-amber-500/10 border-yellow-400/30',
    testId: 'karma-card-lightning',
  },
]

export default function KarmaHub() {
  const { balance, level, lifetime_earned, transactions, loading } = useSeeds()

  return (
    <div className="mx-auto max-w-7xl space-y-10 p-6 pb-20 lg:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-3xl font-bold text-white sm:text-4xl">KARMA</h1>
        <p className="text-sm text-white/60">
          Graines, niveaux Sanskrit, jeux prosociaux. Ton karma créatif.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <SeedsBalance variant="full" />
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-wider text-white/50">Stats rapides</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-white/70">Solde</dt>
              <dd className="font-mono font-semibold text-white">
                {loading ? '—' : balance.toLocaleString('fr-FR')} 🌱
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-white/70">Cumulé vie</dt>
              <dd className="font-mono text-white/90">
                {loading ? '—' : lifetime_earned.toLocaleString('fr-FR')}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-white/70">Niveau</dt>
              <dd className="text-white/90">{level}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/70">
          Jeux disponibles
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {GAMES.map((g, i) => {
            const Icon = g.icon
            return (
              <motion.div
                key={g.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={g.href}
                  data-testid={g.testId}
                  className={cn(
                    'group flex h-full flex-col gap-3 rounded-2xl border p-5 backdrop-blur-xl transition',
                    'bg-gradient-to-br',
                    g.color,
                    'hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(255,255,255,0.06)]'
                  )}
                >
                  <Icon className="h-6 w-6 text-white" />
                  <h3 className="text-base font-semibold text-white">{g.title}</h3>
                  <p className="text-xs leading-relaxed text-white/70">{g.description}</p>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">
          Dernières transactions
        </h2>
        {loading ? (
          <p className="text-sm text-white/50">Chargement…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-white/50">
            Aucune transaction. Commence par une mission ou la Roue du Dharma.
          </p>
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-white/[0.02]">
            {transactions.slice(0, 10).map(tx => (
              <li key={tx.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-white/90">{tx.reason ?? tx.source}</p>
                  <p className="text-xs text-white/40">{new Date(tx.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <span className={cn(
                  'font-mono font-semibold',
                  tx.direction === 'earn' ? 'text-emerald-300' : 'text-red-300'
                )}>
                  {tx.direction === 'earn' ? '+' : '-'}{tx.amount} 🌱
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
