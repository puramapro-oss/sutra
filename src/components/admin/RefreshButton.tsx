import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RefreshButtonProps {
  onClick: () => void
  refreshing: boolean
}

export function RefreshButton({ onClick, refreshing }: RefreshButtonProps) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={refreshing}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors disabled:opacity-50"
        data-testid="admin-refresh"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        Rafraichir
      </button>
    </div>
  )
}
