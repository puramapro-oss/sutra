import type { AutoSchedule } from './sutra-auto-types'

export type ScheduleChange = { before: AutoSchedule | null; after: AutoSchedule | null }
export const SCHEDULE_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

/** Browser validation only. The existing server remains the scheduling authority. */
export function scheduleValidation(schedule: AutoSchedule): string | null {
  if (!schedule.name.trim()) return 'Donne un nom au planning.'
  if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(schedule.frequency)) return 'Choisis une fréquence valide.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)) return 'Choisis une heure valide.'
  if (!Array.isArray(schedule.days) || schedule.days.some(day => !SCHEDULE_DAYS.includes(day)) || (schedule.frequency !== 'daily' && !schedule.days.length)) return 'Choisis au moins un jour de la semaine.'
  try {
    if (!schedule.timezone || !/^(?:UTC|[A-Za-z_]+\/[A-Za-z_+\-/0-9]+)$/.test(schedule.timezone)) throw new Error('timezone')
    new Intl.DateTimeFormat('fr-FR', { timeZone: schedule.timezone }).format(0)
  } catch { return 'Indique un fuseau IANA valide, par exemple Europe/Paris.' }
  return null
}

export function schedulesFromResponse(body: Record<string, unknown>): AutoSchedule[] {
  const config = body.config
  if (config === null) return []
  if (!config || typeof config !== 'object' || !('schedules' in config) || !Array.isArray(config.schedules)) throw new Error('Configuration illisible')
  const ids = new Set<string>()
  for (const s of config.schedules) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.name !== 'string' || typeof s.is_active !== 'boolean' || typeof s.time !== 'string' || typeof s.timezone !== 'string' || scheduleValidation(s)) throw new Error('Planning illisible')
    ids.add(s.id)
  }
  return config.schedules
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  return value
}

export function sameSchedule(a: AutoSchedule | null, b: AutoSchedule | null): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

/** Reconcile one intent against a fresh GET, preserving unrelated schedules and
 * extension fields. This is not a replacement for server-side compare-and-swap. */
export function reconcileScheduleChange(current: AutoSchedule[], change: ScheduleChange): { schedules: AutoSchedule[]; applied: boolean } {
  const id = change.after?.id ?? change.before?.id
  if (!id) throw new Error('Identité absente')
  const existing = current.find(s => s.id === id) ?? null
  if (sameSchedule(existing, change.after)) return { schedules: current, applied: true }
  if (!sameSchedule(existing, change.before)) throw new Error('schedule_conflict')
  return {
    schedules: existing ? current.flatMap(s => s.id === id ? change.after ? [change.after] : [] : [s]) : [...current, ...(change.after ? [change.after] : [])],
    applied: false,
  }
}
