import type { LegalSection } from '../types';

export interface LegalPageProps {
  titre: string;
  sousTitre?: string;
  sections: LegalSection[];
  derniereMiseAJour: string;
  backHref?: string;
}

/**
 * Rendu générique d'une page légale (mentions/CGU/CGV/confidentialité). Reprend le gabarit
 * visuel vérifié de `pashu/src/app/(public)/*` (D-047) : max-w-7xl, colonne de lecture
 * max-w-[65ch], sections espacées. Les titres ne sont PAS numérotés dans le contenu —
 * ce composant numérote à l'affichage selon l'ordre final du tableau `sections`.
 */
export default function LegalPage({ titre, sousTitre, sections, derniereMiseAJour, backHref = '/' }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8">
          <a href={backHref} className="inline-flex min-h-11 items-center text-sm text-primary-on-dark hover:underline">
            ← Retour à l&apos;accueil
          </a>
        </div>

        <h1 className="text-4xl font-bold mb-4">{titre}</h1>
        <p className="text-muted-foreground mb-8">{sousTitre ?? `Dernière mise à jour : ${derniereMiseAJour}`}</p>

        <div className="max-w-[65ch] space-y-6 text-foreground">
          {sections.map((section, i) => (
            <section key={section.titre} className="space-y-3">
              <h2 className="text-2xl font-semibold mb-3">
                {i + 1}. {section.titre}
              </h2>
              {section.paragraphes.map((p, j) => (
                <p key={j} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
              {section.liste && (
                <ul className="list-disc ml-6 space-y-1">
                  {section.liste.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">Dernière mise à jour : {derniereMiseAJour}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
