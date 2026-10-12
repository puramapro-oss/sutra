import Link from 'next/link'
import { Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'

export default function DonneesTab() {
  return (
    <div className="space-y-4">
      <Card data-testid="settings-donnees">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Ma memoire</h3>
          <p className="text-xs text-white/65">
            Exporte tes donnees, consulte tes acceptations legales ou supprime ton compte (RGPD).
          </p>
          <Link href="/ma-memoire" data-testid="settings-ma-memoire-link" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white/90">
              <Database className="h-4 w-4" />
              Acceder a Ma memoire
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
