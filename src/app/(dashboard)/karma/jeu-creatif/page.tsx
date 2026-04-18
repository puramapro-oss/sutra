'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Submission {
  id: string
  user_id: string
  title: string
  prompt: string
  video_url: string
  thumbnail_url: string | null
  votes_count: number
  closes_at: string
  creator: { full_name: string | null }
  has_voted: boolean
}

function timeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return 'Clos'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${mins}m`
}

export default function JeuCreatifPage() {
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [voting, setVoting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/creatif', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setSubs(data.submissions ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/karma/games/creatif', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, prompt, video_url: videoUrl }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success(data.message)
    setTitle(''); setPrompt(''); setVideoUrl(''); setShowForm(false)
    await load()
  }

  const vote = async (id: string) => {
    setVoting(id)
    try {
      const res = await fetch('/api/karma/games/creatif/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      toast.success('Vote enregistré.')
      await load()
    } finally {
      setVoting(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 pb-20 lg:pb-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Link href="/karma" className="hover:text-white">KARMA</Link>
            <span>·</span>
            <span className="text-white/80">Jeu Créatif</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-white">Jeu Créatif</h1>
          <p className="mt-1 text-sm text-white/60">
            Soumets ta vidéo. La communauté vote pendant 48h. Les plus votées gagnent des graines.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(s => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-fuchsia-300"
          data-testid="creatif-show-form"
        >
          <Plus className="h-4 w-4" />
          Soumettre
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <input
            type="text" required maxLength={120} placeholder="Titre"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-fuchsia-400 focus:outline-none"
          />
          <textarea
            required maxLength={500} rows={2} placeholder="Prompt utilisé"
            value={prompt} onChange={e => setPrompt(e.target.value)}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-fuchsia-400 focus:outline-none"
          />
          <input
            type="url" required placeholder="URL vidéo"
            value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-white focus:border-fuchsia-400 focus:outline-none"
          />
          <button type="submit" className="rounded-full bg-fuchsia-400 px-6 py-2 text-sm font-semibold text-black hover:bg-fuchsia-300">
            Publier (vote 48h)
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-white/50">Aucune vidéo en compétition. Sois le premier.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subs.map(s => (
            <div key={s.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div>
                <p className="text-xs text-white/50">par {s.creator.full_name ?? 'Anonyme'}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{s.title}</h3>
              </div>
              <p className="text-xs italic text-white/60 line-clamp-2">&laquo; {s.prompt} &raquo;</p>
              <a
                href={s.video_url} target="_blank" rel="noopener noreferrer"
                className="truncate text-xs text-cyan-300 hover:text-cyan-200"
              >
                Voir la vidéo →
              </a>
              <div className="mt-auto flex items-center justify-between gap-2 text-xs">
                <span className="text-white/50">Clôt dans {timeLeft(s.closes_at)}</span>
                <button
                  type="button"
                  onClick={() => vote(s.id)}
                  disabled={s.has_voted || voting === s.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    s.has_voted
                      ? 'bg-rose-400/20 text-rose-200'
                      : 'bg-white text-black hover:bg-white/90 disabled:opacity-50'
                  )}
                  data-testid={`creatif-vote-${s.id}`}
                >
                  {voting === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Heart className={cn('h-3 w-3', s.has_voted && 'fill-current')} />
                  )}
                  {s.votes_count}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
