// V6 Section 10 — Paliers Ambassadeur (9 niveaux)
// Filleuls cumulés × 1 commission de prime à vie par palier atteint.

export type AmbassadorTier = {
  level: number
  name: string
  filleuls_required: number
  prime_eur: number
  display: string
}

export const AMBASSADOR_TIERS: AmbassadorTier[] = [
  { level: 1, name: 'tier_bronze',   filleuls_required: 10,    prime_eur: 200,    display: 'Bronze' },
  { level: 2, name: 'tier_silver',   filleuls_required: 25,    prime_eur: 500,    display: 'Argent' },
  { level: 3, name: 'tier_gold',     filleuls_required: 50,    prime_eur: 1000,   display: 'Or' },
  { level: 4, name: 'tier_platinum', filleuls_required: 100,   prime_eur: 2500,   display: 'Platine' },
  { level: 5, name: 'tier_diamond',  filleuls_required: 250,   prime_eur: 6000,   display: 'Diamant' },
  { level: 6, name: 'tier_legend',   filleuls_required: 500,   prime_eur: 12000,  display: 'Légende' },
  { level: 7, name: 'tier_titan',    filleuls_required: 1000,  prime_eur: 25000,  display: 'Titan' },
  { level: 8, name: 'tier_god',      filleuls_required: 5000,  prime_eur: 100000, display: 'Dieu' },
  { level: 9, name: 'tier_eternal',  filleuls_required: 10000, prime_eur: 200000, display: 'Éternel' },
]

export function getCurrentTier(filleulsCount: number): AmbassadorTier | null {
  let highest: AmbassadorTier | null = null
  for (const t of AMBASSADOR_TIERS) {
    if (filleulsCount >= t.filleuls_required) highest = t
  }
  return highest
}

export function getNextTier(filleulsCount: number): AmbassadorTier | null {
  for (const t of AMBASSADOR_TIERS) {
    if (filleulsCount < t.filleuls_required) return t
  }
  return null
}
