import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { EmailPreferences } from '@/types'

interface NotificationsTabProps {
  emailPrefs: EmailPreferences
  toggleEmailPref: (key: keyof EmailPreferences) => void
  saveNotifications: () => void
  saving: boolean
  disabled?: boolean
  notice?: { text: string; error: boolean } | null
}

const EMAIL_PREFS = [
  { key: 'welcome' as const, label: 'Emails de bienvenue', desc: 'Messages pour tes premiers pas' },
  { key: 'digest' as const, label: 'Résumé hebdomadaire', desc: 'Récapitulatifs de ton activité' },
  { key: 'inactivity' as const, label: 'Rappels de reprise', desc: 'Invitations à reprendre tes créations' },
  { key: 'tips' as const, label: 'Conseils et astuces', desc: 'Conseils pour améliorer tes vidéos' },
  { key: 'contest' as const, label: 'Concours et tirages', desc: 'Actualités des concours et résultats' },
  { key: 'referral' as const, label: 'Parrainage', desc: 'Actualités de ton parrainage' },
]

export default function NotificationsTab({
  emailPrefs,
  toggleEmailPref,
  saveNotifications,
  saving,
  disabled = false,
  notice,
}: NotificationsTabProps) {
  return (
    <Card data-testid="settings-notifications">
      <CardContent className="space-y-4">
        <h3 className="text-sm font-semibold text-white mb-2">Notifications email</h3>
        {EMAIL_PREFS.map((pref) => (
          <div
            key={pref.key}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div>
              <p className="text-sm text-white/70">{pref.label}</p>
              <p className="text-xs text-white/65">{pref.desc}</p>
            </div>
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => toggleEmailPref(pref.key)}
              data-testid={`toggle-notif-${pref.key}`}
              role="switch"
              aria-label={pref.label}
              aria-checked={emailPrefs[pref.key]}
              className={cn(
                'relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300',
                emailPrefs[pref.key] ? 'bg-violet-500' : 'bg-white/10'
              )}
            >
              <motion.div
                animate={{ x: emailPrefs[pref.key] ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
              />
            </button>
          </div>
        ))}
        <Button
          onClick={saveNotifications}
          disabled={disabled || saving}
          loading={saving}
          variant="secondary"
          data-testid="settings-save-notifications"
        >
          Sauvegarder les notifications
        </Button>
        {notice && <p role={notice.error ? 'alert' : 'status'} className="text-sm text-white/80">{notice.text}</p>}
      </CardContent>
    </Card>
  )
}
