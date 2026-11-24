import {
  Search,
  ArrowUpDown,
  Heart,
  LayoutGrid,
  LayoutList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FILTER_TABS, SORT_OPTIONS } from '@/lib/library-constants'
import type { FilterId, ViewMode } from '@/types/library'

interface LibraryFiltersProps {
  search: string
  onSearchChange: (search: string) => void
  filter: FilterId
  onFilterChange: (filter: FilterId) => void
  sort: string
  onSortChange: (sort: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export default function LibraryFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
}: LibraryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-48">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/65" />
        <input
          data-testid="library-search"
          aria-label="Rechercher dans la bibliothèque"
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white/90 placeholder-white/30',
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.06] hover:border-white/[0.12]',
            'focus:border-violet-500/60 outline-none transition-all duration-200'
          )}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] max-w-full flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`filter-${tab.id}`}
            aria-pressed={filter === tab.filter}
            onClick={() => onFilterChange(tab.filter)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5',
              filter === tab.filter
                ? 'bg-violet-600/80 text-white'
                : 'text-white/65 hover:text-white/60'
            )}
          >
            {tab.id === 'favorites' && <Heart className="h-3 w-3" />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <ArrowUpDown aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-white/70" />
        <select
          data-testid="sort-toggle" aria-label="Trier les vidéos" value={sort}
          onChange={event => onSortChange(event.target.value)}
          className="max-w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-medium bg-[#0c0b14] border border-white/20 text-white/70"
        >
          {SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-0.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <button
          data-testid="view-grid"
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'p-2 rounded-lg transition-all duration-200',
            viewMode === 'grid'
              ? 'bg-violet-600/80 text-white'
              : 'text-white/65 hover:text-white/60'
          )}
          aria-label="Vue grille"
          aria-pressed={viewMode === 'grid'}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          data-testid="view-list"
          onClick={() => onViewModeChange('list')}
          className={cn(
            'p-2 rounded-lg transition-all duration-200',
            viewMode === 'list'
              ? 'bg-violet-600/80 text-white'
              : 'text-white/65 hover:text-white/60'
          )}
          aria-label="Vue liste"
          aria-pressed={viewMode === 'list'}
        >
          <LayoutList className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
