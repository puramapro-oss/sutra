import Link from 'next/link'
import { Database } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function DonneesTab() {
  return (
    <div className="space-y-4">
      <Card data-testid="settings-donnees">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Ma memoire</h3>
          <p className="text-xs text-white/30">
            Exporte tes donnees, consulte tes acceptations legales ou supprime ton compte (RGPD).
          </p>
          <Link href="/ma-memoire" data-testid="settings-ma-memoire-link">
            <Button variant="secondary">
              <Database className="h-4 w-4" />
              Acceder a Ma memoire
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
