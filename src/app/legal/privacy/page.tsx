import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Politique de confidentialite — SUTRA',
  description:
    'Politique de confidentialite de SUTRA conforme au RGPD. Decouvre comment nous collectons, utilisons et protegeons tes donnees personnelles.',
  openGraph: {
    title: 'Politique de confidentialite — SUTRA',
    description: 'Politique de confidentialite RGPD de SUTRA by Purama.',
    url: 'https://sutra.purama.dev/legal/privacy',
  },
  alternates: {
    canonical: 'https://sutra.purama.dev/legal/privacy',
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

export default function PrivacyPage() {
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
            Politique de confidentialite
          </h1>
          <p className="text-white/40 text-sm">
            Derniere mise a jour : 29 mars 2026
          </p>
        </div>

        <div className="space-y-10">
          <Section id="donnees-collectees" title="1. Donnees collectees">
            <p>Dans le cadre de l&apos;utilisation de SUTRA, nous collectons :</p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Donnees d&apos;inscription :</strong>{' '}
                nom, adresse email, mot de passe (hashe)
              </li>
              <li>
                <strong className="text-white/70">Donnees de profil :</strong>{' '}
                avatar, preferences de niche, voix selectionnee, qualite preferee
              </li>
              <li>
                <strong className="text-white/70">Donnees d&apos;utilisation :</strong>{' '}
                videos generees, historique de creation, statistiques d&apos;utilisation
              </li>
              <li>
                <strong className="text-white/70">Donnees de paiement :</strong>{' '}
                traitees exclusivement par Stripe (nous ne stockons pas les
                numeros de carte)
              </li>
              <li>
                <strong className="text-white/70">Donnees techniques :</strong>{' '}
                adresse IP, type de navigateur, systeme d&apos;exploitation, pages
                consultees
              </li>
            </ul>
          </Section>

          <Section id="finalites" title="2. Finalites du traitement">
            <p>Les donnees sont collectees pour :</p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>Fournir et ameliorer le Service de generation video</li>
              <li>Gerer les comptes utilisateurs et les abonnements</li>
              <li>Traiter les paiements et la facturation</li>
              <li>Gerer le programme de parrainage et les commissions</li>
              <li>Assurer le support technique</li>
              <li>
                Envoyer des notifications liees au Service (confirmation,
                facturation, alertes)
              </li>
              <li>Ameliorer les performances et la securite de la plateforme</li>
              <li>
                Respecter les obligations legales et reglementaires
              </li>
            </ul>
          </Section>

          <Section id="base-legale" title="3. Base legale">
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Execution du contrat :</strong>{' '}
                inscription, generation de videos, gestion de l&apos;abonnement
              </li>
              <li>
                <strong className="text-white/70">Interet legitime :</strong>{' '}
                amelioration du Service, securite, prevention de la fraude
              </li>
              <li>
                <strong className="text-white/70">Consentement :</strong>{' '}
                cookies analytiques et marketing (revocable a tout moment)
              </li>
              <li>
                <strong className="text-white/70">Obligation legale :</strong>{' '}
                conservation des factures, lutte contre la fraude
              </li>
            </ul>
          </Section>

          <Section id="duree" title="4. Duree de conservation">
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Donnees de compte :</strong>{' '}
                conservees pendant la duree de l&apos;inscription + 30 jours apres
                suppression
              </li>
              <li>
                <strong className="text-white/70">Donnees de facturation :</strong>{' '}
                conservees 10 ans (obligation legale)
              </li>
              <li>
                <strong className="text-white/70">Videos generees :</strong>{' '}
                conservees tant que le compte est actif, supprimees 30 jours
                apres fermeture du compte
              </li>
              <li>
                <strong className="text-white/70">Logs techniques :</strong>{' '}
                conserves 12 mois
              </li>
              <li>
                <strong className="text-white/70">Cookies :</strong>{' '}
                13 mois maximum
              </li>
            </ul>
          </Section>

          <Section id="droits" title="5. Tes droits (RGPD)">
            <p>
              Conformement au Reglement General sur la Protection des Donnees
              (RGPD), tu disposes des droits suivants :
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Droit d&apos;acces :</strong>{' '}
                obtenir la confirmation du traitement de tes donnees et en
                recevoir une copie
              </li>
              <li>
                <strong className="text-white/70">Droit de rectification :</strong>{' '}
                corriger les donnees inexactes ou incompletes
              </li>
              <li>
                <strong className="text-white/70">Droit de suppression :</strong>{' '}
                demander la suppression de tes donnees (sauf obligations legales
                de conservation)
              </li>
              <li>
                <strong className="text-white/70">Droit a la portabilite :</strong>{' '}
                recevoir tes donnees dans un format structure et lisible par
                machine
              </li>
              <li>
                <strong className="text-white/70">Droit d&apos;opposition :</strong>{' '}
                t&apos;opposer au traitement base sur l&apos;interet legitime
              </li>
              <li>
                <strong className="text-white/70">Droit a la limitation :</strong>{' '}
                limiter le traitement dans certains cas prevus par la loi
              </li>
            </ul>
            <p>
              Pour exercer tes droits, contacte-nous a{' '}
              <a
                href="mailto:matiss.frasne@gmail.com"
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                matiss.frasne@gmail.com
              </a>
              . Nous repondrons dans un delai de 30 jours.
            </p>
            <p>
              Tu peux aussi supprimer ton compte et exporter tes donnees
              directement depuis les parametres de ton profil SUTRA.
            </p>
            <p>
              En cas de litige, tu peux introduire une reclamation aupres de la
              CNIL (Commission Nationale de l&apos;Informatique et des Libertes) :
              www.cnil.fr
            </p>
          </Section>

          <Section id="cookies" title="6. Cookies">
            <p>
              SUTRA utilise des cookies pour assurer le bon fonctionnement du
              Service. Pour plus de details, consulte notre{' '}
              <Link
                href="/legal/cookies"
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                Politique de cookies
              </Link>
              .
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Cookies essentiels :</strong>{' '}
                authentification, session, preferences (toujours actifs)
              </li>
              <li>
                <strong className="text-white/70">Cookies analytiques :</strong>{' '}
                PostHog pour mesurer l&apos;utilisation du Service (avec consentement)
              </li>
              <li>
                <strong className="text-white/70">Cookies marketing :</strong>{' '}
                suivi de parrainage et influenceurs (avec consentement)
              </li>
            </ul>
          </Section>

          <Section id="tiers" title="7. Sous-traitants et tiers">
            <p>
              Nous partageons certaines donnees avec des sous-traitants de
              confiance, dans le strict cadre du fonctionnement du Service :
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>
                <strong className="text-white/70">Supabase :</strong>{' '}
                authentification et base de donnees (heberge sur nos serveurs)
              </li>
              <li>
                <strong className="text-white/70">Stripe :</strong>{' '}
                traitement des paiements (certifie PCI-DSS)
              </li>
              <li>
                <strong className="text-white/70">Anthropic (Claude) :</strong>{' '}
                generation de scripts IA
              </li>
              <li>
                <strong className="text-white/70">ElevenLabs :</strong>{' '}
                synthese vocale
              </li>
              <li>
                <strong className="text-white/70">Vercel :</strong>{' '}
                hebergement de la plateforme
              </li>
              <li>
                <strong className="text-white/70">Resend :</strong>{' '}
                envoi d&apos;emails transactionnels
              </li>
              <li>
                <strong className="text-white/70">PostHog :</strong>{' '}
                analytics (donnees anonymisees, serveurs EU)
              </li>
              <li>
                <strong className="text-white/70">Sentry :</strong>{' '}
                surveillance des erreurs techniques
              </li>
            </ul>
            <p>
              Aucune donnee personnelle n&apos;est vendue a des tiers. Les transferts
              hors UE sont encadres par des clauses contractuelles types (CCT).
            </p>
          </Section>

          <Section id="securite" title="8. Securite">
            <p>
              Nous mettons en oeuvre des mesures techniques et organisationnelles
              appropriees pour proteger tes donnees :
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li>Chiffrement des donnees en transit (TLS) et au repos</li>
              <li>Authentification securisee avec gestion de sessions</li>
              <li>Surveillance continue des acces et des anomalies</li>
              <li>Sauvegardes quotidiennes automatisees</li>
              <li>Tests de securite reguliers</li>
            </ul>
          </Section>

          <Section id="modifications" title="9. Modifications">
            <p>
              Nous nous reservons le droit de modifier la presente politique a
              tout moment. En cas de modification substantielle, tu seras
              informe par email ou par notification dans l&apos;application. La date
              de derniere mise a jour est indiquee en haut de cette page.
            </p>
          </Section>

          <div className="pt-8 border-t border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white mb-3">
              Contact
            </h3>
            <div className="text-sm text-white/50 space-y-1">
              <p>PURAMA SASU — Capital 1 euro</p>
              <p>8 Rue de la Chapelle, 25560 Frasne, France</p>
              <p>Responsable du traitement : Matiss Dornier, President</p>
              <p>
                Email :{' '}
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
          href="/legal/terms"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          CGU
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
