'use client'

import CookieConsentBanner from '@/lib/legal/components/CookieConsentBanner'
import type { CookieConsent } from '@/lib/legal/hooks/useCookieConsent'

// Wrapper client : `src/app/layout.tsx` racine est un Server Component, `onConsent` (fonction)
// ne peut pas lui être passé en prop depuis un composant serveur — ce petit composant porte le
// seul effet de bord réel (synchro best-effort en base si connecté).
// CONFORMITE.md 2026-08-23 gap #2 : l'ancien `components/shared/CookieBanner.tsx` (localStorage
// only) était monté à sa place et n'écrivait jamais la preuve RGPD en base — remplacé ici par
// l'implémentation du socle réellement branchée sur `POST /api/legal/cookie-consent`.
export default function CookieConsentBannerMount() {
  function handleConsent(consent: CookieConsent) {
    fetch('/api/legal/cookie-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesure: consent.mesure, marketing: consent.marketing }),
    }).catch(() => {
      // Best-effort : la préférence reste valide en localStorage même si la synchro échoue.
    })
  }

  return <CookieConsentBanner appName="SUTRA" politiqueHref="/legal/privacy" onConsent={handleConsent} />
}
