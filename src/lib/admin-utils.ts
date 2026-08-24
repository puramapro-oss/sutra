import { UserRow } from '@/hooks/useAdminUsers'

export function exportUsersToCSV(users: UserRow[]) {
  const headers = ['Email', 'Nom', 'Plan', 'Videos', 'Revenus', 'Inscrit le']
  const rows = users.map((u) => [
    u.email,
    u.name ?? '',
    u.plan,
    String(u.monthly_video_count),
    String(u.wallet_balance),
    u.created_at,
  ])
  const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sutra-users-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const PLAN_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium'; label: string }> = {
  free: { variant: 'default', label: 'Free' },
  starter: { variant: 'info', label: 'Starter' },
  creator: { variant: 'premium', label: 'Creator' },
  empire: { variant: 'warning', label: 'Empire' },
  admin: { variant: 'error', label: 'Admin' },
}

export const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  cancelled: 'text-red-400',
  past_due: 'text-amber-400',
  trialing: 'text-blue-400',
}
