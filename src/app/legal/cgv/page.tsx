import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions Generales de Vente — SUTRA by Purama',
  description: 'CGV de SUTRA. Abonnements, tarifs, paiement, droit de retractation et garanties.',
  alternates: { canonical: 'https://sutra.purama.dev/legal/cgv' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function CGVPage() {
  return (
    <main className="min-h-screen bg-[#06050e] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-orbitron)' }}>
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">SUTRA</span>
          </Link>
          <Link href="/legal" className="text-sm text-white/40 hover:text-white/60 transition-colors">Retour</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="mb-12">
          <span className="inline-block text-sm font-semibold text-violet-400 uppercase tracking-widest mb-4">Legal</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-orbitron)' }}>
            Conditions Generales de <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Vente</span>
          </h1>
          <p className="text-white/40 text-sm">Derniere mise a jour : 2 avril 2026</p>
        </div>

        <div className="space-y-10">
          <Section title="Article 1 — Objet">
            <p>Les presentes Conditions Generales de Vente (ci-apres &quot;CGV&quot;) s&apos;appliquent a toute souscription d&apos;un abonnement payant sur la plateforme SUTRA editee par PURAMA SASU, societe par actions simplifiee unipersonnelle au capital de 1 euro, dont le siege social est situe 8 Rue de la Chapelle, 25560 Frasne, France.</p>
            <p>TVA non applicable — Article 293B du Code General des Impots.</p>
          </Section>

          <Section title="Article 2 — Offres et tarifs">
            <p>SUTRA propose les abonnements suivants :</p>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-2">
              <p><strong className="text-white">Free</strong> — 0 euro/mois : 3 videos/mois, qualite SD</p>
              <p><strong className="text-white">Starter</strong> — 9,99 euros/mois (ou 6,69 euros/mois en annuel) : 15 videos/mois, qualite HD</p>
              <p><strong className="text-white">Creator</strong> — 29,99 euros/mois (ou 20,09 euros/mois en annuel) : 50 videos/mois, qualite Full HD, voix clonees</p>
              <p><strong className="text-white">Empire</strong> — 79,99 euros/mois (ou 53,59 euros/mois en annuel) : videos illimitees, qualite 4K, autopilot, priorite GPU</p>
            </div>
            <p>Les prix indiques sont en euros TTC. TVA non applicable (art. 293B CGI).</p>
            <p>PURAMA SASU se reserve le droit de modifier ses tarifs a tout moment. Toute modification prendra effet au prochain renouvellement de l&apos;abonnement.</p>
          </Section>

          <Section title="Article 3 — Commande et paiement">
            <p>La souscription d&apos;un abonnement s&apos;effectue en ligne via la page Pricing. Le paiement est traite par <strong className="text-white/80">Stripe</strong> (carte bancaire, PayPal, Link).</p>
            <p>L&apos;abonnement est a tacite reconduction. Le prelevement est effectue automatiquement a chaque echeance (mensuelle ou annuelle).</p>
            <p>Une facture electronique est disponible dans l&apos;espace client apres chaque paiement.</p>
          </Section>

          <Section title="Article 4 — Droit de retractation">
            <p>Conformement a l&apos;article L.221-28 du Code de la consommation, le droit de retractation ne s&apos;applique pas aux contrats de fourniture de contenu numerique non fourni sur un support materiel dont l&apos;execution a commence avec l&apos;accord du consommateur.</p>
            <p>En souscrivant un abonnement et en utilisant le Service, tu reconnais expressement renoncer a ton droit de retractation des le premier usage du Service (generation de video).</p>
            <p>Toutefois, si tu n&apos;as genere aucune video, tu peux demander un remboursement dans les 14 jours suivant la souscription en contactant matiss.frasne@gmail.com.</p>
          </Section>

          <Section title="Article 5 — Resiliation">
            <p>Tu peux resilier ton abonnement a tout moment depuis la page Parametres ou le portail de facturation Stripe. La resiliation prend effet a la fin de la periode en cours.</p>
            <p>Aucun remboursement au prorata ne sera effectue pour la periode en cours.</p>
            <p>PURAMA SASU se reserve le droit de resilier un compte en cas de violation des <Link href="/legal/terms" className="text-violet-400 hover:text-violet-300 underline">CGU</Link>.</p>
          </Section>

          <Section title="Article 6 — Livraison et disponibilite">
            <p>Le Service est accessible en ligne 24h/24. Les videos generees sont disponibles immediatement apres traitement.</p>
            <p>PURAMA SASU ne garantit pas une disponibilite continue et sans interruption du Service. Des maintenances programmees ou incidents techniques peuvent affecter temporairement l&apos;acces.</p>
          </Section>

          <Section title="Article 7 — Garanties et responsabilite">
            <p>Le Service est fourni &quot;en l&apos;etat&quot;. PURAMA SASU met en oeuvre les moyens necessaires pour assurer la qualite du Service mais ne peut garantir un resultat specifique.</p>
            <p>PURAMA SASU n&apos;est pas responsable des contenus generes par l&apos;utilisateur ni de l&apos;usage qu&apos;il en fait.</p>
          </Section>

          <Section title="Article 8 — Donnees personnelles">
            <p>Le traitement des donnees personnelles est detaille dans notre <Link href="/legal/privacy" className="text-violet-400 hover:text-violet-300 underline">politique de confidentialite</Link>.</p>
          </Section>

          <Section title="Article 9 — Mediation">
            <p>En cas de litige lie a une commande, tu peux recourir gratuitement a un mediateur de la consommation. Conformement aux articles L.611-1 et suivants du Code de la consommation, tu peux saisir le mediateur designe par PURAMA SASU ou tout mediateur inscrit sur la liste prevue a l&apos;article L.615-1 du Code de la consommation, accessible sur : <span className="text-white/70">economie.gouv.fr/mediation-conso</span>.</p>
            <p>Plateforme europeenne de resolution des litiges en ligne : <span className="text-white/70">ec.europa.eu/consumers/odr</span></p>
          </Section>

          <Section title="Article 10 — Droit applicable">
            <p>Les presentes CGV sont soumises au droit francais. Tout litige sera porte devant les juridictions competentes du ressort du siege social de PURAMA SASU, sauf disposition legale contraire.</p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06]">
          <Link href="/legal" className="text-sm text-white/40 hover:text-white/60 transition-colors">Retour aux informations legales</Link>
        </div>
      </div>
    </main>
  )
}
