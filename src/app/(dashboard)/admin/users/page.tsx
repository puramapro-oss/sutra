'use client'

import { useState } from 'react'
import { Download, AlertTriangle } from 'lucide-react'
import { UserDetailModal } from '@/components/admin/UserDetailModal'
import { AdminUsersFilters } from '@/components/admin/AdminUsersFilters'
import { AdminUsersTable } from '@/components/admin/AdminUsersTable'
import { useAdminUsers } from '@/hooks/useAdminUsers'
import { exportUsersToCSV } from '@/lib/admin-utils'

export default function AdminUsersPage() {
  const {
    data,
    loading,
    error,
    planFilter,
    sortBy,
    sortOrder,
    page,
    setPage,
    setPlanFilter,
    fetchUsers,
    handleSearchChange,
    handleSort,
  } = useAdminUsers()

  const [viewingUserId, setViewingUserId] = useState<string | null>(null)

  const handleExportCSV = () => {
    if (!data?.users) return
    exportUsersToCSV(data.users)
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

      <AdminUsersFilters
        planFilter={planFilter}
        onSearchChange={handleSearchChange}
        onPlanFilterChange={setPlanFilter}
        onPageReset={() => setPage(1)}
      />

      <AdminUsersTable
        data={data}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        page={page}
        onSort={handleSort}
        onPageChange={setPage}
        onViewUser={setViewingUserId}
        onRefresh={fetchUsers}
      />

      <UserDetailModal
        userId={viewingUserId}
        open={viewingUserId !== null}
        onClose={() => setViewingUserId(null)}
      />
    </div>
  )
}
