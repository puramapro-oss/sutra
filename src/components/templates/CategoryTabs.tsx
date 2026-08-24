import { cn } from '@/lib/utils'
import { CATEGORIES } from '@/data/template-data'

interface CategoryTabsProps {
  activeCategory: string
  categoryCounts: Record<string, number>
  onCategoryChange: (categoryId: string) => void
}

export function CategoryTabs({ activeCategory, categoryCounts, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onCategoryChange(cat.id)}
          data-testid={`category-${cat.id}`}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
            activeCategory === cat.id
              ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
              : 'bg-white/[0.02] text-white/40 border-white/[0.04] hover:bg-white/[0.04] hover:text-white/60'
          )}
        >
          <span className="text-sm">{cat.icon}</span>
          {cat.label}
          {categoryCounts[cat.id] != null && (
            <span
              className={cn(
                'ml-0.5 text-[10px]',
                activeCategory === cat.id ? 'text-violet-400/60' : 'text-white/20'
              )}
            >
              {categoryCounts[cat.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
