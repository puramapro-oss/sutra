import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Confidentialite — SUTRA",
  description:
    "Politique de confidentialite et RGPD de SUTRA, studio video IA par Purama.",
};

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-[#06050e] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-orbitron)" }}
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1
          className="text-3xl font-bold mb-8"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Politique de Confidentialite
        </h1>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-white/70">
          <p>
            <strong className="text-white">Derniere mise a jour :</strong> 13
            avril 2026
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            1. Responsable du traitement
          </h2>
          <p>
            SASU PURAMA, 8 Rue de la Chapelle, 25560 Frasne, France.
            <br />
            DPO : matiss.frasne@gmail.com
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            2. Donnees collectees
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-white/90">Compte :</strong> email, nom,
              avatar (inscription ou Google OAuth)
            </li>
            <li>
              <strong className="text-white/90">Usage :</strong> videos
              generees, preferences, historique
            </li>
            <li>
              <strong className="text-white/90">Paiement :</strong> gere par
              Stripe (nous ne stockons pas vos donnees bancaires)
            </li>
            <li>
              <strong className="text-white/90">Technique :</strong> cookies de
              session, adresse IP anonymisee
            </li>
          </ul>

          <h2 className="text-white text-lg font-semibold mt-8">
            3. Finalites
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fournir et ameliorer le service SUTRA</li>
            <li>Gerer votre compte et vos abonnements</li>
            <li>Personnaliser votre experience</li>
            <li>
              Communications (avec consentement) : emails, notifications
            </li>
            <li>Obligations legales</li>
          </ul>

          <h2 className="text-white text-lg font-semibold mt-8">
            4. Base legale
          </h2>
          <p>
            Execution du contrat (service), consentement (communications),
            interet legitime (amelioration du service), obligation legale
            (facturation).
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            5. Duree de conservation
          </h2>
          <p>
            Donnees de compte : duree du compte + 3 ans. Donnees de paiement :
            10 ans (obligation legale). Cookies : 13 mois maximum.
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            6. Vos droits (RGPD)
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Acces, rectification, suppression</li>
            <li>Portabilite des donnees</li>
            <li>Opposition et limitation du traitement</li>
            <li>Retrait du consentement</li>
          </ul>
          <p>
            Pour exercer vos droits : matiss.frasne@gmail.com. Reponse sous 30
            jours. Reclamation possible aupres de la CNIL.
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            7. Sous-traitants
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase (base de donnees, authentification) — UE</li>
            <li>Stripe (paiements) — UE/US (Privacy Shield)</li>
            <li>Vercel (hebergement) — UE</li>
            <li>Anthropic (IA) — US (clauses contractuelles)</li>
            <li>Resend (emails) — US (clauses contractuelles)</li>
            <li>Sentry (monitoring) — UE</li>
          </ul>

          <h2 className="text-white text-lg font-semibold mt-8">
            8. Cookies
          </h2>
          <p>
            Cookies essentiels (session, authentification) : strictement
            necessaires. Cookies analytiques (PostHog) : avec consentement
            uniquement. Vous pouvez modifier vos preferences a tout moment via
            le bandeau cookies.
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            9. Securite
          </h2>
          <p>
            Chiffrement en transit (TLS) et au repos. Authentification JWT.
            Row-Level Security (RLS) sur toutes les tables. Acces restreint aux
            donnees.
          </p>

          <h2 className="text-white text-lg font-semibold mt-8">
            10. Contact
          </h2>
          <p>
            DPO : matiss.frasne@gmail.com
            <br />
            SASU PURAMA, 8 Rue de la Chapelle, 25560 Frasne
          </p>
        </div>
      </div>
    </main>
  );
}
