import { Search } from 'lucide-react'

interface AdminUsersFiltersProps {
  planFilter: string
  onSearchChange: (value: string) => void
  onPlanFilterChange: (value: string) => void
  onPageReset: () => void
}

export function AdminUsersFilters({
  planFilter,
  onSearchChange,
  onPlanFilterChange,
  onPageReset,
}: AdminUsersFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/90 placeholder-white/30 outline-none focus:border-amber-500/40 transition-colors"
          data-testid="admin-users-search"
        />
      </div>
      <select
        value={planFilter}
        onChange={(e) => {
          onPlanFilterChange(e.target.value)
          onPageReset()
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
  )
}
