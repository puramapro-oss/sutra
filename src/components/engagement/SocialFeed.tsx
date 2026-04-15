'use client'

import { useEffect, useState } from 'react'
import { Trophy, Flame, Sparkles, Crown, Award } from 'lucide-react'

type FeedEvent = {
  id: string
  event_type: string
  display_name: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const EVENT_CONFIG: Record<string, { icon: typeof Trophy; label: (name: string, meta: Record<string, unknown> | null) => string; accent: string }> = {
  tier_bronze:   { icon: Award,    label: (n) => `${n} a atteint le palier Bronze`,   accent: 'text-amber-600' },
  tier_silver:   { icon: Award,    label: (n) => `${n} a atteint le palier Argent`,   accent: 'text-slate-300' },
  tier_gold:     { icon: Trophy,   label: (n) => `${n} a atteint le palier Or`,       accent: 'text-amber-400' },
  tier_platinum: { icon: Trophy,   label: (n) => `${n} a atteint le palier Platine`,  accent: 'text-cyan-300' },
  tier_diamond:  { icon: Sparkles, label: (n) => `${n} brille en Diamant`,            accent: 'text-sky-300' },
  tier_legend:   { icon: Crown,    label: (n) => `${n} est devenu Légende`,           accent: 'text-violet-300' },
  tier_titan:    { icon: Crown,    label: (n) => `${n} a rejoint les Titans`,         accent: 'text-fuchsia-300' },
  tier_god:      { icon: Crown,    label: (n) => `${n} a atteint le rang Dieu`,       accent: 'text-yellow-300' },
  tier_eternal:  { icon: Sparkles, label: (n) => `${n} est Éternel`,                  accent: 'text-white' },
  first_withdrawal: { icon: Sparkles, label: (n) => `${n} vient de faire son premier retrait`, accent: 'text-emerald-300' },
  mode_power:    { icon: Flame,    label: (n) => `${n} est passé en mode Power`,      accent: 'text-orange-300' },
  mode_titan:    { icon: Flame,    label: (n) => `${n} est passé en mode Titan`,      accent: 'text-red-300' },
  mode_eternal:  { icon: Flame,    label: (n) => `${n} est passé en mode Éternel`,    accent: 'text-pink-300' },
  score_milestone: { icon: Trophy, label: (n, m) => `${n} a atteint ${String(m?.score ?? '')} / 1000 au Purama Score`, accent: 'text-emerald-400' },
  season_winner: { icon: Crown,    label: (n, m) => `${n} a gagné la saison ${String(m?.season ?? '')}`, accent: 'text-violet-300' },
  streak_milestone: { icon: Flame, label: (n, m) => `${n} maintient son streak depuis ${String(m?.days ?? '')} jours`, accent: 'text-amber-300' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

export function SocialFeed({ limit = 8 }: { limit?: number }) {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/social-feed')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEvents((d?.events ?? []).slice(0, limit)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [limit])

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-2">Activité communauté</h3>
        <p className="text-sm text-white/55">Aucune activité pour le moment. Sois le premier à débloquer un palier.</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Activité communauté</h3>
      <div className="space-y-3">
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.event_type] ?? EVENT_CONFIG.tier_bronze
          const Icon = cfg.icon
          return (
            <div key={ev.id} className="flex items-start gap-3 text-sm">
              <div className={`shrink-0 w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center ${cfg.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white/90 truncate">{cfg.label(ev.display_name, ev.metadata)}</div>
                <div className="text-xs text-white/45">{relativeTime(ev.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
