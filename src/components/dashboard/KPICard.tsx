'use client'

import { type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface KPICardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
  }
  className?: string
  'data-testid'?: string
}

export function KPICard({
  icon: Icon,
  label,
  value,
  trend,
  className,
  'data-testid': testId,
}: KPICardProps) {
  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    down: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    neutral: { icon: Minus, color: 'text-white/40', bg: 'bg-white/5' },
  }

  const TrendIcon = trend ? trendConfig[trend.direction].icon : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      data-testid={testId}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]',
        'p-5 group',
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Icon className="h-5 w-5 text-violet-400" />
          </div>

          {trend && TrendIcon && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                trendConfig[trend.direction].bg,
                trendConfig[trend.direction].color
              )}
            >
              <TrendIcon className="h-3 w-3" />
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {typeof value === 'number' ? (
            <AnimatedCounter
              value={value}
              className="text-2xl font-bold text-white font-[var(--font-display)]"
            />
          ) : (
            <p className="text-2xl font-bold text-white font-[var(--font-display)]">
              {value}
            </p>
          )}
          <p className="text-sm text-white/50">{label}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default KPICard
