'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Users, Eye, Ban } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { SortIcon } from '@/components/ui/SortIcon'
import GoldCard from '@/components/admin/GoldCard'
import { UserRow } from '@/hooks/useAdminUsers'
import { PLAN_BADGE, STATUS_COLORS } from '@/lib/admin-utils'

interface AdminUsersTableProps {
  data: { users: UserRow[]; total: number; page: number; limit: number; total_pages: number } | null
  loading: boolean
  sortBy: string
  sortOrder: 'asc' | 'desc'
  page: number
  onSort: (column: string) => void
  onPageChange: (page: number) => void
  onViewUser: (userId: string) => void
  onRefresh: () => Promise<void>
}

export function AdminUsersTable({
  data,
  loading,
  sortBy,
  sortOrder,
  page,
  onSort,
  onPageChange,
  onViewUser,
  onRefresh,
}: AdminUsersTableProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

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
      await onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setPendingActionId(null)
    }
  }, [onRefresh])

  return (
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
                onClick={() => onSort('plan')}
              >
                <span className="flex items-center gap-1">
                  Plan <SortIcon column="plan" sortBy={sortBy} sortOrder={sortOrder} />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                onClick={() => onSort('created_at')}
              >
                <span className="flex items-center gap-1">
                  Inscrit <SortIcon column="created_at" sortBy={sortBy} sortOrder={sortOrder} />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                onClick={() => onSort('monthly_video_count')}
              >
                <span className="flex items-center gap-1">
                  Videos <SortIcon column="monthly_video_count" sortBy={sortBy} sortOrder={sortOrder} />
                </span>
              </th>
              <th
                className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors"
                onClick={() => onSort('wallet_balance')}
              >
                <span className="flex items-center gap-1">
                  Revenus <SortIcon column="wallet_balance" sortBy={sortBy} sortOrder={sortOrder} />
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
                          onClick={() => onViewUser(user.id)}
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

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-white/30">
            Page {data.page} sur {data.total_pages} ({data.total} resultats)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
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
                  onClick={() => onPageChange(pageNum)}
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
              onClick={() => onPageChange(Math.min(data.total_pages, page + 1))}
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
  )
}
