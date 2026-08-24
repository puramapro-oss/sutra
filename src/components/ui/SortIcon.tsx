import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'

interface SortIconProps {
  column: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function SortIcon({ column, sortBy, sortOrder }: SortIconProps) {
  if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 text-white/20" />
  return sortOrder === 'asc' ? (
    <ChevronUp className="h-3 w-3 text-amber-400" />
  ) : (
    <ChevronDown className="h-3 w-3 text-amber-400" />
  )
}
