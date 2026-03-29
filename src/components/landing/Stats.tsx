'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, useInView } from 'framer-motion'
import { Video, Users, Layers, Zap } from 'lucide-react'

interface StatItem {
  icon: React.ElementType
  value: number
  suffix: string
  prefix?: string
  label: string
}

const stats: StatItem[] = [
  { icon: Video, value: 10000, suffix: '+', label: 'Videos generees' },
  { icon: Users, value: 2000, suffix: '+', label: 'Createurs actifs' },
  { icon: Layers, value: 50, suffix: '+', label: 'Niches supportees' },
  { icon: Zap, value: 5, suffix: ' min', prefix: '< ', label: 'Temps de creation' },
]

function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
  started,
}: {
  target: number
  prefix?: string
  suffix?: string
  started: boolean
}) {
  const [current, setCurrent] = useState(0)
  const rafRef = useRef<number | null>(null)

  const animateCount = useCallback(() => {
    if (!started) return

    const duration = 2000
    const start = performance.now()

    function step(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.floor(eased * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
  }, [started, target])

  useEffect(() => {
    animateCount()
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [animateCount])

  const formatted =
    target >= 1000
      ? current.toLocaleString('fr-FR')
      : current.toString()

  return (
    <span className="tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section
      data-testid="stats-section"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 text-center hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300"
              >
                {/* Glow on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-violet-500/[0.05] to-transparent pointer-events-none" />

                <div className="relative">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-violet-400" />
                  </div>

                  <div
                    className="text-3xl sm:text-4xl font-bold text-white mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    <AnimatedCounter
                      target={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      started={isInView}
                    />
                  </div>

                  <p className="text-sm text-white/50">{stat.label}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
