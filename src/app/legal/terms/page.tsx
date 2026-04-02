import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Conditions Generales d'Utilisation — SUTRA",
  description:
    "Conditions generales d'utilisation de SUTRA, plateforme de generation video IA editee par Purama (micro-entreprise).",
  openGraph: {
    title: "Conditions Generales d'Utilisation — SUTRA",
    description: "CGU de la plateforme SUTRA by Purama.",
    url: 'https://sutra.purama.dev/legal/terms',
  },
  alternates: {
    canonical: 'https://sutra.purama.dev/legal/terms',
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

export default function TermsPage() {
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
            Conditions Generales d&apos;Utilisation
          </h1>
          <p className="text-white/40 text-sm">
            Derniere mise a jour : 2 avril 2026
          </p>
        </div>

        <div className="space-y-10">
          <Section id="objet" title="Article 1 — Objet">
            <p>
              Les presentes Conditions Generales d&apos;Utilisation (ci-apres &quot;CGU&quot;)
              ont pour objet de definir les modalites et conditions d&apos;utilisation
              de la plateforme SUTRA (ci-apres &quot;le Service&quot;), accessible a
              l&apos;adresse https://sutra.purama.dev, editee par PURAMA SASU,
              societe par actions simplifiee unipersonnelle au capital de 1 euro,
              dont le siege social est situe 8 Rue de la Chapelle, 25560 Frasne, France.
            </p>
            <p>
              SUTRA est une plateforme de generation de videos par intelligence
              artificielle permettant aux utilisateurs de creer des contenus
              video a partir de descriptions textuelles.
            </p>
            <p>
              L&apos;inscription et l&apos;utilisation du Service impliquent
              l&apos;acceptation pleine et entiere des presentes CGU.
            </p>
          </Section>

          <Section id="acces" title="Article 2 — Acces au Service">
            <p>
              Le Service est accessible a toute personne physique majeure (ou
              mineure avec autorisation parentale) disposant d&apos;un acces a
              Internet. L&apos;inscription est gratuite et permet d&apos;acceder au plan
              Free.
            </p>
            <p>
              L&apos;utilisateur s&apos;engage a fournir des informations exactes lors de
              son inscription et a les maintenir a jour. L&apos;utilisateur est
              responsable de la confidentialite de ses identifiants de connexion.
            </p>
            <p>
              Purama se reserve le droit de suspendre ou supprimer tout compte
              utilise de maniere frauduleuse ou en violation des presentes CGU.
            </p>
          </Section>

          <Section id="abonnements" title="Article 3 — Abonnements et facturation">
            <p>
              SUTRA propose plusieurs plans d&apos;abonnement : Free (gratuit),
              Starter (9 EUR/mois), Createur (29 EUR/mois) et Empire (99
              EUR/mois). Une reduction de 20% est appliquee sur la facturation
              annuelle.
            </p>
            <p>
              Les paiements sont traites de maniere securisee par Stripe. Les
              prix sont indiques en euros. TVA non applicable, art. 293B du CGI
              (micro-entreprise).
            </p>
            <p>
              L&apos;abonnement est reconduit automatiquement a chaque periode de
              facturation. L&apos;utilisateur peut annuler son abonnement a tout
              moment depuis son espace de parametres. L&apos;annulation prend effet a
              la fin de la periode en cours.
            </p>
            <p>
              Aucun remboursement n&apos;est accorde pour les periodes entamees, sauf
              dispositions legales contraires.
            </p>
          </Section>

          <Section id="propriete-intellectuelle" title="Article 4 — Propriete intellectuelle">
            <p>
              Les videos generees par SUTRA a l&apos;aide de l&apos;intelligence
              artificielle sont mises a la disposition de l&apos;utilisateur selon les
              termes de son plan d&apos;abonnement. L&apos;utilisateur beneficie d&apos;une
              licence non exclusive d&apos;utilisation des contenus generes a des fins
              personnelles et commerciales.
            </p>
            <p>
              La plateforme SUTRA, son interface, son code source, ses
              algorithmes et ses marques sont la propriete exclusive de Purama.
              Toute reproduction, modification ou exploitation non autorisee est
              interdite.
            </p>
            <p>
              L&apos;utilisateur est seul responsable du contenu qu&apos;il genere et de
              son utilisation. Il s&apos;engage a ne pas generer de contenus
              illicites, diffamatoires, violents, discriminatoires ou portant
              atteinte aux droits de tiers.
            </p>
          </Section>

          <Section id="donnees-personnelles" title="Article 5 — Donnees personnelles">
            <p>
              Le traitement des donnees personnelles est regi par notre{' '}
              <Link
                href="/legal/privacy"
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                Politique de confidentialite
              </Link>
              , conformement au Reglement General sur la Protection des Donnees
              (RGPD).
            </p>
            <p>
              Les donnees collectees sont necessaires au fonctionnement du
              Service et ne sont jamais vendues a des tiers. L&apos;utilisateur
              dispose d&apos;un droit d&apos;acces, de rectification, de suppression et de
              portabilite de ses donnees.
            </p>
          </Section>

          <Section id="responsabilite" title="Article 6 — Responsabilite">
            <p>
              Purama s&apos;efforce d&apos;assurer la disponibilite et la qualite du
              Service. Toutefois, le Service est fourni &quot;en l&apos;etat&quot; sans
              garantie de disponibilite permanente. Purama ne saurait etre tenue
              responsable des interruptions temporaires, des erreurs de
              generation ou des dysfonctionnements lies a des tiers (hebergeur,
              API externes).
            </p>
            <p>
              L&apos;utilisateur est seul responsable de l&apos;utilisation qu&apos;il fait du
              Service et des contenus qu&apos;il genere. Purama decline toute
              responsabilite en cas d&apos;utilisation abusive ou illicite des
              contenus generes.
            </p>
            <p>
              La responsabilite de Purama est limitee au montant des
              abonnements effectivement payes par l&apos;utilisateur au cours des 12
              derniers mois.
            </p>
          </Section>

          <Section id="resiliation" title="Article 7 — Resiliation">
            <p>
              L&apos;utilisateur peut resilier son compte et supprimer ses donnees a
              tout moment depuis ses parametres. La suppression du compte
              entraine la suppression definitive de toutes les donnees associees
              dans un delai de 30 jours.
            </p>
            <p>
              Purama se reserve le droit de resilier sans preavis tout compte en
              cas de violation des presentes CGU, d&apos;utilisation frauduleuse du
              Service, ou de generation de contenus illicites.
            </p>
          </Section>

          <Section id="droit-applicable" title="Article 8 — Droit applicable">
            <p>
              Les presentes CGU sont regies par le droit francais. En cas de
              litige, les parties s&apos;engagent a rechercher une solution amiable.
              A defaut, les tribunaux competents seront ceux du ressort du siege
              social de Purama.
            </p>
            <p>
              Conformement aux articles L.616-1 et R.616-1 du Code de la
              consommation, le consommateur peut recourir gratuitement au service
              de mediation de la consommation.
            </p>
          </Section>

          <div className="pt-8 border-t border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white mb-3">
              Informations editeur
            </h3>
            <div className="text-sm text-white/50 space-y-1">
              <p>Purama — Micro-entreprise</p>
              <p>TVA non applicable, art. 293B du CGI</p>
              <p>
                Contact :{' '}
                <a
                  href="mailto:matiss.frasne@gmail.com"
                  className="text-violet-400 hover:text-violet-300"
                >
                  matiss.frasne@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 text-center flex items-center justify-center gap-6">
        <Link
          href="/legal/privacy"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Confidentialite
        </Link>
        <Link
          href="/legal/cookies"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Cookies
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
