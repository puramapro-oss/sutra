'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  Eye,
  Ban,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { UserDetailModal } from '@/components/admin/UserDetailModal'

interface UserRow {
  id: string
  email: string
  name: string | null
  plan: string
  is_admin: boolean
  credits: number
  wallet_balance: number
  monthly_video_count: number
  subscription_status: string | null
  created_at: string
  updated_at: string
}

interface UsersResponse {
  users: UserRow[]
  total: number
  page: number
  limit: number
  total_pages: number
}

const PLAN_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium'; label: string }> = {
  free: { variant: 'default', label: 'Free' },
  starter: { variant: 'info', label: 'Starter' },
  creator: { variant: 'premium', label: 'Creator' },
  empire: { variant: 'warning', label: 'Empire' },
  admin: { variant: 'error', label: 'Admin' },
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  cancelled: 'text-red-400',
  past_due: 'text-amber-400',
  trialing: 'text-blue-400',
}

function GoldCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: sortBy,
        order: sortOrder,
      })
      if (search) params.set('search', search)
      if (planFilter) params.set('plan', planFilter)

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Erreur chargement utilisateurs')

      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearchChange = (value: string) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      setSearch(value)
      setPage(1)
    }, 300)
    setSearchTimeout(timeout)
  }

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleExportCSV = () => {
    if (!data?.users) return
    const headers = ['Email', 'Nom', 'Plan', 'Videos', 'Revenus', 'Inscrit le']
    const rows = data.users.map((u) => [
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

  const handleToggleBan = useCallback(async (userId: string, currentStatus: string | null) => {
    const willBan = currentStatus !== 'banned'
    const action = willBan ? 'ban' : 'unban'
    if (willBan && !confirm('Confirmer la desactivation de ce compte ?')) return
    setPendingActionId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Erreur')
      }
      toast.success(willBan ? 'Compte desactive' : 'Compte reactive')
      await fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPendingActionId(null)
    }
  }, [fetchUsers])

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 text-white/20" />
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-amber-400" />
    ) : (
      <ChevronDown className="h-3 w-3 text-amber-400" />
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-users-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Gestion des utilisateurs</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? '...' : `${data?.total ?? 0} utilisateurs au total`}
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={loading || !data?.users?.length}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="admin-users-export"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/90 placeholder-white/30 outline-none focus:border-amber-500/40 transition-colors"
            data-testid="admin-users-search"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => {
            setPlanFilter(e.target.value)
            setPage(1)
          }}
          className="px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/70 outline-none focus:border-amber-500/40 transition-colors appearance-none cursor-pointer"
          data-testid="admin-users-filter-plan"
        >
          <option value="">Tous les plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="creator">Creator</option>
          <option value="empire">Empire</option>
        </select>
      </div>

      {/* Table */}
      <GoldCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="admin-users-table">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => handleSort('plan')}
                >
                  <span className="flex items-center gap-1">
                    Plan <SortIcon column="plan" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <span className="flex items-center gap-1">
                    Inscrit <SortIcon column="created_at" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => handleSort('monthly_video_count')}
                >
                  <span className="flex items-center gap-1">
                    Videos <SortIcon column="monthly_video_count" />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                  onClick={() => handleSort('wallet_balance')}
                >
                  <span className="flex items-center gap-1">
                    Revenus <SortIcon column="wallet_balance" />
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                  Statut
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton width={32} height={32} rounded="full" />
                        <div className="space-y-1.5">
                          <Skeleton width={120} height={12} rounded="md" />
                          <Skeleton width={160} height={10} rounded="md" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Skeleton width={60} height={22} rounded="full" /></td>
                    <td className="px-4 py-3"><Skeleton width={80} height={12} rounded="md" /></td>
                    <td className="px-4 py-3"><Skeleton width={30} height={12} rounded="md" /></td>
                    <td className="px-4 py-3"><Skeleton width={60} height={12} rounded="md" /></td>
                    <td className="px-4 py-3"><Skeleton width={50} height={12} rounded="md" /></td>
                    <td className="px-4 py-3"><Skeleton width={60} height={24} rounded="md" /></td>
                  </tr>
                ))
              ) : (data?.users ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
                    <p className="text-sm text-white/30">Aucun utilisateur trouve</p>
                  </td>
                </tr>
              ) : (
                (data?.users ?? []).map((user, idx) => {
                  const planConfig = PLAN_BADGE[user.plan] ?? PLAN_BADGE.free
                  const statusColor = STATUS_COLORS[user.subscription_status ?? ''] ?? 'text-white/30'
                  const initial = user.name
                    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
                    : user.email[0]?.toUpperCase() ?? 'U'

                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      data-testid={`admin-user-row-${user.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-semibold text-amber-400">
                            {initial}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white/90 truncate max-w-[180px]">
                              {user.name ?? 'Sans nom'}
                            </p>
                            <p className="text-xs text-white/30 truncate max-w-[180px]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={planConfig.variant} size="sm">
                          {planConfig.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60 font-medium">
                        {user.monthly_video_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60 font-medium">
                        {formatPrice(user.wallet_balance)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-medium capitalize', statusColor)}>
                          {user.subscription_status ?? 'free'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingUserId(user.id)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            data-testid={`admin-user-view-${user.id}`}
                            title="Voir le profil"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleBan(user.id, user.subscription_status)}
                            disabled={pendingActionId === user.id}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors disabled:opacity-40',
                              user.subscription_status === 'banned'
                                ? 'text-red-400 bg-red-500/10'
                                : 'text-white/30 hover:text-red-400 hover:bg-red-500/10'
                            )}
                            data-testid={`admin-user-disable-${user.id}`}
                            title={user.subscription_status === 'banned' ? 'Reactiver le compte' : 'Desactiver le compte'}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-white/30">
              Page {data.page} sur {data.total_pages} ({data.total} resultats)
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="admin-users-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(5, data.total_pages) }).map((_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'h-8 w-8 rounded-lg text-xs font-medium transition-colors',
                      page === pageNum
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                    )}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page >= data.total_pages}
                className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="admin-users-next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </GoldCard>

      <UserDetailModal
        userId={viewingUserId}
        open={viewingUserId !== null}
        onClose={() => setViewingUserId(null)}
      />
    </div>
  )
}
