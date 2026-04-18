'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, Loader2, Check, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface QueteState {
  target: number
  reward: number
  current_streak: number
  best_streak: number
  completions_count: number
  last_video_date: string | null
  completed_at: string | null
  progress_percent: number
}

export default function QueteRarePage() {
  const [state, setState] = useState<QueteState | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinging, setPinging] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/quete', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setState(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pingToday = async () => {
    setPinging(true)
    try {
      const res = await fetch('/api/karma/games/quete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      if (data.completed) {
        toast.success(`🕉️ Quête complétée. +${data.seeds_awarded} 🌱`)
      } else if (data.seeds_awarded === 0 && data.message) {
        toast(data.message)
      } else {
        toast.success(`Jour ${data.current_streak}/${data.target} enregistré.`)
      }
      await load()
    } finally {
      setPinging(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 pb-20 lg:pb-10">
      <div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/karma" className="hover:text-white">KARMA</Link>
          <span>·</span>
          <span className="text-white/80">Quête Rare</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">Quête Rare — 21 jours</h1>
        <p className="mt-1 text-sm text-white/60">
          21 jours consécutifs de création. 21&nbsp;000 🌱 à la complétion. Une nouvelle quête redémarre après chaque succès.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : state ? (
        <>
          <div className="rounded-3xl border border-rose-400/30 bg-gradient-to-br from-rose-500/10 to-orange-500/5 p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-rose-200/70">Streak actuel</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="font-mono text-5xl font-bold text-white">{state.current_streak}</span>
                  <span className="mb-2 text-xl text-white/50">/ {state.target}</span>
                </div>
                <p className="mt-2 text-xs text-white/60">
                  Meilleur : {state.best_streak} · Complétions : {state.completions_count}
                </p>
              </div>
              <Flame className="h-16 w-16 text-orange-400 drop-shadow-[0_0_16px_rgba(251,146,60,0.5)]" />
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-rose-400 to-orange-400"
                initial={{ width: 0 }}
                animate={{ width: `${state.progress_percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-2 text-xs text-white/60">
              {state.progress_percent}% vers la complétion
            </p>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 21 }).map((_, i) => {
              const done = i < state.current_streak
              return (
                <div
                  key={i}
                  className={cn(
                    'aspect-square rounded-lg border flex items-center justify-center text-xs font-mono',
                    done
                      ? 'border-rose-400/40 bg-rose-400/20 text-rose-100'
                      : 'border-white/10 bg-white/[0.02] text-white/30'
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={pingToday}
            disabled={pinging}
            data-testid="quete-ping"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-400 to-orange-400 px-8 py-3 text-base font-semibold text-black transition hover:shadow-[0_0_32px_rgba(251,146,60,0.4)] disabled:opacity-50"
          >
            {pinging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            Marquer ma création du jour
          </button>

          <p className="text-xs text-white/40">
            Tu peux brancher cette action sur ton flow de création vidéo (appel auto après upload).
          </p>
        </>
      ) : null}
    </div>
  )
}
