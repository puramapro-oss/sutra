'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sprout, Check, Lock, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Mission {
  id: string
  slug: string
  title: string
  description: string
  category: string
  pilier: string
  seeds_reward: number
  verification_type: 'auto' | 'manual' | 'peer'
  max_per_day: number
  max_per_week: number | null
  today_count: number
  week_count: number
  can_complete: boolean
  reason_blocked: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  creation: 'Création',
  sharing: 'Diffusion',
  community: 'Communauté',
  mastery: 'Maîtrise',
  consistency: 'Régularité',
}

const CATEGORY_COLOR: Record<string, string> = {
  creation: 'from-fuchsia-500/20 to-purple-500/20 border-fuchsia-400/30',
  sharing: 'from-cyan-500/20 to-blue-500/20 border-cyan-400/30',
  community: 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30',
  mastery: 'from-amber-500/20 to-orange-500/20 border-amber-400/30',
  consistency: 'from-rose-500/20 to-pink-500/20 border-rose-400/30',
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/missions', { cache: 'no-store' })
      if (res.status === 401) {
        setMissions([])
        return
      }
      const data = await res.json()
      setMissions(data.missions ?? [])
    } catch {
      toast.error('Impossible de charger les missions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const complete = async (slug: string) => {
    setCompleting(slug)
    try {
      const res = await fetch('/api/karma/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission_slug: slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur')
        return
      }
      toast.success(data.message)
      await load()
    } catch {
      toast.error('Erreur réseau.')
    } finally {
      setCompleting(null)
    }
  }

  const grouped = missions.reduce<Record<string, Mission[]>>((acc, m) => {
    acc[m.category] = acc[m.category] ?? []
    acc[m.category].push(m)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-20 lg:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Link href="/karma" className="hover:text-white">KARMA</Link>
            <span>·</span>
            <span className="text-white/80">Missions</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Missions créatives</h1>
          <p className="mt-1 text-sm text-white/60">
            Chaque mission t&apos;accorde des graines 🌱. Elles nourrissent ton niveau Sanskrit.
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Chargement…</span>
        </div>
      ) : missions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-white/70">Aucune mission active pour le moment.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, list]) => (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
              {CATEGORY_LABEL[category] ?? category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(m => (
                <motion.div
                  key={m.id}
                  layout
                  className={cn(
                    'relative flex flex-col gap-3 rounded-2xl border p-5 backdrop-blur-xl',
                    'bg-gradient-to-br',
                    CATEGORY_COLOR[m.category] ?? 'from-white/5 to-white/5 border-white/10'
                  )}
                  data-testid={`mission-card-${m.slug}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white">{m.title}</h3>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      <Sprout className="h-3 w-3" />
                      +{m.seeds_reward}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">{m.description}</p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                    <span>
                      Aujourd&apos;hui : {m.today_count}/{m.max_per_day}
                      {m.max_per_week !== null && (
                        <> · Semaine : {m.week_count}/{m.max_per_week}</>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => complete(m.slug)}
                      disabled={!m.can_complete || completing === m.slug}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                        m.can_complete
                          ? 'bg-white text-black hover:bg-white/90'
                          : 'cursor-not-allowed bg-white/5 text-white/40'
                      )}
                      data-testid={`mission-complete-${m.slug}`}
                    >
                      {completing === m.slug ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : m.can_complete ? (
                        <>
                          <Check className="h-3 w-3" />
                          Valider
                        </>
                      ) : (
                        <>
                          <Lock className="h-3 w-3" />
                          Verrouillée
                        </>
                      )}
                    </button>
                  </div>

                  {!m.can_complete && m.reason_blocked && (
                    <p className="text-xs italic text-white/40">{m.reason_blocked}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
