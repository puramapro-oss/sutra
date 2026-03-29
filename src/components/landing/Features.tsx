'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Brain,
  Mic,
  Film,
  Music,
  Scissors,
  Share2,
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Script IA intelligent',
    description:
      'Notre IA analyse ta niche et genere un script engageant, optimise pour la retention et la viralite.',
  },
  {
    icon: Mic,
    title: 'Voix realistes',
    description:
      'Plus de 30 voix naturelles avec emotion, intonation et rythme. Clone ta propre voix en quelques secondes.',
  },
  {
    icon: Film,
    title: 'Visuels cinematiques',
    description:
      'Chaque scene est generee avec des visuels uniques en haute definition. Zero banque d\'images generique.',
  },
  {
    icon: Music,
    title: 'Musique originale',
    description:
      'Une bande-son originale composee par IA, parfaitement synchronisee avec le rythme de ta video.',
  },
  {
    icon: Scissors,
    title: 'Montage automatique',
    description:
      'Transitions fluides, sous-titres dynamiques, effets visuels. Le tout assemble automatiquement.',
  },
  {
    icon: Share2,
    title: 'Publication multi-plateforme',
    description:
      'Publie directement sur YouTube, TikTok, Instagram et plus. Formats optimises pour chaque plateforme.',
  },
]

export default function Features() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      data-testid="features-section"
      id="features"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      {/* Section glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-violet-500/[0.03] blur-[150px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Fonctionnalites
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Tout ce qu&apos;il te faut.{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Rien de plus.
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            De l&apos;idee a la video publiee, SUTRA gere chaque etape du processus de creation.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6 sm:p-8 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all duration-300 cursor-default"
              >
                {/* Spotlight effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/[0.08] via-transparent to-transparent" />
                </div>

                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5 group-hover:bg-violet-500/15 group-hover:border-violet-500/30 transition-all duration-300">
                    <Icon className="w-6 h-6 text-violet-400 group-hover:text-violet-300 transition-colors" />
                  </div>

                  <h3
                    className="text-lg font-semibold text-white mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {feature.title}
                  </h3>

                  <p className="text-sm text-white/50 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
