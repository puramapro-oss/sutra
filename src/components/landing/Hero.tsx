'use client'

import { motion } from 'framer-motion'
import { Sparkles, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0" />,
})

export default function Hero() {
  return (
    <section
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#06050e]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.08) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <Hero3D />

      {/* Aurora glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/[0.04] blur-[120px] animate-pulse" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-20 pb-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8"
        >
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-violet-300 font-medium">
            Propulse par l&apos;IA la plus avancee
          </span>
        </motion.div>

        {/* Headline (no fade-in to keep LCP fast) */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-white">Genere des videos IA</span>
          <br />
          <span
            className={cn(
              'bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400',
              'bg-clip-text text-transparent'
            )}
          >
            en quelques minutes
          </span>
        </h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Donne un sujet. Recois une video prete a publier. Zero effort.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link
            href="/signup"
            data-testid="hero-cta-primary"
            className={cn(
              'relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl',
              'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-base',
              'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
              'hover:from-violet-500 hover:to-purple-500',
              'transition-all duration-200 active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50'
            )}
          >
            <Sparkles className="w-5 h-5" />
            Commencer gratuitement
          </Link>

          <Link
            href="/how-it-works"
            data-testid="hero-cta-secondary"
            className={cn(
              'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl',
              'bg-white/5 backdrop-blur-xl border border-white/[0.08] text-white/90 font-semibold text-base',
              'hover:bg-white/10 hover:border-white/[0.12]',
              'transition-all duration-200 active:scale-[0.97]'
            )}
          >
            Comment ca marche
          </Link>
        </motion.div>

        {/* Reassurance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex items-center justify-center gap-2 text-sm text-white/50"
        >
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span>Sans carte bancaire — 2 videos offertes</span>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06050e] to-transparent pointer-events-none" />
    </section>
  )
}
