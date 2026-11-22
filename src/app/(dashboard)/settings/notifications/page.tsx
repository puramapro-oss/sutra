'use client'

import { Bell, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import NotificationsTab from '@/components/settings/NotificationsTab'
import { useAuth } from '@/hooks/useAuth'
import { useEmailPreferences } from '@/hooks/useEmailPreferences'

export default function NotificationSettingsPage() {
  const { profile, user, loading, refetch } = useAuth()
  const settings = useEmailPreferences(profile, user?.id, refetch)
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings" aria-label="Retour aux réglages" className="text-white/70 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Bell className="w-7 h-7 text-violet-400" />Notifications</h1>
          <p className="text-white/70 mt-1">Choisis les emails que tu souhaites recevoir.</p>
        </div>
      </div>
      {loading ? <p role="status" className="text-white/80">Chargement de tes préférences…</p> : (
        <>
          {!settings.notificationsAvailable && <p role="alert" className="text-white/80">Ton profil n’est pas disponible. Reconnecte-toi pour retrouver tes préférences.</p>}
          <NotificationsTab
            emailPrefs={settings.emailPrefs}
            toggleEmailPref={key => settings.setEmailPrefs(previous => ({ ...previous, [key]: !previous[key] }))}
            saveNotifications={settings.saveNotifications}
            saving={settings.savingNotifications}
            disabled={!settings.notificationsAvailable}
            notice={settings.notificationNotice}
          />
        </>
      )}
      <Link href="/notifications" className="inline-block text-violet-300 underline underline-offset-4">Consulter mes notifications</Link>
    </div>
  )
}
