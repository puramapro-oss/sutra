'use client'

import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Percent, Gift } from 'lucide-react'

const TARGET_APP = {
  slug: 'akasha',
  name: 'AKASHA',
  domain: 'akasha.purama.dev',
  tagline: 'Multi-IA conversationnelle',
  description: 'GPT, Claude, Gemini, Grok dans une seule app. Switche de cerveau en un clic.',
  accent: '#06B6D4',
  gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(139, 92, 246, 0.18))',
}

export function CrossPromoBlock() {
  const source = 'sutra'
  const href = `https://${TARGET_APP.domain}/go/${source}?coupon=WELCOME50`

  return (
    <motion.section
      data-testid="bloc-cross-promo"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card p-5 sm:p-6 relative overflow-hidden"
      style={{ background: TARGET_APP.gradient }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(700px circle at 50% 100%, rgba(6, 182, 212, 0.2), transparent 55%)',
        }}
      />

      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5">
        <div
          aria-hidden
          className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-2xl md:text-3xl font-bold shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${TARGET_APP.accent}, #7C3AED)`,
            color: '#0A0A0F',
          }}
        >
          A
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-white text-base sm:text-lg">
              Découvre {TARGET_APP.name}
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/25 border border-cyan-400/40 text-cyan-100 text-[10px] font-bold uppercase tracking-wide">
              <Percent className="h-3 w-3" /> -50% mois 1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-white/80 mb-2">
            <span className="font-medium">{TARGET_APP.tagline}.</span> {TARGET_APP.description}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-white/60 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3 w-3 text-cyan-300" />
              <strong className="text-cyan-200">100 €</strong> de prime cumulable
            </span>
            <span className="hidden sm:inline text-white/30">•</span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-300" />
              Ton premier mois coûte <strong className="text-white">4,99 €</strong>
            </span>
          </div>
        </div>

        <a
          data-testid="cross-promo-cta"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0A0A0F] text-sm font-semibold hover:bg-cyan-50 transition-all shadow-lg active:scale-[0.98] whitespace-nowrap"
        >
          Essayer {TARGET_APP.name}
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </motion.section>
  )
}
