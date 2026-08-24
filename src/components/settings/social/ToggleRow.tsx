import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ToggleRowProps {
  label: string
  icon: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  testId: string
}

export function ToggleRow({ label, icon, checked, onChange, testId }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all w-full',
        checked
          ? 'bg-violet-500/10 border-violet-500/40'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
      )}
    >
      <span className="flex items-center gap-2 text-sm text-white/90">
        <span className={cn(checked ? 'text-violet-300' : 'text-white/50')}>{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-violet-500' : 'bg-white/10'
        )}
      >
        <motion.span
          animate={{ x: checked ? 20 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="inline-block h-4 w-4 rounded-full bg-white shadow"
        />
      </span>
    </button>
  )
}
