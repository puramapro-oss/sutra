// src/app/(dashboard)/layout.tsx — SUTRA
// Server Component : le middleware garantit déjà une session valide avant d'atteindre ce layout
// (défense en profondeur, jamais un seul point de contrôle sur l'auth). Le chrome (sidebar
// desktop + header + bottom nav mobile + overlays) est délégué à `DashboardChrome` (Client
// Component), ce layout ne fait que le calcul serveur des documents légaux en attente.
//
// CONFORMITE.md 2026-08-23 gap #9 : `LegalReacceptanceGate` était copié depuis le socle mais
// jamais monté nulle part — un bump de version CGU/CGV/confidentialité ne re-sollicitait aucun
// utilisateur existant. Calcul serveur (jamais côté client) des documents en attente à partir
// des dernières acceptations réelles ; résilient si `legal_acceptances` est temporairement
// indisponible (dégrade vers 0 doc en attente plutôt que de bloquer l'accès à l'app).
import { createServerClient } from '@/lib/supabase-server'
import DashboardChrome from '@/components/layout/DashboardChrome'
import LegalReacceptanceGateMount from '@/components/legal/LegalReacceptanceGateMount'
import { computeDocsEnAttente } from '@/lib/legal/versions'
import type { LegalDocType } from '@/lib/legal/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let docsEnAttente: LegalDocType[] = []
  if (user) {
    const { data: legalAcceptances } = await supabase
      .from('legal_acceptances')
      .select('doc_type, version')
      .eq('user_id', user.id)

    const dernieresAcceptations = Object.fromEntries(
      (legalAcceptances ?? []).map((a) => [a.doc_type, a.version])
    ) as Partial<Record<LegalDocType, string>>
    docsEnAttente = computeDocsEnAttente(dernieresAcceptations)
  }

  return (
    <DashboardChrome>
      {docsEnAttente.length > 0 && <LegalReacceptanceGateMount docsEnAttente={docsEnAttente} />}
      {children}
    </DashboardChrome>
  )
}
