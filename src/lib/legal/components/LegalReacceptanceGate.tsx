'use client';

import { useState } from 'react';
import type { LegalDocType } from '../types';

const DOC_LABELS: Record<LegalDocType, string> = {
  mentions: 'Mentions légales',
  cgu: "Conditions générales d'utilisation",
  cgv: 'Conditions générales de vente',
  confidentialite: 'Politique de confidentialité',
};

export interface LegalReacceptanceGateProps {
  appName: string;
  /** Docs dont la version acceptée par l'utilisateur est strictement antérieure à la version courante. */
  docsEnAttente: LegalDocType[];
  onAccept: (docType: LegalDocType) => Promise<void>;
}

/**
 * Bloque l'usage de l'app tant qu'une nouvelle version de CGU/CGV/politique n'a pas été
 * acceptée — zéro case à cocher, un clic "J'ai lu, je continue" par document suffit et
 * déclenche l'enregistrement horodaté (`onAccept` → `POST /api/legal/accept`).
 * Le calcul de `docsEnAttente` se fait côté serveur (comparaison `legal_acceptances` vs
 * `CURRENT_LEGAL_VERSIONS`) et est passé en prop — ce composant ne fait aucun calcul de version.
 */
export default function LegalReacceptanceGate({ appName, docsEnAttente, onAccept }: LegalReacceptanceGateProps) {
  const [pending, setPending] = useState<LegalDocType[]>(docsEnAttente);
  const [busy, setBusy] = useState<LegalDocType | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pending.length === 0) return null;

  const current = pending[0];

  async function handleAccept() {
    setBusy(current);
    setError(null);
    try {
      await onAccept(current);
      setPending((prev) => prev.filter((d) => d !== current));
    } catch {
      setError("L'enregistrement a échoué, réessaie.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background-soft p-6 space-y-4">
        <h2 className="text-lg font-semibold">Mise à jour de nos conditions</h2>
        <p className="text-sm text-foreground">
          {appName} a mis à jour son document « {DOC_LABELS[current]} ». Merci d&apos;en prendre connaissance avant de continuer.
        </p>
        <a href={`/${current === 'confidentialite' ? 'politique-confidentialite' : current}`} target="_blank" rel="noopener noreferrer" className="text-sm underline text-primary-on-dark">
          Lire « {DOC_LABELS[current]} »
        </a>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy === current}
          className="min-h-11 w-full rounded-pill bg-primary px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy === current ? 'Enregistrement…' : "J'ai lu, je continue"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
