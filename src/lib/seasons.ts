// V6 Section 10 — Seasons trimestriel

export type Season = {
  key: 'eveil' | 'puissance' | 'abondance' | 'legende'
  display: string
  color: string
  period: string
  emoji: string
}

const SEASONS: Record<number, Season> = {
  0: { key: 'eveil',     display: 'Saison Éveil',     color: '#F59E0B', period: 'Jan–Mar', emoji: '🌅' },
  1: { key: 'puissance', display: 'Saison Puissance', color: '#EF4444', period: 'Avr–Jun', emoji: '⚡' },
  2: { key: 'abondance', display: 'Saison Abondance', color: '#10B981', period: 'Jul–Sep', emoji: '🌿' },
  3: { key: 'legende',   display: 'Saison Légende',   color: '#7C3AED', period: 'Oct–Déc', emoji: '👑' },
}

export function getCurrentSeason(d = new Date()): Season {
  const quarter = Math.floor(d.getMonth() / 3)
  return SEASONS[quarter]
}

export function getSeasonEndDate(d = new Date()): Date {
  const quarter = Math.floor(d.getMonth() / 3)
  const year = d.getFullYear()
  const endMonth = quarter * 3 + 3
  return new Date(year, endMonth, 0, 23, 59, 59)
}

export function getDaysUntilSeasonEnd(d = new Date()): number {
  const end = getSeasonEndDate(d)
  return Math.max(0, Math.ceil((end.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)))
}
