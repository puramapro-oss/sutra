'use client'

import { motion } from 'framer-motion'
import { Wand2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  mode: 'auto' | 'manual'
  onChange: (mode: 'auto' | 'manual') => void
  className?: string
}

export function ModeToggle({ mode, onChange, className }: ModeToggleProps) {
  const options = [
    { id: 'auto' as const, label: 'Automatique', icon: Wand2 },
    { id: 'manual' as const, label: 'Manuel', icon: SlidersHorizontal },
  ]

  return (
    <div
      data-testid="mode-toggle"
      className={cn(
        'relative inline-flex items-center p-1 rounded-xl',
        'bg-white/[0.04] border border-white/[0.06]',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = mode === opt.id
        return (
          <button
            key={opt.id}
            data-testid={`mode-${opt.id}`}
            onClick={() => onChange(opt.id)}
            className={cn(
              'relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200',
              isActive ? 'text-white' : 'text-white/40 hover:text-white/60'
            )}
          >
            <opt.icon className="h-4 w-4" />
            {opt.label}

            {isActive && (
              <motion.div
                layoutId="mode-toggle-indicator"
                className="absolute inset-0 rounded-lg bg-violet-600/80 border border-violet-500/30 -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ModeToggle
