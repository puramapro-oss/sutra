import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, FileText, Cookie, ArrowRight, Scale, ShoppingCart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Mentions legales — SUTRA',
  description:
    'Informations legales de SUTRA by Purama. Conditions d\'utilisation, politique de confidentialite RGPD et gestion des cookies.',
  openGraph: {
    title: 'Mentions legales — SUTRA',
    description: 'Informations legales de SUTRA by Purama.',
    url: 'https://sutra.purama.dev/legal',
  },
  alternates: {
    canonical: 'https://sutra.purama.dev/legal',
  },
}

const pages = [
  {
    href: '/legal/terms',
    icon: FileText,
    title: 'Conditions generales d\'utilisation (CGU)',
    description:
      'Les regles qui regissent l\'utilisation de SUTRA. Droits, obligations et responsabilites.',
  },
  {
    href: '/legal/cgv',
    icon: ShoppingCart,
    title: 'Conditions generales de vente (CGV)',
    description:
      'Abonnements, prix, paiement, droit de retractation et garanties.',
  },
  {
    href: '/legal/privacy',
    icon: Shield,
    title: 'Politique de confidentialite',
    description:
      'Comment nous collectons, utilisons et protegeons tes donnees personnelles. Conforme RGPD.',
  },
  {
    href: '/legal/cookies',
    icon: Cookie,
    title: 'Politique de cookies',
    description:
      'Informations sur les cookies utilises par SUTRA et comment gerer tes preferences.',
  },
  {
    href: '/legal/mentions',
    icon: Scale,
    title: 'Mentions legales',
    description:
      'Identification de l\'editeur, hebergeur et directeur de publication.',
  },
]

export default function LegalPage() {
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
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-16">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Informations{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              legales
            </span>
          </h1>
          <p className="text-white/50">
            Transparence et conformite. Toutes nos obligations legales.
          </p>
        </div>

        {/* Editeur info */}
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6">
          <h2 className="text-sm font-bold text-white mb-3">Editeur du site</h2>
          <div className="text-sm text-white/50 space-y-1">
            <p><strong className="text-white/70">PURAMA SASU</strong></p>
            <p>Societe par actions simplifiee unipersonnelle au capital de 1 euro</p>
            <p>Siege social : 8 Rue de la Chapelle, 25560 Frasne, France</p>
            <p>RCS en cours d&apos;immatriculation</p>
            <p>TVA non applicable — Article 293B du Code General des Impots</p>
            <p>Directeur de la publication : Matiss Frasne</p>
            <p>Contact : matiss.frasne@gmail.com</p>
            <p>Hebergement : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA</p>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-4">
          {pages.map((page) => {
            const Icon = page.icon
            return (
              <Link
                key={page.href}
                href={page.href}
                className="group flex items-start gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 hover:border-white/[0.12] hover:bg-white/[0.05] transition-all"
                data-testid={`legal-link-${page.href.split('/').pop()}`}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                    {page.title}
                  </h3>
                  <p className="text-xs text-white/40 mt-1">
                    {page.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0 mt-1" />
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
