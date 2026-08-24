export interface VideoRecord {
  id: string
  title: string | null
  format: string | null
  quality: string | null
  duration: number | null
  engine: string | null
  created_at: string
  script_data: { title?: string; topic?: string } | null
  status: string | null
}

export interface DailyCount {
  date: string
  count: number
}

export interface Stats {
  videosThisMonth: number
  totalDuration: number
  totalCost: number
  creditsUsed: number
}

export const ENGINES = [
  { key: 'runway', label: 'Runway', color: 'from-violet-500 to-purple-500' },
  { key: 'pika', label: 'Pika', color: 'from-cyan-500 to-blue-500' },
  { key: 'stable', label: 'Stable Video', color: 'from-emerald-500 to-teal-500' },
]

export const COST_PER_VIDEO = 0.12

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
