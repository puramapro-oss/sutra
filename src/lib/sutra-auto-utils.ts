import type { AutoSchedule, AutoTheme } from './sutra-auto-types'

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number }

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatterCache.get(timeZone)
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    formatterCache.set(timeZone, value)
  }
  return value
}

function localParts(date: Date, timeZone: string): LocalParts {
  const parts = formatter(timeZone).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour'), minute: read('minute') }
}

function localDateToUtc(parts: LocalParts, timeZone: string): Date | null {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  let guess = target
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = localParts(new Date(guess), timeZone)
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute)
    const correction = target - actualAsUtc
    if (correction === 0) return new Date(guess)
    guess += correction
  }

  // During a spring DST gap, use the first valid minute after the requested wall-clock time.
  let best: Date | null = null
  for (let delta = -3 * 60; delta <= 3 * 60; delta++) {
    const candidate = new Date(guess + delta * 60_000)
    const actual = localParts(candidate, timeZone)
    if (
      actual.year === parts.year && actual.month === parts.month && actual.day === parts.day &&
      actual.hour * 60 + actual.minute >= parts.hour * 60 + parts.minute &&
      (!best || candidate < best)
    ) best = candidate
  }
  return best
}

function addLocalDays(date: Pick<LocalParts, 'year' | 'month' | 'day'>, days: number) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

function localDayNumber(date: Pick<LocalParts, 'year' | 'month' | 'day'>): number {
  return Math.floor(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000)
}

function matchesFrequency(
  schedule: AutoSchedule,
  date: Pick<LocalParts, 'year' | 'month' | 'day'>,
  targetDays: number[],
): boolean {
  if (schedule.frequency === 'daily') return true
  const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
  if (!targetDays.includes(weekday)) return false
  if (schedule.frequency === 'weekly') return true
  if (schedule.frequency === 'biweekly') {
    const epoch = localDayNumber({ year: 1970, month: 1, day: 5 })
    const week = Math.floor((localDayNumber(date) - epoch) / 7)
    return Math.abs(week) % 2 === 0
  }
  // Monthly means the first selected weekday occurrence of each month.
  return schedule.frequency === 'monthly' && date.day <= 7
}

/** Returns the next occurrence in the schedule's IANA timezone. */
export function computeNextRun(schedule: AutoSchedule, from: Date = new Date()): Date | null {
  if (!schedule.is_active || Number.isNaN(from.getTime())) return null
  const [hour, minute] = schedule.time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null

  const timeZone = schedule.timezone || 'UTC'
  let start: LocalParts
  try { start = localParts(from, timeZone) } catch { return null }

  const days = schedule.days.length ? schedule.days : ['MO']
  const targetDays = days.map((day) => DAY_MAP[day]).filter((day): day is number => Number.isInteger(day))
  if (schedule.frequency !== 'daily' && !targetDays.length) return null

  for (let offset = 0; offset <= 370; offset++) {
    const date = addLocalDays(start, offset)
    if (!matchesFrequency(schedule, date, targetDays)) continue
    const candidate = localDateToUtc({ ...date, hour, minute }, timeZone)
    if (candidate && candidate > from) return candidate
  }
  return null
}

export function needsFinalComposition(params: {
  musicUrl?: string | null
  voiceUrl?: string | null
  watermarkUrl?: string | null
  introUrl?: string | null
  outroUrl?: string | null
}): boolean {
  return Boolean(
    params.musicUrl || params.voiceUrl || params.watermarkUrl || params.introUrl || params.outroUrl,
  )
}

export function pickTheme(themes: AutoTheme[]): AutoTheme | null {
  const active = themes.filter((theme) => theme.is_active)
  if (!active.length) return null
  const scored = active.map((theme) => {
    const recencyBoost = theme.last_used_at
      ? Math.max(0, 1 - (Date.now() - new Date(theme.last_used_at).getTime()) / (7 * 86400000))
      : 1
    return { theme, score: theme.weight * (2 - recencyBoost) + Math.random() * 0.5 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].theme
}
