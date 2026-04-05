import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Scale,
  Brain,
  Heart,
  Languages,
  Coins,
  Gift,
  Plane,
  Building2,
  Leaf,
  Cpu,
  Compass,
  Users,
  ArrowRight,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Ecosysteme Purama — Toutes les apps IA',
  description:
    'Decouvre l\'ecosysteme Purama : 12+ applications IA specialisees. Droit, beaute, sante, langues, finance, dons, voyages, entreprise et plus.',
  openGraph: {
    title: 'Ecosysteme Purama — Toutes les apps IA',
    description:
      'Un ecosysteme complet d\'applications IA. Chaque app, un domaine d\'expertise.',
    url: 'https://sutra.purama.dev/ecosystem',
    images: [{ url: 'https://sutra.purama.dev/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    canonical: 'https://sutra.purama.dev/ecosystem',
  },
}

const apps = [
  {
    name: 'JurisPurama',
    description: 'Assistant juridique IA — droit francais',
    icon: Scale,
    color: '#6D28D9',
    url: 'https://jurispurama.purama.dev',
  },
  {
    name: 'KAIA',
    description: 'Coach beaute et bien-etre IA',
    icon: Brain,
    color: '#06B6D4',
    url: 'https://kaia.purama.dev',
  },
  {
    name: 'VIDA',
    description: 'Assistant sante et nutrition IA',
    icon: Heart,
    color: '#10B981',
    url: 'https://vida.purama.dev',
  },
  {
    name: 'Lingora',
    description: 'Apprends n\'importe quelle langue par IA',
    icon: Languages,
    color: '#3B82F6',
    url: 'https://lingora.purama.dev',
  },
  {
    name: 'KASH',
    description: 'Gestion financiere personnelle IA',
    icon: Coins,
    color: '#F59E0B',
    url: 'https://kash.purama.dev',
  },
  {
    name: 'DONA',
    description: 'Plateforme de dons et solidarite',
    icon: Gift,
    color: '#EC4899',
    url: 'https://dona.purama.dev',
  },
  {
    name: 'VOYA',
    description: 'Planificateur de voyages IA',
    icon: Plane,
    color: '#38BDF8',
    url: 'https://voya.purama.dev',
  },
  {
    name: 'EntreprisePilot',
    description: 'Pilotage entreprise par IA',
    icon: Building2,
    color: '#6366F1',
    url: 'https://entreprisepilot.purama.dev',
  },
  {
    name: 'Impact OS',
    description: 'Mesure ton impact carbone',
    icon: Leaf,
    color: '#14B8A6',
    url: 'https://impactos.purama.dev',
  },
  {
    name: 'Purama AI',
    description: 'Assistant IA generaliste avance',
    icon: Cpu,
    color: '#8B5CF6',
    url: 'https://ai.purama.dev',
  },
  {
    name: 'Purama Origin',
    description: 'Decouvre tes origines culturelles',
    icon: Compass,
    color: '#D946EF',
    url: 'https://origin.purama.dev',
  },
  {
    name: 'Purama Social',
    description: 'Reseau social nouvelle generation',
    icon: Users,
    color: '#F97316',
    url: 'https://social.purama.dev',
  },
]

export default function EcosystemPage() {
  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-orbitron)' }}
            data-testid="header-logo"
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Tarifs
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
            >
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Ecosysteme
          </span>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            L&apos;univers{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Purama
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Un ecosysteme complet d&apos;applications IA. Chaque app, un domaine d&apos;expertise. Un seul compte pour tout.
          </p>
        </div>

        {/* Promo */}
        <div className="mb-12 p-4 sm:p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-center">
          <p className="text-sm text-violet-300">
            <span className="font-bold">CROSS33</span> — Utilise le code pour obtenir{' '}
            <span className="font-bold text-white">-33%</span> sur n&apos;importe quelle app de l&apos;ecosysteme
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => {
            const Icon = app.icon
            return (
              <Link
                key={app.name}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 hover:border-white/[0.12] hover:bg-white/[0.05] transition-all"
                data-testid={`ecosystem-${app.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${app.color}15`, borderColor: `${app.color}30` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: app.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                      {app.name}
                    </h3>
                    <p className="text-xs text-white/40 mt-1">{app.description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 text-center">
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  )
}
