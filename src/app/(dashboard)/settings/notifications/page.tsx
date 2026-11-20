'use client'

import { Bell, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function NotificationSettingsPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings" aria-label="Retour aux réglages" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-violet-400" />
            Notifications
          </h1>
          <p className="text-white/60 mt-1">Préférences de notifications</p>
        </div>
      </div>
      <Card className="glass border-violet-500/20">
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold text-white">Personnalisation indisponible</h2>
          <p id="notification-settings-unavailable" role="status" className="text-sm text-white/70">
            La personnalisation des notifications n’est pas encore disponible.
            Aucun réglage ne peut être enregistré depuis cette page pour le moment.
          </p>
          <Link href="/notifications" className="inline-block text-violet-300 underline underline-offset-4">
            Consulter mes notifications
          </Link>
        </CardContent>
      </Card>
      <Button disabled aria-describedby="notification-settings-unavailable" className="w-full">
        Sauvegarder
      </Button>
    </div>
  )
}
