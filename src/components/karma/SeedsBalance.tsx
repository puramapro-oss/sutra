'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
import { useSeeds } from '@/hooks/useSeeds'
import { LEVEL_EMOJI } from '@/lib/karma-level'
import { cn } from '@/lib/utils'

interface SeedsBalanceProps {
  variant?: 'compact' | 'full'
  className?: string
}

export function SeedsBalance({ variant = 'compact', className }: SeedsBalanceProps) {
  const { balance, level, progress_percent, next_level, next_level_threshold, loading } = useSeeds()

  const levelName = level as keyof typeof LEVEL_EMOJI
  const emoji = LEVEL_EMOJI[levelName] ?? '🌱'

  if (variant === 'compact') {
    return (
      <Link
        href="/karma"
        data-testid="seeds-balance-compact"
        aria-label={`Graines KARMA : ${balance}, niveau ${level}`}
        className={cn(
          'group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/90 transition hover:border-emerald-400/40 hover:bg-emerald-400/10',
          className
        )}
      >
        <Sprout className="h-4 w-4 text-emerald-400" />
        <span className="font-mono tabular-nums">
          {loading ? '…' : balance.toLocaleString('fr-FR')}
        </span>
        <span className="text-xs text-white/50">{emoji}</span>
      </Link>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50">Graines KARMA</p>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-white">
            {loading ? '—' : balance.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-3xl leading-none">{emoji}</span>
          <span className="text-sm font-medium text-white/90">{level}</span>
        </div>
      </div>

      {next_level && next_level_threshold && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>
              Vers <span className="text-white/90">{next_level}</span>
            </span>
            <span className="font-mono tabular-nums">{progress_percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress_percent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            Seuil : {next_level_threshold.toLocaleString('fr-FR')} graines cumulées
          </p>
        </div>
      )}

      {!next_level && (
        <p className="mt-5 text-sm italic text-emerald-300">
          Niveau maximum atteint. Rare. ✨
        </p>
      )}
    </motion.div>
  )
}
