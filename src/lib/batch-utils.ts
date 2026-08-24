import type { Plan } from '@/types'
import type { BatchItem } from '@/types/batch'

export const BATCH_LIMITS: Record<Plan, number> = {
  free: 2,
  starter: 5,
  creator: 20,
  empire: 9999,
  enterprise: 9999,
  admin: 9999,
}

export const FORMATS: { value: '16:9' | '9:16' | '1:1'; label: string }[] = [
  { value: '16:9', label: '16:9 Paysage' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '1:1', label: '1:1 Carre' },
]

export const QUALITIES: { value: '720p' | '1080p' | '4k'; label: string; minPlan: Plan }[] = [
  { value: '720p', label: '720p', minPlan: 'free' },
  { value: '1080p', label: '1080p', minPlan: 'creator' },
  { value: '4k', label: '4K', minPlan: 'empire' },
]

export const PLAN_ORDER: Plan[] = ['free', 'starter', 'creator', 'empire', 'enterprise', 'admin']

export function planAtLeast(userPlan: Plan, minPlan: Plan): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan)
}

export function generateId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function parseCSV(text: string): Partial<BatchItem>[] {
  const lines = text.trim().split('\n').filter(Boolean)
  return lines.map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const item: Partial<BatchItem> = { topic: cols[0] ?? '' }
    if (cols[1] && ['16:9', '9:16', '1:1'].includes(cols[1])) {
      item.format = cols[1] as BatchItem['format']
    }
    if (cols[2] && ['720p', '1080p', '4k'].includes(cols[2])) {
      item.quality = cols[2] as BatchItem['quality']
    }
    if (cols[3]) item.style = cols[3]
    return item
  })
}
