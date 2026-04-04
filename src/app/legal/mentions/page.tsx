import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions legales — SUTRA by Purama',
  description: 'Mentions legales de SUTRA. Identification de l\'editeur PURAMA SASU, hebergeur et directeur de publication.',
  alternates: { canonical: 'https://sutra.purama.dev/legal/mentions' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function MentionsLegalesPage() {
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
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-orbitron)' }}>
          Mentions <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">legales</span>
        </h1>
        <p className="text-white/40 text-sm mb-12">Dernieres mise a jour : 2 avril 2026</p>

        <div className="space-y-10">
          <Section title="1. Editeur du site">
            <p>Le site sutra.purama.dev (ci-apres « le Site ») est edite par :</p>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-1">
              <p><strong className="text-white">PURAMA SASU</strong></p>
              <p>Societe par actions simplifiee unipersonnelle</p>
              <p>Capital social : 1,00 euro</p>
              <p>Siege social : 8 Rue de la Chapelle, 25560 Frasne, France</p>
              <p>SIRET : en cours d&apos;immatriculation</p>
              <p>RCS : en cours d&apos;immatriculation</p>
              <p>TVA non applicable — Article 293B du Code General des Impots</p>
            </div>
          </Section>

          <Section title="2. Directeur de la publication">
            <p>Matiss Dornier, en qualite de President de PURAMA SASU.</p>
            <p>Contact : matiss.frasne@gmail.com</p>
          </Section>

          <Section title="3. Hebergeur">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-1">
              <p><strong className="text-white">Vercel Inc.</strong></p>
              <p>440 N Barranca Ave #4133, Covina, CA 91723, USA</p>
              <p>Site : vercel.com</p>
            </div>
            <p>Les donnees de base sont hebergees par :</p>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 space-y-1">
              <p><strong className="text-white">Hostinger International Ltd.</strong></p>
              <p>61 Lordou Vironos Street, 6023 Larnaca, Chypre</p>
              <p>Serveur VPS localise en Europe</p>
            </div>
          </Section>

          <Section title="4. Propriete intellectuelle">
            <p>L&apos;ensemble des elements du Site (textes, images, logos, code source, design) est la propriete exclusive de PURAMA SASU ou de ses partenaires. Toute reproduction, representation ou diffusion, en tout ou partie, sans autorisation prealable ecrite, est interdite conformement aux articles L.335-2 et suivants du Code de la propriete intellectuelle.</p>
          </Section>

          <Section title="5. Donnees personnelles">
            <p>Conformement au Reglement General sur la Protection des Donnees (RGPD) et a la loi Informatique et Libertes, tu disposes d&apos;un droit d&apos;acces, de rectification, d&apos;effacement, de portabilite et d&apos;opposition sur tes donnees personnelles.</p>
            <p>Pour plus d&apos;informations, consulte notre <Link href="/legal/privacy" className="text-violet-400 hover:text-violet-300 underline">politique de confidentialite</Link>.</p>
            <p>Pour exercer tes droits : matiss.frasne@gmail.com</p>
            <p>Autorite de controle : CNIL — 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — cnil.fr</p>
          </Section>

          <Section title="6. Cookies">
            <p>Le Site utilise des cookies. Pour gerer tes preferences, consulte notre <Link href="/legal/cookies" className="text-violet-400 hover:text-violet-300 underline">politique de cookies</Link>.</p>
          </Section>

          <Section title="7. Litiges">
            <p>Les presentes mentions legales sont soumises au droit francais. En cas de litige, les tribunaux francais seront seuls competents.</p>
          </Section>
        </div>
      </div>
    </main>
  )
}
