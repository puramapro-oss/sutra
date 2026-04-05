import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, Mic, Film, Music, Scissors, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Comment ca marche — SUTRA',
  description:
    'Decouvre comment SUTRA genere des videos completes par IA en quelques minutes : script, voix, visuels, musique et montage automatique.',
  keywords: [
    'comment ca marche',
    'generation video IA',
    'pipeline video',
    'SUTRA',
    'Purama',
  ],
  openGraph: {
    title: 'Comment ca marche — SUTRA',
    description:
      'Donne un sujet. Recois une video prete a publier. Decouvre le pipeline IA de SUTRA.',
    url: 'https://sutra.purama.dev/how-it-works',
    images: [{ url: 'https://sutra.purama.dev/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    canonical: 'https://sutra.purama.dev/how-it-works',
  },
}

const steps = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Decris ta video',
    description:
      'Donne un sujet, un ton, une duree. Claude genere un script professionnel scene par scene avec les indications visuelles.',
    color: 'from-violet-500 to-purple-500',
  },
  {
    number: '02',
    icon: Mic,
    title: 'Voix off IA',
    description:
      'ElevenLabs synthetise une voix off naturelle et expressive. Choisis parmi des dizaines de voix ou clone la tienne.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '03',
    icon: Film,
    title: 'Visuels generes',
    description:
      'Chaque scene est illustree par des visuels generes par IA ou des clips video HD. Le tout adapte au script automatiquement.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    number: '04',
    icon: Music,
    title: 'Musique originale',
    description:
      'Suno compose une musique de fond originale qui colle parfaitement a l\'ambiance de ta video. Aucun risque de copyright.',
    color: 'from-orange-500 to-amber-500',
  },
  {
    number: '05',
    icon: Scissors,
    title: 'Montage automatique',
    description:
      'Shotstack assemble le tout : transitions, sous-titres, timing audio. Tu recois une video prete a publier en quelques minutes.',
    color: 'from-pink-500 to-rose-500',
  },
]

export default function HowItWorksPage() {
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Pipeline IA
          </span>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Comment ca{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              marche
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            5 etapes, 100% automatisees. Donne un sujet, recois une video professionnelle prete a publier.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={i}
                className="relative flex gap-6 sm:gap-8 items-start"
                data-testid={`step-${step.number}`}
              >
                {/* Number + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-lg`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-full min-h-[40px] bg-white/[0.08] mt-3" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <span className="text-xs font-mono text-white/30 uppercase tracking-wider">
                    Etape {step.number}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed max-w-lg">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-lg transition-all shadow-xl shadow-violet-500/20"
            data-testid="hiw-cta"
          >
            Creer ma premiere video
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-white/30 text-sm mt-4">
            Gratuit pour commencer. Aucune carte requise.
          </p>
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
