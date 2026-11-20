import type { AutoSchedule } from './sutra-auto-types'

const DAYS = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])

/** Validate new schedules without rewriting historical extension fields. */
export function isValidAutoSchedules(value: unknown): value is AutoSchedule[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every(schedule => {
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return false
    const { id, name, is_active, frequency, days, time, timezone, theme_ids } = schedule
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) return false
    ids.add(id)
    if (typeof name !== 'string' || !name.trim() || typeof is_active !== 'boolean') return false
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) return false
    if (!Array.isArray(days) || days.some(day => typeof day !== 'string' || !DAYS.has(day))) return false
    if (new Set(days).size !== days.length || (frequency !== 'daily' && days.length === 0)) return false
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false
    if (typeof timezone !== 'string' || !/^(?:UTC|[A-Za-z_]+\/[A-Za-z_+\-/0-9]+)$/.test(timezone)) return false
    try { new Intl.DateTimeFormat('fr-FR', { timeZone: timezone }).format(0) } catch { return false }
    if (theme_ids !== undefined && (!Array.isArray(theme_ids) || theme_ids.some(id => typeof id !== 'string' || !id.trim()))) return false
    return true
  })
}
