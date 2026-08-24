import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [showSortMenu, setShowSortMenu] = useState(false)
  const activeSort = SORT_OPTIONS.find((s) => s.id === sort)

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 w-full sm:max-w-xs">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          data-testid="library-search"
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
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`filter-${tab.id}`}
            onClick={() => onFilterChange(tab.filter)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-1.5',
              filter === tab.filter
                ? 'bg-violet-600/80 text-white'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            {tab.id === 'favorites' && <Heart className="h-3 w-3" />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="relative">
        <button
          data-testid="sort-toggle"
          onClick={() => setShowSortMenu((prev) => !prev)}
          className={cn(
            'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium',
            'bg-white/[0.03] border border-white/[0.06] text-white/50',
            'hover:border-white/[0.12] hover:text-white/70 transition-all duration-200'
          )}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {activeSort?.label ?? 'Trier'}
        </button>

        <AnimatePresence>
          {showSortMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#0c0b14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl z-30 overflow-hidden"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  data-testid={`sort-${opt.id}`}
                  onClick={() => {
                    onSortChange(opt.id)
                    setShowSortMenu(false)
                  }}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors',
                    sort === opt.id
                      ? 'text-violet-400 bg-violet-500/5'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
              : 'text-white/40 hover:text-white/60'
          )}
          aria-label="Vue grille"
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
              : 'text-white/40 hover:text-white/60'
          )}
          aria-label="Vue liste"
        >
          <LayoutList className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
