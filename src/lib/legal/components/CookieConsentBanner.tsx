'use client';

import { useState } from 'react';
import { useCookieConsent, type CookieConsent } from '../hooks/useCookieConsent';

export interface CookieConsentBannerProps {
  appName: string;
  politiqueHref?: string;
  onConsent?: (consent: CookieConsent) => void;
}

/**
 * Bandeau de consentement cookies RÉELLEMENT fonctionnel (pas un décor) : 3 actions
 * (Tout accepter / Tout refuser / Personnaliser), rien n'est déposé avant choix explicite
 * pour les catégories mesure/marketing, "nécessaire" est toujours actif et non désactivable
 * (strictement requis pour l'authentification/session).
 */
export default function CookieConsentBanner({ appName, politiqueHref = '/politique-confidentialite', onConsent }: CookieConsentBannerProps) {
  const { needsChoice, acceptAll, refuseAll, save } = useCookieConsent(onConsent);
  const [customizing, setCustomizing] = useState(false);
  const [mesure, setMesure] = useState(false);
  const [marketing, setMarketing] = useState(false);

  if (!needsChoice) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement cookies"
      data-testid="cookie-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background-soft/95 backdrop-blur-xl p-4 sm:p-6"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-foreground">
          {appName} utilise des cookies strictement nécessaires au fonctionnement du service, et — avec votre accord —
          des cookies de mesure d&apos;audience et de personnalisation. Voir notre{' '}
          <a href={politiqueHref} className="underline text-primary-on-dark">
            politique de confidentialité
          </a>
          .
        </p>

        {customizing && (
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 opacity-60">
              <input type="checkbox" checked disabled />
              Nécessaire (toujours actif — authentification, session)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={mesure} onChange={(e) => setMesure(e.target.checked)} />
              Mesure d&apos;audience
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              Marketing / personnalisation
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="cookie-accept"
            onClick={acceptAll}
            className="min-h-11 rounded-pill bg-primary px-5 text-sm font-medium text-white"
          >
            Tout accepter
          </button>
          <button
            type="button"
            data-testid="cookie-refuse"
            onClick={refuseAll}
            className="min-h-11 rounded-pill border border-border px-5 text-sm font-medium"
          >
            Tout refuser
          </button>
          {customizing ? (
            <button
              type="button"
              data-testid="cookie-save-choices"
              onClick={() => save(mesure, marketing)}
              className="min-h-11 rounded-pill border border-border px-5 text-sm font-medium"
            >
              Enregistrer mes choix
            </button>
          ) : (
            <button
              type="button"
              data-testid="cookie-customize"
              onClick={() => setCustomizing(true)}
              className="min-h-11 rounded-pill border border-border px-5 text-sm font-medium"
            >
              Personnaliser
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
