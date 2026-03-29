'use client'

import { useState, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Check,
  Sparkles,
  Crown,
  Zap,
  Rocket,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  id: string
  name: string
  icon: React.ElementType
  monthlyPrice: number
  annualPrice: number
  description: string
  features: PlanFeature[]
  popular?: boolean
  cta: string
  href: string
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    icon: Zap,
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Decouvre SUTRA sans engagement',
    features: [
      { text: '2 videos / mois', included: true },
      { text: 'Qualite 720p', included: true },
      { text: '3 templates', included: true },
      { text: 'Voix standard', included: true },
      { text: 'Filigrane SUTRA', included: true },
      { text: 'Voix clonees', included: false },
      { text: 'SUTRA Studio', included: false },
      { text: 'Publication directe', included: false },
    ],
    cta: 'Commencer gratuitement',
    href: '/signup',
  },
  {
    id: 'starter',
    name: 'Starter',
    icon: Sparkles,
    monthlyPrice: 9,
    annualPrice: 86,
    description: 'Pour les createurs qui demarrent',
    features: [
      { text: '10 videos / mois', included: true },
      { text: 'Qualite 720p', included: true },
      { text: '10 templates', included: true },
      { text: 'Voix premium', included: true },
      { text: 'Sans filigrane', included: true },
      { text: '1 reseau social', included: true },
      { text: 'Voix clonees', included: false },
      { text: 'SUTRA Studio', included: false },
    ],
    cta: 'Commencer',
    href: '/signup?plan=starter',
  },
  {
    id: 'creator',
    name: 'Createur',
    icon: Rocket,
    monthlyPrice: 29,
    annualPrice: 278,
    description: 'Pour les createurs serieux',
    popular: true,
    features: [
      { text: '50 videos / mois', included: true },
      { text: 'Qualite 1080p', included: true },
      { text: 'Templates illimites', included: true },
      { text: '3 voix clonees', included: true },
      { text: 'SUTRA Studio complet', included: true },
      { text: '3 reseaux sociaux', included: true },
      { text: '1 Autopilot', included: true },
      { text: 'Support prioritaire', included: true },
    ],
    cta: 'Choisir Createur',
    href: '/signup?plan=creator',
  },
  {
    id: 'empire',
    name: 'Empire',
    icon: Crown,
    monthlyPrice: 99,
    annualPrice: 950,
    description: 'Pour les empires de contenu',
    features: [
      { text: 'Videos illimitees', included: true },
      { text: 'Qualite 4K', included: true },
      { text: 'Templates illimites', included: true },
      { text: 'Voix illimitees', included: true },
      { text: 'SUTRA Studio + Export', included: true },
      { text: 'Reseaux illimites', included: true },
      { text: '5 Autopilots', included: true },
      { text: 'Support VIP 24/7', included: true },
    ],
    cta: 'Choisir Empire',
    href: '/signup?plan=empire',
  },
]

function formatPrice(price: number): string {
  if (price === 0) return '0'
  return price.toString().replace('.', ',')
}

export default function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      data-testid="pricing-section"
      id="pricing"
      ref={ref}
      className="relative py-20 sm:py-28"
    >
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-violet-500/[0.03] blur-[150px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Tarifs
          </span>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Un plan pour chaque{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              ambition
            </span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Commence gratuitement. Upgrade quand tu es pret.
          </p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span
            className={cn(
              'text-sm font-medium transition-colors',
              !isAnnual ? 'text-white' : 'text-white/40'
            )}
          >
            Mensuel
          </span>

          <button
            data-testid="billing-toggle"
            onClick={() => setIsAnnual((prev) => !prev)}
            className={cn(
              'relative w-14 h-7 rounded-full transition-colors duration-300',
              isAnnual
                ? 'bg-violet-600'
                : 'bg-white/10 border border-white/[0.08]'
            )}
            aria-label="Basculer entre facturation mensuelle et annuelle"
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm',
                isAnnual ? 'left-8' : 'left-1'
              )}
            />
          </button>

          <span
            className={cn(
              'text-sm font-medium transition-colors',
              isAnnual ? 'text-white' : 'text-white/40'
            )}
          >
            Annuel
          </span>

          <AnimatePresence>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-semibold text-green-400"
              >
                -20%
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {plans.map((plan, i) => {
            const Icon = plan.icon
            const price = isAnnual
              ? plan.annualPrice > 0
                ? Math.round((plan.annualPrice / 12) * 100) / 100
                : 0
              : plan.monthlyPrice

            return (
              <motion.div
                key={plan.id}
                data-testid={`plan-${plan.id}`}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                className={cn(
                  'relative rounded-2xl border p-6 sm:p-7 flex flex-col',
                  plan.popular
                    ? 'bg-violet-500/[0.06] border-violet-500/30 shadow-[0_0_40px_-12px_rgba(139,92,246,0.3)]'
                    : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]',
                  'backdrop-blur-xl transition-all duration-300'
                )}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-violet-500/30">
                      <Sparkles className="w-3 h-3" />
                      Populaire
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      plan.popular
                        ? 'bg-violet-500/20 border border-violet-500/30'
                        : 'bg-white/[0.06] border border-white/[0.08]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-5 h-5',
                        plan.popular ? 'text-violet-400' : 'text-white/60'
                      )}
                    />
                  </div>
                  <h3
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {plan.name}
                  </h3>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <div className="flex items-baseline gap-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`${plan.id}-${isAnnual}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className="text-4xl font-bold text-white"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {formatPrice(price)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-lg text-white/40 font-medium">
                      EUR
                    </span>
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">
                    {plan.monthlyPrice === 0
                      ? 'Pour toujours'
                      : isAnnual
                        ? `${formatPrice(plan.annualPrice)} EUR / an`
                        : '/ mois'}
                  </p>
                </div>

                <p className="text-sm text-white/50 mb-6">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f.text}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check
                        className={cn(
                          'w-4 h-4 mt-0.5 flex-shrink-0',
                          f.included
                            ? plan.popular
                              ? 'text-violet-400'
                              : 'text-white/60'
                            : 'text-white/15'
                        )}
                      />
                      <span
                        className={
                          f.included ? 'text-white/70' : 'text-white/25'
                        }
                      >
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.href}
                  className={cn(
                    'w-full py-3 rounded-xl text-center text-sm font-semibold transition-all duration-200 active:scale-[0.97]',
                    plan.popular
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'
                      : 'bg-white/5 border border-white/[0.08] text-white/80 hover:bg-white/10 hover:border-white/[0.15]'
                  )}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Sub-note */}
        <p className="text-center text-xs text-white/30 mt-8">
          Tous les prix sont en euros. TVA non applicable, art. 293B du CGI.
          Annule a tout moment.
        </p>
      </div>
    </section>
  )
}
