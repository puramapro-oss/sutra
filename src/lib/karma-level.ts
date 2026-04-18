// Niveaux Sanskrit KARMA — basés sur graines cumulées (lifetime_earned)

export const KARMA_LEVELS = [
  { index: 0, name: 'Novice', min: 0, max: 100 },
  { index: 1, name: 'Sadhaka', min: 101, max: 1000 },
  { index: 2, name: 'Yogin', min: 1001, max: 10000 },
  { index: 3, name: 'Siddha', min: 10001, max: 100000 },
  { index: 4, name: 'Mahatma', min: 100001, max: Number.MAX_SAFE_INTEGER },
] as const

export type KarmaLevelName = typeof KARMA_LEVELS[number]['name']

export interface KarmaLevel {
  index: number
  name: KarmaLevelName
  min: number
  max: number
}

export function levelFromLifetime(lifetimeEarned: number): KarmaLevel {
  const safe = Math.max(0, Math.floor(lifetimeEarned))
  for (let i = KARMA_LEVELS.length - 1; i >= 0; i--) {
    const lvl = KARMA_LEVELS[i]
    if (safe >= lvl.min) return { ...lvl }
  }
  return { ...KARMA_LEVELS[0] }
}

export function progressToNextLevel(lifetimeEarned: number): {
  currentLevel: KarmaLevelName
  nextLevel: KarmaLevelName | null
  nextThreshold: number | null
  percent: number
} {
  const safe = Math.max(0, Math.floor(lifetimeEarned))
  const current = levelFromLifetime(safe)

  if (current.index === KARMA_LEVELS.length - 1) {
    return {
      currentLevel: current.name,
      nextLevel: null,
      nextThreshold: null,
      percent: 100,
    }
  }

  const next = KARMA_LEVELS[current.index + 1]
  const range = next.min - current.min
  const gained = safe - current.min
  const percent = Math.max(0, Math.min(100, Math.round((gained / range) * 100)))

  return {
    currentLevel: current.name,
    nextLevel: next.name,
    nextThreshold: next.min,
    percent,
  }
}

export const LEVEL_EMOJI: Record<KarmaLevelName, string> = {
  Novice: '🌱',
  Sadhaka: '🌿',
  Yogin: '🌳',
  Siddha: '💎',
  Mahatma: '🕉️',
}
