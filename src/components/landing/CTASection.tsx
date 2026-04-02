'use client'

import { useRef, useMemo } from 'react'
import { motion, useInView } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function CTASection() {
  const ref = useRef<HTMLDivElement>(null)
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      i,
      left: ((i * 37 + 13) % 100),
      top: ((i * 53 + 7) % 100),
      delay: (i * 0.3) % 6,
      duration: 4 + (i % 5),
    })),
  [])
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      data-testid="cta-section"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-fuchsia-600/20" />
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-xl" />
          <div className="absolute inset-0 border border-violet-500/20 rounded-3xl" />

          {/* Animated glows */}
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-violet-500/10 blur-[80px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-[80px] animate-pulse [animation-delay:1s]" />

          {/* CSS particle dots */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {particles.map((p) => (
              <div
                key={p.i}
                className="absolute w-1 h-1 rounded-full bg-violet-400/30 animate-[float_6s_ease-in-out_infinite]"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                }}
              />
            ))}
          </div>

          {/* Content */}
          <div className="relative px-6 sm:px-12 py-12 sm:py-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-violet-400" />
            </motion.div>

            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Pret a revolutionner
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                ta creation de contenu ?
              </span>
            </h2>

            <p className="text-white/50 text-lg max-w-lg mx-auto mb-8">
              Rejoins des milliers de createurs qui produisent des videos
              professionnelles en quelques minutes avec SUTRA.
            </p>

            <Link
              href="/signup"
              data-testid="cta-signup"
              className={cn(
                'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl',
                'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-base',
                'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
                'hover:from-violet-500 hover:to-purple-500',
                'transition-all duration-200 active:scale-[0.97]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50'
              )}
            >
              Commencer gratuitement
              <ArrowRight className="w-5 h-5" />
            </Link>

            <p className="text-xs text-white/30 mt-4">
              Aucune carte bancaire requise. 2 videos offertes.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
