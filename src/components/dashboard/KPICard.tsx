'use client'

import { useRef, type MouseEvent } from 'react'
import { type LucideIcon } from 'lucide-react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
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
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [4, -4]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-4, 4]), { stiffness: 300, damping: 30 })
  const glowX = useSpring(useTransform(mouseX, [0, 1], [0, 100]), { stiffness: 300, damping: 30 })
  const glowY = useSpring(useTransform(mouseY, [0, 1], [0, 100]), { stiffness: 300, damping: 30 })

  const handleMouse = (e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  const handleLeave = () => {
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  const trendConfig = {
    up: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    down: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    neutral: { icon: Minus, color: 'text-white/40', bg: 'bg-white/5' },
  }

  const TrendIcon = trend ? trendConfig[trend.direction].icon : null

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      data-testid={testId}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]',
        'p-5 group cursor-default',
        'hover:border-violet-500/20 transition-colors duration-500',
        className
      )}
    >
      {/* Mouse-tracking glow */}
      <motion.div
        className="absolute w-40 h-40 rounded-full pointer-events-none"
        style={{
          left: glowX,
          top: glowY,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, transparent 70%)',
        }}
      />

      {/* Top edge glow on hover */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 group-hover:bg-violet-500/15 group-hover:border-violet-500/30 transition-colors duration-500"
          >
            <Icon className="h-5 w-5 text-violet-400 group-hover:text-violet-300 transition-colors duration-500" />
          </motion.div>

          {trend && TrendIcon && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                trendConfig[trend.direction].bg,
                trendConfig[trend.direction].color
              )}
            >
              <TrendIcon className="h-3 w-3" />
              <span>{trend.value}</span>
            </motion.div>
          )}
        </div>

        <div className="space-y-1">
          {typeof value === 'number' ? (
            <AnimatedCounter
              value={value}
              className="text-2xl font-bold text-white font-[var(--font-display)]"
            />
          ) : (
            <p className="text-2xl font-bold text-white font-[var(--font-display)] group-hover:text-violet-100 transition-colors duration-500">
              {value}
            </p>
          )}
          <p className="text-sm text-white/50 group-hover:text-white/60 transition-colors duration-500">{label}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default KPICard
