'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Waves, Plus, Loader2, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Wave {
  id: string
  initiator_id: string
  parent_wave_id: string | null
  level: number
  title: string
  challenge: string
  video_url: string | null
  children_count: number
  seeds_awarded?: number
  expires_at: string
  status: string
  created_at: string
  initiator: { full_name: string | null }
}

interface VagueState {
  top_waves: Wave[]
  my_waves: Wave[]
  seeds_by_level: number[]
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expirée'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  return `${days}j ${hrs}h`
}

export default function VaguePage() {
  const [state, setState] = useState<VagueState | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedParent, setSelectedParent] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [challenge, setChallenge] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/vague', { cache: 'no-store' })
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/karma/games/vague', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_wave_id: selectedParent,
          title,
          challenge,
          video_url: videoUrl || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      toast.success(data.message)
      setTitle(''); setChallenge(''); setVideoUrl(''); setSelectedParent(null); setShowForm(false)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  const seedsForLevel = (lvl: number) => state?.seeds_by_level?.[lvl] ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-20 lg:pb-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Link href="/karma" className="hover:text-white">KARMA</Link>
            <span>·</span>
            <span className="text-white/80">La Vague</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">La Vague</h1>
          <p className="mt-1 text-sm text-white/60">
            Lance ou rejoins. Chaque niveau double les graines. Niveau 10 = 25 600 🌱.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSelectedParent(null); setShowForm(s => !s) }}
          className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-300"
          data-testid="vague-new"
        >
          <Plus className="h-4 w-4" />
          Lancer une vague
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-6">
          {selectedParent && (
            <p className="text-xs text-cyan-200">
              Tu rejoins la vague {selectedParent.slice(0, 8)}… (+{seedsForLevel(
                (state?.top_waves.find(w => w.id === selectedParent)?.level ?? 0) + 1
              )} 🌱)
            </p>
          )}
          <input
            type="text" required maxLength={120} placeholder="Titre de la vague"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
          />
          <textarea
            required maxLength={500} rows={2} placeholder="Défi à reprendre"
            value={challenge} onChange={e => setChallenge(e.target.value)}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
          />
          <input
            type="url" placeholder="URL vidéo (optionnel)"
            value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-cyan-400 focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-2 text-sm font-semibold text-black hover:bg-cyan-300 disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Waves className="h-4 w-4" />}
              {selectedParent ? 'Rejoindre' : 'Lancer'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setSelectedParent(null) }} className="rounded-full border border-white/10 px-6 py-2 text-sm text-white/70 hover:border-white/30">
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/70">
            <TrendingUp className="h-4 w-4 text-cyan-300" />
            Vagues qui montent
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(state?.top_waves ?? []).length === 0 ? (
              <p className="text-sm text-white/50">Aucune vague active. Lance la première.</p>
            ) : (
              state?.top_waves.map(w => (
                <div key={w.id} className={cn(
                  'flex flex-col gap-2 rounded-2xl border bg-white/[0.02] p-5',
                  w.children_count >= 10 ? 'border-cyan-400/40' : 'border-white/10'
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-white/50">par {w.initiator.full_name ?? 'Anonyme'}</p>
                      <h3 className="mt-1 text-base font-semibold text-white">{w.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-cyan-400/20 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                      Niv. {w.level}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">{w.challenge}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                    <span>{w.children_count} relais · {timeLeft(w.expires_at)}</span>
                    <button
                      type="button"
                      onClick={() => { setSelectedParent(w.id); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="rounded-full bg-white text-black px-3 py-1 text-xs font-semibold hover:bg-white/90"
                      data-testid={`vague-join-${w.id}`}
                    >
                      Rejoindre +{seedsForLevel(w.level + 1)} 🌱
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  )
}
