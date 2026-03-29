'use client'

import { forwardRef, useCallback, useRef, useState } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const variants = {
  primary:
    'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-purple-500',
  secondary:
    'bg-white/5 backdrop-blur-xl border border-white/[0.08] text-white/90 hover:bg-white/10 hover:border-white/[0.12]',
  ghost: 'text-white/70 hover:text-white hover:bg-white/5',
  danger:
    'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25 hover:shadow-red-500/40',
  outline:
    'border border-violet-500/50 text-violet-400 hover:bg-violet-500/10 hover:border-violet-500',
} as const

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
} as const

type ButtonVariant = keyof typeof variants
type ButtonSize = keyof typeof sizes

interface RippleItem {
  id: number
  x: number
  y: number
}

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  'data-testid'?: string
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<RippleItem[]>([])
    const nextId = useRef(0)

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const id = nextId.current++

        setRipples((prev) => [...prev, { id, x, y }])
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id))
        }, 600)

        if (onClick) {
          ;(onClick as (e: React.MouseEvent<HTMLButtonElement>) => void)(e)
        }
      },
      [disabled, loading, onClick]
    )

    return (
      <motion.button
        ref={ref}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center font-medium transition-all duration-200 overflow-hidden select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06050e]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        )}
        <span className={cn(loading && 'opacity-80')}>{children}</span>

        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/20 animate-[ripple_600ms_ease-out_forwards] pointer-events-none"
            style={{
              left: ripple.x - 5,
              top: ripple.y - 5,
              width: 10,
              height: 10,
            }}
          />
        ))}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export default Button
