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

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] as const },
  }),
}

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/30 backdrop-blur-xl px-4 sm:px-5 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
            S
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
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-white text-black px-3.5 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
          >
            Commencer
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -80])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.4])

  return (
    <section ref={ref} className="relative min-h-[92vh] flex items-center justify-center px-6 pt-32 pb-24 overflow-hidden">
      {/* Gradient backdrop — clean, no dots */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(139,92,246,0.25),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_30%,rgba(217,70,239,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_15%_70%,rgba(59,130,246,0.10),transparent_65%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#06050e]" />
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-4xl text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={0}
          className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-md text-xs text-white/70"
        >
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-70" />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-violet-400" />
          </span>
          Générateur vidéo IA · Nouveau
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={1}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-semibold tracking-[-0.03em] leading-[0.98]"
        >
          La vidéo,
          <br />
          <span className="bg-gradient-to-br from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
            réinventée par l'IA.
          </span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={2}
          className="mt-7 text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
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
            className={cn(
              'group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl',
              'bg-white text-black font-medium text-[15px]',
              'shadow-[0_10px_40px_-10px_rgba(255,255,255,0.3)]',
              'hover:shadow-[0_20px_60px_-10px_rgba(139,92,246,0.5)] hover:bg-white/95',
              'transition-all duration-300'
            )}
          >
            <Sparkles className="w-4 h-4" />
            Créer ma première vidéo
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/80 hover:bg-white/[0.06] hover:text-white text-[15px] transition-colors"
          >
            Voir une démo
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <motion.p
          initial="hidden"
          animate="visible"
          variants={fade}
          custom={4}
          className="mt-8 text-xs text-white/40"
        >
          Gratuit — 2 vidéos offertes · Sans carte bancaire
        </motion.p>
      </motion.div>

      {/* Video preview card — glass */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
        className="absolute bottom-[-120px] left-1/2 -translate-x-1/2 w-[92%] max-w-4xl aspect-[16/9] rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-violet-500/10 via-black/40 to-fuchsia-500/10 backdrop-blur-xl shadow-2xl shadow-black/50 hidden md:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_70%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-white/50">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Prévisualisation — génération en cours
          </div>
        </div>
      </motion.div>
    </section>
  )
}

const features = [
  {
    icon: PenLine,
    title: 'Script rédigé',
    desc: 'Une IA narrative conçoit l’accroche, le rythme et la chute. Zéro page blanche.',
  },
  {
    icon: Mic,
    title: 'Voix humaine',
    desc: 'Voix IA naturelle multi-langues, intonation ajustée à ton sujet.',
  },
  {
    icon: Clapperboard,
    title: 'Visuels calés',
    desc: 'Plans générés ou stock premium, synchronisés au montage par IA.',
  },
  {
    icon: Music2,
    title: 'Musique adaptative',
    desc: 'Ambiance sonore choisie selon le ton — énergique, posé, cinématique.',
  },
  {
    icon: Zap,
    title: 'Prêt en minutes',
    desc: 'Export 1080p vertical ou horizontal, optimisé TikTok, Reels, YouTube Shorts.',
  },
  {
    icon: Wand2,
    title: 'Itérations magiques',
    desc: 'Ajuste une phrase, change un plan, regénère. Ta vidéo évolue en temps réel.',
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
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-medium tracking-[0.2em] text-violet-300/80 uppercase mb-4">
            Tout-en-un
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Un studio complet,
            <br />
            <span className="text-white/40">piloté par l'IA.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as const }}
              className="group relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/0 via-violet-500/0 to-fuchsia-500/0 group-hover:from-violet-500/[0.08] group-hover:to-fuchsia-500/[0.04] transition-all duration-500 pointer-events-none" />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
                  <f.icon className="w-5 h-5 text-violet-300" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{f.title}</h3>
                <p className="text-[15px] text-white/55 leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = [
  { n: '01', title: 'Donne un sujet', desc: 'Un thème, une URL, une idée brute. SUTRA comprend ton intention.' },
  { n: '02', title: 'L\'IA construit', desc: 'Script, voix, visuels, musique, montage — tout est généré et synchronisé.' },
  { n: '03', title: 'Publie partout', desc: 'Export optimisé TikTok, Reels, Shorts. Itère en un clic si besoin.' },
]

function HowItWorks() {
  return (
    <section className="relative px-6 py-32">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
          className="max-w-2xl mb-16"
        >
          <p className="text-xs font-medium tracking-[0.2em] text-violet-300/80 uppercase mb-4">
            Comment ça marche
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Trois étapes.
            <br />
            <span className="text-white/40">Pas une de plus.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const }}
              className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl"
            >
              <div className="text-sm font-mono text-violet-300/70 mb-8">{s.n}</div>
              <h3 className="text-xl font-semibold tracking-tight mb-3">{s.title}</h3>
              <p className="text-[15px] text-white/55 leading-relaxed">{s.desc}</p>
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
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
          className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-violet-600/20 via-black/40 to-fuchsia-600/20 px-8 sm:px-14 py-16 sm:py-20 text-center"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18),transparent_70%)] pointer-events-none" />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
              Ta prochaine vidéo,
              <br />
              <span className="bg-gradient-to-br from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                en 3 minutes.
              </span>
            </h2>
            <p className="mt-6 text-lg text-white/60 max-w-xl mx-auto">
              Rejoins les créateurs qui gagnent du temps sans sacrifier la qualité.
            </p>
            <Link
              href="/signup"
              className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-medium hover:bg-white/95 transition-all shadow-[0_20px_60px_-10px_rgba(139,92,246,0.5)]"
            >
              Commencer gratuitement
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-5 text-xs text-white/40">2 vidéos offertes · Sans carte bancaire</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.04] px-6 py-12 mt-12">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs">S</span>
          <span className="text-sm font-medium">SUTRA</span>
          <span className="text-xs text-white/30 ml-1">by Purama</span>
        </div>
        <nav className="flex items-center gap-6 text-xs text-white/40">
          <Link href="/pricing" className="hover:text-white/70 transition-colors">Tarifs</Link>
          <Link href="/aide" className="hover:text-white/70 transition-colors">Aide</Link>
          <Link href="/mentions-legales" className="hover:text-white/70 transition-colors">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-white/70 transition-colors">Confidentialité</Link>
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
      {/* Global backdrop: clean dark gradient, no particles */}
      <div className="fixed inset-0 pointer-events-none -z-10" aria-hidden>
        <div className="absolute inset-0 bg-[#06050e]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.15),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />

      {/* Mount marker for hydration-safe tests */}
      {mounted && <span data-testid="landing-mounted" className="sr-only">mounted</span>}
    </main>
  )
}
