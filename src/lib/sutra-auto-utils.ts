import type { AutoSchedule, AutoTheme } from './sutra-auto-types'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

/**
 * Calcule la prochaine occurrence d'un schedule.
 */
export function computeNextRun(schedule: AutoSchedule, from: Date = new Date()): Date | null {
  if (!schedule.is_active) return null
  const [h, m] = schedule.time.split(':').map(Number)
  const candidate = new Date(from)
  candidate.setHours(h, m, 0, 0)

  if (schedule.frequency === 'daily') {
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1)
    return candidate
  }

  const days = schedule.days.length ? schedule.days : ['MO']
  const targetDays = days.map((d) => DAY_MAP[d]).filter((d) => Number.isFinite(d))
  if (!targetDays.length) return null

  for (let offset = 0; offset < 31; offset++) {
    const d = new Date(candidate)
    d.setDate(d.getDate() + offset)
    if (!targetDays.includes(d.getDay())) continue
    if (d <= from) continue
    if (schedule.frequency === 'weekly') return d
    if (schedule.frequency === 'biweekly' && offset % 14 === 0) return d
    if (schedule.frequency === 'monthly') return d
  }
  return null
}

/**
 * Selectionne un theme selon la rotation par poids.
 */
export function pickTheme(themes: AutoTheme[]): AutoTheme | null {
  const active = themes.filter((t) => t.is_active)
  if (!active.length) return null

  // Pondere par weight ET inversement par times_used recents
  const scored = active.map((t) => {
    const recencyBoost = t.last_used_at
      ? Math.max(0, 1 - (Date.now() - new Date(t.last_used_at).getTime()) / (7 * 86400000))
      : 1
    return { theme: t, score: t.weight * (2 - recencyBoost) + Math.random() * 0.5 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].theme
}
