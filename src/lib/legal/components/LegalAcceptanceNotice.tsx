export interface LegalAcceptanceNoticeProps {
  actionLabel: string;
  cguHref?: string;
  /** Omettre (ou `null`) pour une app sans `aPaiement` — pas de CGV, pas de lien CGV. */
  cgvHref?: string | null;
  confidentialiteHref?: string;
}

/**
 * Notice d'acceptation ZÉRO CASE À COCHER (cohérent avec la résolution verrouillée CLAUDE.md
 * §9.5 sur la rétractation — même philosophie anti-friction appliquée à l'acceptation CGU/CGV) :
 * cliquer sur le bouton d'action du formulaire (ex. "Créer mon compte") VAUT acceptation.
 * La preuve d'acceptation (qui/quelle version/quand) est enregistrée côté serveur au moment
 * de la création du compte, pas par cette notice elle-même — voir `api/legal-accept.ts`.
 * Placer ce composant juste au-dessus du bouton de soumission du formulaire.
 */
export default function LegalAcceptanceNotice({
  actionLabel,
  cguHref = '/cgu',
  cgvHref = '/cgv',
  confidentialiteHref = '/politique-confidentialite',
}: LegalAcceptanceNoticeProps) {
  return (
    <p className="text-xs text-muted-foreground">
      En cliquant sur « {actionLabel} », vous acceptez nos{' '}
      <a href={cguHref} className="underline" target="_blank" rel="noopener noreferrer">
        CGU
      </a>
      {cgvHref && (
        <>
          , nos{' '}
          <a href={cgvHref} className="underline" target="_blank" rel="noopener noreferrer">
            CGV
          </a>
        </>
      )}{' '}
      et notre{' '}
      <a href={confidentialiteHref} className="underline" target="_blank" rel="noopener noreferrer">
        politique de confidentialité
      </a>
      .
    </p>
  );
}
