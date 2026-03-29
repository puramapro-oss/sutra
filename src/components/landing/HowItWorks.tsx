'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { MessageSquare, Cpu, Rocket } from 'lucide-react'

const steps = [
  {
    icon: MessageSquare,
    number: '01',
    title: 'Donne ton sujet',
    description:
      'Decris ton idee en quelques mots. Choisis ta niche, ton style et ta duree. C\'est tout ce qu\'on te demande.',
  },
  {
    icon: Cpu,
    number: '02',
    title: 'L\'IA cree ta video',
    description:
      'Script, voix, visuels, musique, montage. Notre pipeline IA genere ta video complete en quelques minutes.',
  },
  {
    icon: Rocket,
    number: '03',
    title: 'Publie partout',
    description:
      'Telecharge ta video ou publie-la directement sur YouTube, TikTok, Instagram. Formats optimises inclus.',
  },
]

export default function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      data-testid="how-it-works-section"
      id="how-it-works"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Comment ca marche
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Trois etapes.{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Zero complication.
            </span>
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6">
          {/* Connecting line — desktop only */}
          <div className="hidden lg:block absolute top-[72px] left-[16.67%] right-[16.67%] h-[2px]">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={isInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-gradient-to-r from-violet-500/40 via-violet-500/60 to-violet-500/40 origin-left"
            />
            {/* Animated dots on the line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.3, delay: 1.2 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-lg shadow-violet-500/50"
            />
          </div>

          {/* Connecting line — mobile only */}
          <div className="lg:hidden absolute left-[28px] top-[100px] bottom-[100px] w-[2px]">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={isInView ? { scaleY: 1 } : {}}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full bg-gradient-to-b from-violet-500/40 via-violet-500/60 to-violet-500/40 origin-top"
            />
          </div>

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                className="relative flex lg:flex-col items-start lg:items-center gap-5 lg:gap-0 lg:text-center"
              >
                {/* Number circle */}
                <div className="relative z-10 flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25 lg:mb-6">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#06050e] border border-violet-500/40 flex items-center justify-center text-[10px] font-bold text-violet-400">
                    {step.number}
                  </span>
                </div>

                <div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed max-w-xs lg:mx-auto">
                    {step.description}
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
