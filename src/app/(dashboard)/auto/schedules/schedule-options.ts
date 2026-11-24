import type { AutoSchedule as Schedule } from '@/lib/sutra-auto-types'

export const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
export const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const FREQ: Array<{ id: Schedule['frequency']; label: string }> = [
  { id: 'daily', label: 'Quotidien' },
  { id: 'weekly', label: 'Hebdomadaire' },
  { id: 'biweekly', label: 'Toutes les 2 semaines' },
  { id: 'monthly', label: '1er jour choisi du mois' },
]
