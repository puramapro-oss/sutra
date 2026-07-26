'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Clapperboard,
  Mic,
  Music2,
  PenLine,
  Sparkles,
  Wand2,
  Zap,
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

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl px-4 sm:px-5 py-2.5 shadow-[0_8px_32px_-12px_rgba(168,85,247,0.25)]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-fuchsia-500/40 group-hover:shadow-fuchsia-500/60 transition-shadow">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/30 to-transparent" />
            <span className="relative">S</span>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">SUTRA</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
          <Link href="/how-it-works" className="hover:text-white transition-colors">Fonctionnement</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
          <Link href="/ecosystem" className="hover:text-white transition-colors">Écosystème</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm text-white/70 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            Se connecter
          </Link>
          <Link
            href="/signup"
            data-testid="welcome-cta-primary"
            className="group inline-flex items-center gap-1.5 text-sm font-medium bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-lg shadow-[0_8px_24px_-8px_rgba(217,70,239,0.6)] hover:shadow-[0_12px_32px_-8px_rgba(217,70,239,0.85)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Commencer
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

function HeroOrbs() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Top center — violet primary orb */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[1100px] max-h-[1100px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(168,85,247,0.18) 30%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Right — fuchsia accent */}
      <div
        className="absolute top-[10%] right-[-15%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(217,70,239,0.32) 0%, rgba(217,70,239,0.10) 35%, transparent 65%)',
          filter: 'blur(50px)',
          animationDelay: '-6s',
        }}
      />
      {/* Left — cyan accent */}
      <div
        className="absolute top-[40%] left-[-12%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] orb-drift"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(59,130,246,0.10) 35%, transparent 65%)',
          filter: 'blur(50px)',
          animationDelay: '-12s',
        }}
      />
      {/* Conic accent ring (very subtle) */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] opacity-[0.08] conic-spin"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(168,85,247,0.4) 25%, transparent 35%, rgba(217,70,239,0.4) 60%, transparent 70%, rgba(34,211,238,0.3) 90%, transparent 100%)',
        }}
      />
      {/* Bottom fade */}
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

function Hero() {
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

      {/* Live preview cards (desktop only) */}
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

const features = [
  {
    icon: PenLine,
    title: 'Script rédigé',
    desc: 'Une IA narrative conçoit l’accroche, le rythme et la chute. Zéro page blanche.',
    accent: 'from-violet-500/30 to-violet-500/0',
    iconColor: 'text-violet-300',
  },
  {
    icon: Mic,
    title: 'Voix humaine',
    desc: 'Voix IA naturelle multi-langues, intonation ajustée à ton sujet.',
    accent: 'from-fuchsia-500/30 to-fuchsia-500/0',
    iconColor: 'text-fuchsia-300',
  },
  {
    icon: Clapperboard,
    title: 'Visuels calés',
    desc: 'Plans générés ou stock premium, synchronisés au montage par IA.',
    accent: 'from-pink-500/30 to-pink-500/0',
    iconColor: 'text-pink-300',
  },
  {
    icon: Music2,
    title: 'Musique adaptative',
    desc: 'Ambiance sonore choisie selon le ton — énergique, posé, cinématique.',
    accent: 'from-cyan-500/30 to-cyan-500/0',
    iconColor: 'text-cyan-300',
  },
  {
    icon: Zap,
    title: 'Prêt en minutes',
    desc: 'Export 1080p vertical ou horizontal, optimisé TikTok, Reels, YouTube Shorts.',
    accent: 'from-amber-500/30 to-amber-500/0',
    iconColor: 'text-amber-300',
  },
  {
    icon: Wand2,
    title: 'Itérations magiques',
    desc: 'Ajuste une phrase, change un plan, regénère. Ta vidéo évolue en temps réel.',
    accent: 'from-emerald-500/30 to-emerald-500/0',
    iconColor: 'text-emerald-300',
  },
]

function Features() {
  return (
    <section className="relative px-6 py-32 sm:py-40">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.22em] text-fuchsia-300 uppercase mb-4">
            Tout-en-un
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Un studio complet,
            <br />
            <span className="text-white/45">piloté par l&apos;IA.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: easeOut }}
              className="group relative p-7 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl hover:border-white/[0.16] hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
            >
              <div className={cn('absolute -top-1/2 -right-1/4 w-2/3 h-2/3 rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-500 bg-gradient-to-br pointer-events-none', f.accent)} />
              <div className="relative">
                <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br border border-white/[0.10] flex items-center justify-center mb-5 shadow-inner', f.accent)}>
                  <f.icon className={cn('w-5 h-5', f.iconColor)} />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{f.title}</h3>
                <p className="text-[15px] text-white/60 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = [
  {
    n: '01',
    title: 'Donne un sujet',
    desc: 'Un thème, une URL, une idée brute. SUTRA comprend ton intention.',
    accent: 'text-violet-300',
  },
  {
    n: '02',
    title: 'L’IA construit',
    desc: 'Script, voix, visuels, musique, montage — tout est généré et synchronisé.',
    accent: 'text-fuchsia-300',
  },
  {
    n: '03',
    title: 'Publie partout',
    desc: 'Export optimisé TikTok, Reels, Shorts. Itère en un clic si besoin.',
    accent: 'text-cyan-300',
  },
]

function HowItWorks() {
  return (
    <section className="relative px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.22em] text-fuchsia-300 uppercase mb-4">
            Comment ça marche
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Trois étapes.
            <br />
            <span className="text-white/45">Pas une de plus.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: easeOut }}
              className="relative p-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden group hover:border-white/[0.16] transition-colors duration-300"
            >
              <div className={cn('text-sm font-mono mb-8 tracking-wider', s.accent)}>{s.n}</div>
              <h3 className="text-xl font-semibold tracking-tight mb-3">{s.title}</h3>
              <p className="text-[15px] text-white/60 leading-relaxed">{s.desc}</p>
              <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="relative px-6 py-32">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: easeOut }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.10] bg-gradient-to-br from-violet-600/25 via-black/30 to-fuchsia-600/25 px-8 sm:px-14 py-16 sm:py-20 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.30),transparent_70%)] pointer-events-none" />
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-fuchsia-500/30 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-cyan-500/20 blur-[80px] pointer-events-none" />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Ta prochaine vidéo,
              <br />
              <span className="gradient-text-hero">en 3 minutes.</span>
            </h2>
            <p className="mt-6 text-lg text-white/65 max-w-xl mx-auto">
              Rejoins les créateurs qui gagnent du temps sans sacrifier la qualité.
            </p>
            <Link
              href="/signup"
              className="group mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white font-semibold glow-cta hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
              <Sparkles className="w-4 h-4 relative" />
              <span className="relative">Commencer gratuitement</span>
              <ArrowRight className="w-4 h-4 relative transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-5 text-xs text-white/45">2 vidéos offertes · Sans carte bancaire</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-12 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-fuchsia-500/30">S</span>
          <span className="text-sm font-medium">SUTRA</span>
          <span className="text-xs text-white/50 ml-1">by Purama</span>
        </div>
        <nav className="flex items-center gap-6 text-xs text-white/60">
          <Link href="/pricing" className="hover:text-white/95 transition-colors">Tarifs</Link>
          <Link href="/aide" className="hover:text-white/95 transition-colors">Aide</Link>
          <Link href="/mentions-legales" className="hover:text-white/95 transition-colors">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-white/95 transition-colors">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  )
}

export default function AppWelcome() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="relative min-h-dvh bg-[#06050e] text-white overflow-x-hidden">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />

      {mounted && <span data-testid="landing-mounted" className="sr-only">mounted</span>}
    </main>
  )
}
