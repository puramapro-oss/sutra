import type { Metadata } from 'next'
import PricingSection from '@/components/landing/PricingSection'
import FAQ from '@/components/landing/FAQ'
import CTASection from '@/components/landing/CTASection'
import Footer from '@/components/landing/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tarifs — Plans et abonnements SUTRA',
  description:
    'Decouvre les plans SUTRA : Free, Starter, Createur et Empire. Generation video IA a partir de 0 EUR/mois. -20% sur la facturation annuelle.',
  keywords: [
    'tarifs SUTRA',
    'prix generation video IA',
    'abonnement video IA',
    'plan createur video',
    'SUTRA pricing',
  ],
  openGraph: {
    title: 'Tarifs — Plans et abonnements SUTRA',
    description:
      'Generation video IA a partir de 0 EUR/mois. Plans flexibles pour chaque ambition.',
    url: 'https://sutra.purama.dev/pricing',
    type: 'website',
    images: [{ url: 'https://sutra.purama.dev/api/og', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    canonical: 'https://sutra.purama.dev/pricing',
  },
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      {/* Nav simple */}
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
              href="/login"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Connexion
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

      {/* Financer banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        <Link
          href="/financer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/15 transition-colors"
          data-testid="financer-banner"
        >
          <span>💰</span>
          <span>La plupart de nos clients ne paient rien grace aux aides.</span>
          <span className="underline underline-offset-2 font-semibold">Verifier mon eligibilite</span>
          <span>→</span>
        </Link>
      </div>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQ />

      {/* CTA */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </main>
  )
}
