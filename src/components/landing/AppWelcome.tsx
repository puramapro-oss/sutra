'use client'

import { motion } from 'framer-motion'
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0" />,
})

export default function AppWelcome() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-dvh bg-[#06050e] text-white overflow-hidden">
      {/* 3D Background */}
      <Hero3D />

      {/* Subtle background effects */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="mb-8"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-violet-500/20">
            <span
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              S
            </span>
          </div>
        </motion.div>

        {/* App name */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          SUTRA
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="text-base sm:text-lg text-white/50 mb-10 leading-relaxed"
        >
          Genere des videos IA en quelques minutes.
          <br className="hidden sm:block" />
          Donne un sujet, recois une video prete a publier.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col w-full gap-3 max-w-xs"
        >
          <Link
            href="/signup"
            data-testid="welcome-cta-primary"
            className={cn(
              'flex items-center justify-center gap-2 w-full px-6 py-4 rounded-2xl',
              'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold',
              'shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30',
              'hover:from-violet-500 hover:to-purple-500',
              'transition-all duration-200 active:scale-[0.97]'
            )}
          >
            <Sparkles className="w-5 h-5" />
            Commencer
          </Link>

          <Link
            href="/login"
            data-testid="welcome-cta-login"
            className={cn(
              'flex items-center justify-center gap-2 w-full px-6 py-4 rounded-2xl',
              'bg-white/[0.04] border border-white/[0.08] text-white/70 font-medium',
              'hover:bg-white/[0.08] hover:text-white',
              'transition-all duration-200 active:scale-[0.97]'
            )}
          >
            Se connecter
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Reassurance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex items-center gap-2 mt-8 text-xs text-white/30"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400/50" />
          <span>Gratuit — 2 videos offertes — Sans carte bancaire</span>
        </motion.div>
      </div>

      {/* Bottom links */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 flex items-center gap-4 text-xs text-white/20"
      >
        <Link href="/pricing" className="hover:text-white/40 transition-colors">
          Tarifs
        </Link>
        <span>·</span>
        <Link href="/how-it-works" className="hover:text-white/40 transition-colors">
          Comment ca marche
        </Link>
        <span>·</span>
        <Link href="/legal" className="hover:text-white/40 transition-colors">
          Mentions legales
        </Link>
      </motion.nav>
    </main>
  )
}
