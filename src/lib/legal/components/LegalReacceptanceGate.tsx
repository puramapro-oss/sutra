'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { LegalDocType } from '../types';

const DOC_LABELS: Record<LegalDocType, string> = {
  mentions: 'Mentions légales',
  cgu: "Conditions générales d'utilisation",
  cgv: 'Conditions générales de vente',
  confidentialite: 'Politique de confidentialité',
};

const DOC_PATHS: Record<LegalDocType, string> = {
  mentions: '/mentions-legales',
  cgu: '/cgu',
  cgv: '/cgv',
  confidentialite: '/politique-confidentialite',
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const open = pending.length > 0;
  const current = pending[0];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => { linkRef.current?.focus(); }, [current]);

  if (!open) return null;

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
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy !== null}
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const items = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      className="fixed m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg border border-border bg-background-soft text-foreground p-6 space-y-4 backdrop:bg-black/70"
    >
        <h2 id={titleId} className="text-lg font-semibold">Mise à jour de nos conditions</h2>
        <p id={descriptionId} className="text-sm text-foreground">
          {appName} a mis à jour son document « {DOC_LABELS[current]} ». Merci d&apos;en prendre connaissance avant de continuer.
        </p>
        <a ref={linkRef} href={DOC_PATHS[current]} target="_blank" rel="noopener noreferrer" className="inline-block text-sm underline text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          Lire « {DOC_LABELS[current]} »
        </a>
        <button
          type="button"
          onClick={handleAccept}
          disabled={busy === current}
          className="min-h-11 w-full rounded-pill bg-violet-600 px-5 text-sm font-medium text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {busy === current ? 'Enregistrement…' : "J'ai lu, je continue"}
        </button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </dialog>
  );
}
