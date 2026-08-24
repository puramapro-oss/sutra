import { Search } from 'lucide-react'

interface TemplateSearchProps {
  value: string
  onChange: (value: string) => void
}

export function TemplateSearch({ value, onChange }: TemplateSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher un template par nom, categorie ou description..."
        data-testid="templates-search"
        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 outline-none focus:border-violet-500/50 focus:bg-white/[0.04] transition-all"
      />
    </div>
  )
}
