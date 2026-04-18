'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Upload, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Creator {
  full_name: string | null
  avatar: string | null
}
interface Submission {
  id: string
  user_id: string
  video_url: string
  thumbnail_url: string | null
  caption: string | null
  votes_count: number
  is_winner: boolean
  seeds_awarded: number
  submitted_at: string
  creator: Creator
}
interface Defi {
  id: string
  week_start: string
  week_end: string
  theme: string
  description: string
  pool_seeds: number
  winners_count: number
  status: string
}
interface DefiResponse {
  defi: Defi | null
  submissions: Submission[]
  my_submission: { id: string; video_url: string; votes_count: number; is_winner: boolean } | null
}

function daysLeft(weekEnd: string): number {
  const end = new Date(weekEnd + 'T23:59:59')
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

export default function DefiCollectifPage() {
  const [state, setState] = useState<DefiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/defi', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setState(data)
    } catch {
      toast.error('Impossible de charger le défi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoUrl) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/karma/games/defi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl, caption: caption || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur')
        return
      }
      toast.success(data.message)
      setVideoUrl('')
      setCaption('')
      await load()
    } catch {
      toast.error('Erreur réseau.')
    } finally {
      setSubmitting(false)
    }
  }

  const defi = state?.defi
  const subs = state?.submissions ?? []
  const my = state?.my_submission

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-20 lg:pb-10">
      <div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/karma" className="hover:text-white">KARMA</Link>
          <span>·</span>
          <span className="text-white/80">Défi Collectif</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">Défi Collectif</h1>
        <p className="mt-1 text-sm text-white/60">
          Un thème par semaine. Top 10 partagent la cagnotte de graines.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : !defi ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/70">
          Aucun défi ouvert. Reviens lundi prochain.
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-6 sm:p-8"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-200/70">Thème de la semaine</p>
                <h2 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{defi.theme}</h2>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/70">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50">Cagnotte</p>
                  <p className="font-mono text-lg font-semibold text-emerald-300">
                    {defi.pool_seeds.toLocaleString('fr-FR')} 🌱
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50">Clôture</p>
                  <p className="font-mono text-lg font-semibold text-white">
                    J-{daysLeft(defi.week_end)}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/80">{defi.description}</p>
          </motion.div>

          {my ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
              <p className="text-xs uppercase tracking-wider text-emerald-200/70">Ta soumission</p>
              <p className="mt-2 text-sm text-white/80 break-all">{my.video_url}</p>
              <p className="mt-1 text-xs text-white/60">
                {my.votes_count} vote{my.votes_count > 1 ? 's' : ''} ·{' '}
                {my.is_winner ? 'Gagnante ✨' : 'En compétition'}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-3">
              <label className="block text-xs uppercase tracking-wider text-white/50">
                Soumettre ma vidéo
              </label>
              <input
                type="url"
                required
                placeholder="https://…"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none"
                data-testid="defi-video-url"
              />
              <textarea
                placeholder="Une phrase pour contextualiser (optionnel, 280 caractères max)"
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none resize-none"
              />
              <button
                type="submit"
                disabled={submitting || !videoUrl}
                className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-40"
                data-testid="defi-submit-button"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Soumettre (+25 🌱)
              </button>
            </form>
          )}

          <section>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/70">
              <Trophy className="h-4 w-4 text-amber-300" />
              Classement en direct
            </div>
            <div className="mt-4 space-y-2">
              {subs.length === 0 ? (
                <p className="text-sm text-white/50">Aucune soumission. Sois le premier.</p>
              ) : (
                subs.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-cyan-400/30',
                      i < 3 && 'border-amber-400/30 bg-amber-400/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-mono text-sm text-white/80">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">
                          {s.creator.full_name ?? 'Anonyme'}
                        </p>
                        <a
                          href={s.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-white/50 hover:text-cyan-300"
                        >
                          {s.video_url}
                        </a>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-white/80">{s.votes_count} ❤︎</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
