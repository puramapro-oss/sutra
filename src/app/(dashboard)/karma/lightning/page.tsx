'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Zap, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Deal {
  id: string
  title: string
  action_label: string
  action_type: string
  seeds_reward: number
  starts_at: string
  ends_at: string
  max_claimers: number
  claimers_count: number
  already_claimed: boolean
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const mins = Math.floor(diff / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export default function LightningPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/karma/games/lightning', { cache: 'no-store' })
      if (res.status === 401) return
      const data = await res.json()
      setDeals(data.deals ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh countdown every second
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // Reload every 30s
  useEffect(() => {
    const i = setInterval(load, 30000)
    return () => clearInterval(i)
  }, [load])

  const claim = async (id: string) => {
    setClaiming(id)
    try {
      const res = await fetch('/api/karma/games/lightning/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      toast.success(data.message)
      await load()
    } finally {
      setClaiming(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 pb-20 lg:pb-10">
      <div>
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link href="/karma" className="hover:text-white">KARMA</Link>
          <span>·</span>
          <span className="text-white/80">Lightning Deals</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white">Lightning Deals ⚡</h1>
        <p className="mt-1 text-sm text-white/60">
          Deals flash de 10 minutes. 1er arrivé, 1er servi. 100 graines garanties par claim.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : deals.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <Zap className="mx-auto h-10 w-10 text-white/30" />
          <p className="mt-3 text-sm text-white/60">
            Aucun deal actif. Garde un œil ouvert — ils apparaissent toutes les quelques heures.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-tick={tick}>
          {deals.map(d => {
            const left = timeLeft(d.ends_at)
            const expired = left === 'Expiré'
            const full = d.claimers_count >= d.max_claimers
            const disabled = d.already_claimed || expired || full || claiming === d.id
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-2xl border p-5',
                  d.already_claimed ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-yellow-500/5'
                )}
                data-testid={`lightning-deal-${d.id}`}
              >
                <div className="flex items-start gap-3">
                  <Zap className="mt-1 h-6 w-6 shrink-0 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
                  <div>
                    <p className="text-base font-semibold text-white">{d.title}</p>
                    <p className="mt-0.5 text-xs text-white/60">
                      +{d.seeds_reward} 🌱 · {d.claimers_count}/{d.max_claimers} pris
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    'font-mono text-sm',
                    expired ? 'text-red-400' : 'text-amber-200'
                  )}>
                    {left}
                  </span>
                  <button
                    type="button"
                    onClick={() => claim(d.id)}
                    disabled={disabled}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition',
                      d.already_claimed
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : 'bg-white text-black hover:bg-white/90 disabled:opacity-40'
                    )}
                  >
                    {claiming === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : d.already_claimed ? (
                      <>
                        <Check className="h-3 w-3" />
                        Claim OK
                      </>
                    ) : full ? (
                      'Complet'
                    ) : (
                      d.action_label
                    )}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
