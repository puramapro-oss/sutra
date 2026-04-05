'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Users,
  Globe,
  Newspaper,
  MapPin,
  ChevronDown,
  ArrowRight,
  Zap,
  TrendingUp,
  DollarSign,
  Star,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

const CHANNELS = [
  {
    id: 'influencer',
    label: 'Influenceur',
    icon: Star,
    description:
      'Tu as une audience sur les réseaux ? Monétise-la en recommandant SUTRA à ta communauté. Commissions récurrentes à vie.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'website',
    label: 'Website',
    icon: Globe,
    description:
      'Intègre SUTRA sur ton site ou blog. Liens trackés, bannières et widgets personnalisés pour maximiser tes conversions.',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'media',
    label: 'Média',
    icon: Newspaper,
    description:
      'Journaliste, podcasteur ou créateur de contenu éditorial ? Parle de SUTRA et touche des commissions sur chaque inscription.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'physical',
    label: 'Physique',
    icon: MapPin,
    description:
      'Organise des ateliers, formations ou événements en présentiel. Bonus exclusifs pour les partenaires terrain.',
    color: 'from-emerald-500 to-teal-600',
  },
]

const TIERS = [
  { filleuls: 10, gains: 50 },
  { filleuls: 25, gains: 150 },
  { filleuls: 50, gains: 400 },
  { filleuls: 100, gains: 1000 },
  { filleuls: 250, gains: 3000 },
  { filleuls: 500, gains: 6500 },
]

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne le programme de partenariat SUTRA ?',
    a: 'Tu reçois un lien unique et un QR code. Chaque personne qui s\'inscrit via ton lien devient ton filleul. Tu touches 50 % de son premier paiement + 10 % de tous ses paiements récurrents à vie.',
  },
  {
    q: 'Quand et comment suis-je payé ?',
    a: 'Les commissions sont créditées automatiquement dans ton wallet SUTRA. Tu peux demander un retrait dès 5 € par virement IBAN. Les paiements sont traités sous 14 jours.',
  },
  {
    q: 'Puis-je cumuler plusieurs canaux ?',
    a: 'Oui, tu peux être influenceur et organiser des ateliers physiques en même temps. Tes filleuls sont comptabilisés ensemble pour tes paliers de récompenses.',
  },
  {
    q: 'Y a-t-il un coût pour devenir partenaire ?',
    a: 'Non, le programme est 100 % gratuit. Tu n\'as rien à payer. Tu gagnes uniquement des commissions sur les inscriptions et abonnements générés.',
  },
  {
    q: 'Quels outils sont mis à ma disposition ?',
    a: 'Un dashboard complet avec statistiques en temps réel, un générateur de QR code, un coach IA personnalisé, des kits marketing et un système UTM pour tracker tes campagnes.',
  },
]

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1500
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, target])

  return (
    <span ref={ref}>
      {value.toLocaleString('fr-FR')}
      {suffix}
    </span>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl overflow-hidden">
      <button
        data-testid={`faq-toggle-${q.slice(0, 20).replace(/\s/g, '-')}`}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-5 text-left text-white/90 hover:text-white transition-colors"
      >
        <span className="font-medium pr-4">{q}</span>
        <ChevronDown
          className={cn(
            'w-5 h-5 shrink-0 text-white/40 transition-transform duration-300',
            open && 'rotate-180'
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-white/60 text-sm leading-relaxed">{a}</p>
      </motion.div>
    </div>
  )
}

export default function PartenariatPage() {
  const [sliderValue, setSliderValue] = useState(25)

  const estimatedGains = (() => {
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (sliderValue >= TIERS[i].filleuls) return TIERS[i].gains
    }
    return Math.round(sliderValue * 5)
  })()

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/8 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Programme Partenaire
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                Deviens partenaire SUTRA
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10">
              Recommande SUTRA et touche des commissions récurrentes à vie.
              50 % du premier paiement + 10 % de chaque renouvellement.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/partenariat/influencer">
                <Button variant="primary" size="lg" data-testid="cta-devenir-partenaire">
                  Devenir partenaire
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <a href="#simulateur">
                <Button variant="secondary" size="lg" data-testid="cta-simuler-gains">
                  Simuler mes gains
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { label: 'Partenaires actifs', value: 240, suffix: '+' },
            { label: 'Commissions versées', value: 18500, suffix: ' €' },
            { label: 'Filleuls inscrits', value: 3200, suffix: '+' },
            { label: 'Taux de conversion', value: 12, suffix: ' %' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6 text-center"
            >
              <p className="text-2xl sm:text-3xl font-bold text-white">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm text-white/50 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Channels */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Choisis ton canal
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {CHANNELS.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link href={`/partenariat/${ch.id}`} data-testid={`channel-${ch.id}`}>
                  <div className="group bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6 hover:border-white/[0.12] transition-all duration-300 h-full">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4',
                        ch.color
                      )}
                    >
                      <ch.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-violet-400 transition-colors">
                      {ch.label}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {ch.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-violet-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Commencer <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section id="simulateur" className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simule tes gains
          </h2>
          <p className="text-center text-white/50 mb-10">
            Déplace le curseur pour estimer tes commissions mensuelles.
          </p>
          <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-2xl p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/60 text-sm">Nombre de filleuls</span>
              <span className="text-white font-bold text-lg">{sliderValue}</span>
            </div>
            <input
              type="range"
              min={1}
              max={500}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              data-testid="simulator-slider"
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/40"
            />
            <div className="flex justify-between text-xs text-white/30 mt-1 mb-8">
              <span>1</span>
              <span>500</span>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm mb-2">Gains estimés</p>
              <motion.p
                key={estimatedGains}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent"
              >
                {estimatedGains.toLocaleString('fr-FR')} €
              </motion.p>
              <p className="text-white/30 text-xs mt-2">
                + 10 % récurrent à vie sur chaque renouvellement
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">
            Paliers de récompenses
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { name: 'Bronze', filleuls: 5, icon: '🥉' },
              { name: 'Argent', filleuls: 10, icon: '🥈' },
              { name: 'Or', filleuls: 25, icon: '🥇' },
              { name: 'Platine', filleuls: 50, icon: '💎' },
              { name: 'Diamant', filleuls: 75, icon: '👑' },
              { name: 'Légende', filleuls: 100, icon: '🌟' },
            ].map((tier) => (
              <div
                key={tier.name}
                className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-5 text-center"
              >
                <p className="text-2xl mb-2">{tier.icon}</p>
                <p className="font-semibold text-white">{tier.name}</p>
                <p className="text-xs text-white/40 mt-1">{tier.filleuls} filleuls</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à rejoindre le programme ?
          </h2>
          <p className="text-white/50 mb-8 max-w-xl mx-auto">
            Inscris-toi en 2 minutes et commence à gagner des commissions dès aujourd&apos;hui.
          </p>
          <Link href="/partenariat/influencer">
            <Button variant="primary" size="lg" data-testid="cta-bottom-devenir-partenaire">
              Devenir partenaire SUTRA
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer links */}
      <footer className="py-8 px-4 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-white/40">
          <Link href="/mentions-legales" className="hover:text-white/70 transition-colors">
            Mentions légales
          </Link>
          <Link href="/cgv" className="hover:text-white/70 transition-colors">
            CGV
          </Link>
          <Link href="/politique-confidentialite" className="hover:text-white/70 transition-colors">
            Politique de confidentialité
          </Link>
        </div>
      </footer>
    </div>
  )
}
