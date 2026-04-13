'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), {
  ssr: false,
  loading: () => null,
})

export default function AppWelcome() {
  const [show3D, setShow3D] = useState(false)

  useEffect(() => {
    // Defer 3D load until after first paint + idle
    const hasIdleCallback = typeof window !== 'undefined' && 'requestIdleCallback' in window
    let handle: number
    if (hasIdleCallback) {
      handle = window.requestIdleCallback(() => setShow3D(true))
    } else {
      handle = window.setTimeout(() => setShow3D(true), 2000)
    }
    return () => {
      if (hasIdleCallback) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [])

  return (
    <main className="relative flex flex-col items-center justify-center min-h-dvh bg-[#06050e] text-white overflow-hidden">
      {/* CSS fallback background — shown immediately */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-600/[0.07] blur-[100px] animate-pulse" />
        <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] rounded-full bg-blue-500/[0.04] blur-[80px]" />
      </div>

      {/* 3D Background — deferred after idle */}
      {show3D && <Hero3D />}

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
        <div className="mb-8 animate-fade-in-up">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-violet-500/20">
            <span
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              S
            </span>
          </div>
        </div>

        {/* App name */}
        <h1
          className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 animate-fade-in-up stagger-1"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          SUTRA
        </h1>

        {/* Tagline */}
        <p className="text-base sm:text-lg text-white/50 mb-10 leading-relaxed animate-fade-in-up stagger-2">
          Genere des videos IA en quelques minutes.
          <br className="hidden sm:block" />
          Donne un sujet, recois une video prete a publier.
        </p>

        {/* CTAs */}
        <div className="flex flex-col w-full gap-3 max-w-xs animate-fade-in-up stagger-3">
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
        </div>

        {/* Reassurance */}
        <div className="flex items-center gap-2 mt-8 text-xs text-white/30 animate-fade-in-up stagger-4">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400/50" />
          <span>Gratuit — 2 videos offertes — Sans carte bancaire</span>
        </div>
      </div>

      {/* Bottom links */}
      <nav className="absolute bottom-6 flex items-center gap-4 text-xs text-white/20 animate-fade-in-up stagger-5">
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
      </nav>
    </main>
  )
}
