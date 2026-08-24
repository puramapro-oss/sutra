import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'

const easeOut = [0.22, 1, 0.36, 1] as const

export function LandingCTA() {
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
