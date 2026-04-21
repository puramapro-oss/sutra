'use client'

import { useEffect, useState } from 'react'
import { Leaf, GraduationCap, TreePine, Users } from 'lucide-react'

type Impact = {
  co2_kg: number
  education_hours: number
  trees_planted: number
  local_producers: number
}

// Calcul dérivé de Nature Rewards : 1€ Nature = 0.5kg CO2 évité, 0.1h éducation,
// 0.05 arbre (20€ = 1 arbre), 0.02 producteur soutenu (50€ = 1 producteur/mois).
function deriveImpact(natureEarnedEur: number): Impact {
  return {
    co2_kg: Math.round(natureEarnedEur * 0.5 * 10) / 10,
    education_hours: Math.round(natureEarnedEur * 0.1 * 10) / 10,
    trees_planted: Math.floor(natureEarnedEur / 20),
    local_producers: Math.floor(natureEarnedEur / 50),
  }
}

const ITEMS: Array<{
  key: keyof Impact
  label: string
  unit: string
  color: string
  icon: typeof Leaf
}> = [
  { key: 'co2_kg',          label: 'CO₂ évité',             unit: 'kg',    color: 'text-emerald-400', icon: Leaf },
  { key: 'education_hours', label: 'Éducation financée',    unit: 'h',     color: 'text-sky-400',     icon: GraduationCap },
  { key: 'trees_planted',   label: 'Arbres plantés',        unit: '',      color: 'text-green-500',   icon: TreePine },
  { key: 'local_producers', label: 'Producteurs soutenus',  unit: '',      color: 'text-amber-400',   icon: Users },
]

export function ImpactDashboard() {
  const [impact, setImpact] = useState<Impact | null>(null)

  useEffect(() => {
    fetch('/api/purama-score')
      .then((r) => (r.ok ? r.json() : null))
      .then(() =>
        fetch('/api/fiscal/status')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            // Derive impact proxy from fiscal total (Nature Rewards cumulés
            // apparaissent dans annual_summaries.total_nature — exposé par
            // /api/fiscal/status). deriveImpact mappe total EUR → 4 métriques.
            const total = Number(d?.total ?? 0)
            setImpact(deriveImpact(total))
          })
      )
      .catch(() => setImpact(deriveImpact(0)))
  }, [])

  if (!impact) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold mb-4">Mon Impact</h3>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map((it) => {
          const Icon = it.icon
          return (
            <div key={it.key} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <Icon className={`w-5 h-5 mb-2 ${it.color}`} />
              <div className="text-xl font-bold font-mono">
                {impact[it.key]}
                {it.unit && <span className="text-sm text-white/60 ml-1">{it.unit}</span>}
              </div>
              <div className="text-xs text-white/60 mt-0.5">{it.label}</div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-white/50 mt-4">
        Calcul dérivé de tes Nature Rewards. Chaque action positive compte.
      </p>
    </div>
  )
}
