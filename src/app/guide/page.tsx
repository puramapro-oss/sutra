'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Video,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Zap,
  Gift,
  Share2,
} from 'lucide-react'
import { sections, colorMap } from '@/data/guide'

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 25, stiffness: 300 } },
}

export default function GuidePage() {
  const relaunchTutorial = useCallback(() => {
    localStorage.removeItem('sutra_tutorial_dismissed')
    window.dispatchEvent(new Event('sutra-relaunch-tutorial'))
    window.location.href = '/dashboard'
  }, [])

  return (
    <div className="min-h-dvh bg-[#06050e]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#06050e]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors"
            data-testid="guide-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour</span>
          </Link>
          <button
            onClick={relaunchTutorial}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-300 text-sm font-medium rounded-xl transition-colors"
            data-testid="guide-relaunch"
          >
            <RotateCcw className="w-4 h-4" />
            Relancer le tuto
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            Guide complet
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Tout savoir sur{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Decouvre chaque fonctionnalite et deviens un pro de la creation video IA.
          </p>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-12"
        >
          {[
            { icon: Zap, label: 'Generation IA', value: '< 3 min' },
            { icon: Gift, label: 'Essai gratuit', value: '5 videos' },
            { icon: Share2, label: 'Reseaux', value: '3 plateformes' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
            >
              <stat.icon className="w-5 h-5 text-violet-400 mx-auto mb-2" />
              <div className="text-lg font-semibold text-white">{stat.value}</div>
              <div className="text-xs text-white/40">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Sections */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {sections.map((section, i) => {
            const colors = colorMap[section.color] ?? colorMap.slate
            const Icon = section.icon

            return (
              <motion.div
                key={i}
                variants={fadeUp}
                className={`rounded-2xl border ${colors.border} ${colors.bg} p-6 shadow-lg ${colors.glow}`}
                data-testid={`guide-section-${i}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${colors.bg} border ${colors.border} shrink-0`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-white mb-2">
                      {section.title}
                    </h2>
                    {section.description && (
                      <p className="text-sm text-white/50 leading-relaxed mb-3">
                        {section.description}
                      </p>
                    )}
                    {section.steps && (
                      <ol className="space-y-2">
                        {section.steps.map((step, j) => (
                          <li key={j} className="flex items-start gap-3 text-sm">
                            <span className={`w-5 h-5 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0 text-xs ${colors.text} font-medium mt-0.5`}>
                              {j + 1}
                            </span>
                            <span className="text-white/60 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-12"
        >
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-violet-500/20"
            data-testid="guide-cta"
          >
            <Video className="w-5 h-5" />
            Creer ma premiere video
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
