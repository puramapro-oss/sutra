'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Wallet, Gift, CheckCircle2 } from 'lucide-react'
import Confetti from '@/components/shared/Confetti'

function ConfirmationContent() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  const [confettiActive, setConfettiActive] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setConfettiActive(true), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      try {
        document.cookie = 'purama_promo=; path=/; max-age=0; samesite=lax'
      } catch {
        // ignore
      }
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const isMobile = /iPhone|iPad|Android/.test(ua)
      if (isMobile) {
        const deepLinkTimer = setTimeout(() => {
          window.location.href = 'purama://activate'
        }, 1800)
        return () => clearTimeout(deepLinkTimer)
      }
    }
  }, [sessionId])

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 relative">
      <Confetti active={confettiActive} duration={4000} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass-card max-w-lg w-full p-8 md:p-10 text-center relative overflow-hidden"
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            background:
              'radial-gradient(800px circle at 50% 0%, rgba(139, 92, 246, 0.3), transparent 60%)',
          }}
        />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 18 }}
          className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/30"
        >
          <CheckCircle2 className="h-10 w-10 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          data-testid="confirmation-title"
          className="text-3xl md:text-4xl font-bold text-white mb-3 font-[var(--font-display)] relative"
        >
          Bienvenue dans SUTRA !
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-white/75 text-sm md:text-base mb-6 relative"
        >
          Ton abonnement est actif. Ta prime de bienvenue t&apos;attend sur ton wallet.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="relative glass-card p-5 mb-6 border-amber-400/40 bg-amber-500/[0.06]"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Gift className="h-5 w-5 text-amber-300" />
            <span className="text-xs uppercase tracking-wide text-amber-200 font-semibold">
              Prime de bienvenue — Tranche 1/3
            </span>
          </div>
          <div
            data-testid="confirmation-prime-amount"
            className="text-4xl font-bold text-amber-200 tabular-nums mb-1"
          >
            +25 €
          </div>
          <p className="text-xs text-white/60">
            Créditée sur ton compte Purama. Tranches 2 et 3 (25 € + 50 €) les deux mois suivants.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="relative flex flex-col sm:flex-row gap-2 justify-center"
        >
          <button
            data-testid="go-dashboard"
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-semibold hover:from-violet-400 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98]"
          >
            Accéder au dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            <Wallet className="h-4 w-4" />
            Voir mon wallet
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="relative mt-6 text-[11px] text-white/40 flex items-center justify-center gap-1.5"
        >
          <Sparkles className="h-3 w-3 text-violet-300" />
          Accès immédiat activé — art. L221-28 Code conso
        </motion.p>
      </motion.div>
    </main>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationContent />
    </Suspense>
  )
}
