import { Loader2, Check, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SaveButton({
  onClick,
  loading,
  saved,
  testId,
}: {
  onClick: () => void
  loading: boolean
  saved: boolean
  testId: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
        saved
          ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'
          : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
        'disabled:opacity-50'
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {saved ? 'Sauvegarde' : 'Sauvegarder'}
    </button>
  )
}
