import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de cookies — SUTRA',
  description:
    'Politique de cookies de SUTRA. Decouvre quels cookies nous utilisons et comment les gerer.',
  openGraph: {
    title: 'Politique de cookies — SUTRA',
    description: 'Politique de cookies de SUTRA by Purama.',
    url: 'https://sutra.purama.dev/legal/cookies',
  },
  alternates: {
    canonical: 'https://sutra.purama.dev/legal/cookies',
  },
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  )
}

function CookieTable({
  cookies,
}: {
  cookies: { name: string; purpose: string; duration: string; type: string }[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.03]">
            <th className="px-4 py-3 text-white/70 font-medium">Cookie</th>
            <th className="px-4 py-3 text-white/70 font-medium">Finalite</th>
            <th className="px-4 py-3 text-white/70 font-medium">Duree</th>
            <th className="px-4 py-3 text-white/70 font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((c) => (
            <tr key={c.name} className="border-b border-white/[0.04] last:border-0">
              <td className="px-4 py-3 text-white/80 font-mono text-xs">{c.name}</td>
              <td className="px-4 py-3 text-white/50">{c.purpose}</td>
              <td className="px-4 py-3 text-white/50">{c.duration}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    c.type === 'Essentiel'
                      ? 'text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full text-xs'
                      : c.type === 'Analytique'
                        ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full text-xs'
                        : 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-xs'
                  }
                >
                  {c.type}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const essentialCookies = [
  {
    name: 'sb-access-token',
    purpose: 'Session d\'authentification Supabase',
    duration: 'Session',
    type: 'Essentiel',
  },
  {
    name: 'sb-refresh-token',
    purpose: 'Rafraichissement de session',
    duration: '7 jours',
    type: 'Essentiel',
  },
  {
    name: 'sutra-cookie-consent',
    purpose: 'Enregistre tes preferences de cookies',
    duration: '13 mois',
    type: 'Essentiel',
  },
  {
    name: 'sutra-theme',
    purpose: 'Theme visuel (dark/light)',
    duration: '1 an',
    type: 'Essentiel',
  },
]

const analyticCookies = [
  {
    name: 'ph_*',
    purpose: 'PostHog analytics (pages vues, interactions)',
    duration: '13 mois',
    type: 'Analytique',
  },
]

const marketingCookies = [
  {
    name: 'sutra-ref',
    purpose: 'Suivi du code de parrainage',
    duration: '30 jours',
    type: 'Marketing',
  },
  {
    name: 'sutra-utm',
    purpose: 'Suivi des parametres UTM de campagne',
    duration: '30 jours',
    type: 'Marketing',
  },
]

export default function CookiesPage() {
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
        <div className="mb-12">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">
            Legal
          </span>
          <h1
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Politique de cookies
          </h1>
          <p className="text-white/40 text-sm">
            Derniere mise a jour : 29 mars 2026
          </p>
        </div>

        <div className="space-y-10">
          <Section id="definition" title="1. Qu'est-ce qu'un cookie ?">
            <p>
              Un cookie est un petit fichier texte depose sur ton appareil
              (ordinateur, telephone, tablette) lorsque tu visites un site web.
              Les cookies permettent au site de se souvenir de tes preferences
              et de tes actions sur une certaine periode.
            </p>
          </Section>

          <Section id="essentiels" title="2. Cookies essentiels">
            <p>
              Ces cookies sont indispensables au fonctionnement de SUTRA. Ils
              permettent l&apos;authentification, la gestion de session et la
              memorisation de tes preferences. Ils ne peuvent pas etre
              desactives.
            </p>
            <CookieTable cookies={essentialCookies} />
          </Section>

          <Section id="analytiques" title="3. Cookies analytiques">
            <p>
              Ces cookies nous aident a comprendre comment SUTRA est utilise,
              quelles pages sont les plus visitees et comment ameliorer
              l&apos;experience. Les donnees sont anonymisees et hebergees en Europe
              (PostHog EU).
            </p>
            <CookieTable cookies={analyticCookies} />
          </Section>

          <Section id="marketing" title="4. Cookies marketing">
            <p>
              Ces cookies sont utilises pour le suivi du parrainage et des
              campagnes marketing. Ils nous permettent de crediter correctement
              les parrains et les influenceurs.
            </p>
            <CookieTable cookies={marketingCookies} />
          </Section>

          <Section id="gestion" title="5. Comment gerer les cookies ?">
            <p>
              Tu peux gerer tes preferences de cookies a tout moment :
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Via la banniere SUTRA :</strong>{' '}
                au premier acces, une banniere te permet d&apos;accepter, refuser ou
                personnaliser les cookies. Tu peux modifier tes choix a tout
                moment en vidant le localStorage de ton navigateur.
              </li>
              <li>
                <strong className="text-white/70">Via ton navigateur :</strong>{' '}
                la plupart des navigateurs permettent de bloquer ou supprimer les
                cookies dans les parametres de confidentialite. Consulte la
                documentation de ton navigateur (Chrome, Firefox, Safari, Edge).
              </li>
            </ul>
            <p>
              Note : la desactivation de certains cookies peut affecter le
              fonctionnement de SUTRA, notamment l&apos;authentification et la
              memorisation de tes preferences.
            </p>
          </Section>

          <Section id="duree" title="6. Duree de conservation">
            <p>
              Conformement a la reglementation, les cookies de consentement sont
              conserves pour une duree maximale de 13 mois. Les cookies de
              session sont supprimes a la fermeture du navigateur. Les autres
              cookies ont une duree de vie indiquee dans les tableaux ci-dessus.
            </p>
          </Section>

          <div className="pt-8 border-t border-white/[0.06]">
            <p className="text-sm text-white/50">
              Pour toute question sur notre politique de cookies, contacte-nous
              a{' '}
              <a
                href="mailto:matiss.frasne@gmail.com"
                className="text-violet-400 hover:text-violet-300"
              >
                matiss.frasne@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 text-center flex items-center justify-center gap-6">
        <Link
          href="/legal/terms"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          CGU
        </Link>
        <Link
          href="/legal/privacy"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Confidentialite
        </Link>
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Accueil
        </Link>
      </div>
    </main>
  )
}
