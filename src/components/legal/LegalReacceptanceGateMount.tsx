'use client'

import LegalReacceptanceGate from '@/lib/legal/components/LegalReacceptanceGate'
import type { LegalDocType } from '@/lib/legal/types'

// Wrapper client : `(dashboard)/layout.tsx` est un Server Component, `onAccept` (fonction) ne
// peut pas lui être passé en prop depuis un composant serveur — même pattern que
// CookieConsentBannerMount.tsx. `docsEnAttente` est calculé côté serveur dans le layout
// (comparaison `legal_acceptances` vs CURRENT_LEGAL_VERSIONS via computeDocsEnAttente), jamais
// recalculé ici (CONFORMITE.md 2026-08-23 gap #9 : composant copié mais jamais monté).
export default function LegalReacceptanceGateMount({
  docsEnAttente,
}: {
  docsEnAttente: LegalDocType[]
}) {
  async function handleAccept(docType: LegalDocType) {
    const res = await fetch('/api/legal/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docType }),
    })
    if (!res.ok) throw new Error('Enregistrement impossible.')
  }

  return (
    <LegalReacceptanceGate appName="SUTRA" docsEnAttente={docsEnAttente} onAccept={handleAccept} />
  )
}
