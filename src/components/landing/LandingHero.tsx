import { useRef } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Clapperboard,
  Mic,
  PenLine,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const easeOut = [0.22, 1, 0.36, 1] as const

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.05 * i, ease: easeOut },
  }),
}

function HeroOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[1100px] max-h-[1100px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(168,85,247,0.18) 30%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute top-[10%] right-[-15%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(217,70,239,0.32) 0%, rgba(217,70,239,0.10) 35%, transparent 65%)',
          filter: 'blur(50px)',
          animationDelay: '-6s',
        }}
      />
      <div
        className="absolute top-[40%] left-[-12%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(59,130,246,0.10) 35%, transparent 65%)',
          filter: 'blur(50px)',
          animationDelay: '-12s',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] opacity-[0.08] conic-spin"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(168,85,247,0.4) 25%, transparent 35%, rgba(217,70,239,0.4) 60%, transparent 70%, rgba(34,211,238,0.3) 90%, transparent 100%)',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-[#06050e]" />
    </div>
  )
}

function PreviewCard({
  icon: Icon,
  title,
  status,
  delay,
  accent,
}: {
  icon: typeof PenLine
  title: string
  status: string
  delay: number
  accent: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: easeOut }}
      className="relative rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]"
    >
      <div className={cn('absolute -inset-px rounded-xl opacity-50 blur-sm pointer-events-none', accent)} />
      <div className="relative flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border border-white/10', accent)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-white truncate">{title}</div>
          <div className="text-[11px] text-white/50 truncate">{status}</div>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] dot-live" />
      </div>
    </motion.div>
  )
}

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -60])
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.3])

  return (
    <section
      ref={ref}
      data-testid="hero-section"
      className="relative min-h-[100vh] flex flex-col items-center justify-center px-6 pt-32 pb-32 overflow-hidden"
    >
      <HeroOrbs />

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-5xl text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={0}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-9 rounded-full border border-violet-400/20 bg-violet-500/[0.08] backdrop-blur-md text-xs text-violet-100/90"
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-fuchsia-400 animate-ping opacity-80" />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
          </span>
          Générateur vidéo IA · Nouveau
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={1}
          className="text-[44px] sm:text-6xl md:text-7xl lg:text-[92px] font-semibold tracking-[-0.035em] leading-[0.96]"
        >
          La vidéo,
          <br />
          <span className="gradient-text-hero">réinventée par l&apos;IA.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={2}
          className="mt-7 text-lg sm:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed"
        >
          Donne un sujet. Reçois une vidéo prête à publier — script, voix, visuels, musique.
          En quelques minutes, pas en quelques heures.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={3}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            href="/signup"
            data-testid="hero-cta-primary"
            className={cn(
              'group relative inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl',
              'bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500',
              'text-white font-semibold text-[15px] tracking-tight',
              'glow-cta hover:scale-[1.02] active:scale-[0.98]',
              'transition-all duration-300'
            )}
          >
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            <Sparkles className="w-4 h-4 relative" />
            <span className="relative">Créer ma première vidéo</span>
            <ArrowRight className="w-4 h-4 relative transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/how-it-works"
            data-testid="hero-cta-secondary"
            className="group inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-white/[0.10] bg-white/[0.04] text-white/85 hover:bg-white/[0.08] hover:border-white/[0.18] hover:text-white text-[15px] transition-all duration-200 backdrop-blur-md"
          >
            Voir une démo
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </motion.div>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={4}
          className="mt-7 text-xs text-white/45 tracking-wide"
        >
          Gratuit — 2 vidéos offertes · Sans carte bancaire
        </motion.p>
      </motion.div>

      <div className="hidden md:flex absolute bottom-12 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl flex-col gap-3 z-10">
        <PreviewCard
          icon={PenLine}
          title="Script · Hook → Promesse → CTA"
          status="Généré par Claude · 312 mots · 28s lecture"
          delay={0.5}
          accent="bg-gradient-to-br from-violet-500/20 to-violet-500/0"
        />
        <PreviewCard
          icon={Mic}
          title="Voix · Narration FR studio"
          status="ElevenLabs · pitch ajusté · 28s"
          delay={0.65}
          accent="bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/0"
        />
        <PreviewCard
          icon={Clapperboard}
          title="Scènes · 8 plans synchronisés"
          status="WAN 2.2 · 1080p · ratio 9:16"
          delay={0.8}
          accent="bg-gradient-to-br from-cyan-500/20 to-cyan-500/0"
        />
      </div>
    </section>
  )
}
