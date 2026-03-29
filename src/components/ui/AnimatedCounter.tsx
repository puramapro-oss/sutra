'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useInView, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AnimatedCounterProps {
  value: number
  locale?: string
  duration?: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
  'data-testid'?: string
}

export function AnimatedCounter({
  value,
  locale = 'fr-FR',
  duration = 1.5,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
  ...props
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, {
    stiffness: 80,
    damping: 20,
    duration: duration * 1000,
  })

  useEffect(() => {
    if (isInView) {
      motionValue.set(value)
    }
  }, [isInView, value, motionValue])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        const formatted = new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(latest)
        ref.current.textContent = `${prefix}${formatted}${suffix}`
      }
    })

    return unsubscribe
  }, [springValue, locale, prefix, suffix, decimals])

  return (
    <motion.span
      ref={ref}
      className={cn('tabular-nums', className)}
      {...props}
    >
      {prefix}0{suffix}
    </motion.span>
  )
}

export default AnimatedCounter
