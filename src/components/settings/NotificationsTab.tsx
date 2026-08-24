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
}

const EMAIL_PREFS = [
  { key: 'welcome' as const, label: 'Emails de bienvenue', desc: 'Recois un email a l\'inscription' },
  { key: 'digest' as const, label: 'Resume hebdomadaire', desc: 'Recapitulatif chaque lundi' },
  { key: 'inactivity' as const, label: 'Rappels d\'inactivite', desc: 'Notification apres 7 jours sans activite' },
  { key: 'tips' as const, label: 'Conseils et astuces', desc: 'Tips pour ameliorer tes videos' },
  { key: 'contest' as const, label: 'Concours et tirages', desc: 'Notifications des concours et resultats' },
  { key: 'referral' as const, label: 'Parrainage', desc: 'Alertes commissions et filleuls' },
]

export default function NotificationsTab({
  emailPrefs,
  toggleEmailPref,
  saveNotifications,
  saving,
}: NotificationsTabProps) {
  return (
    <Card data-testid="settings-notifications">
      <CardContent className="space-y-4">
        <h3 className="text-sm font-semibold text-white mb-2">Notifications email</h3>
        {EMAIL_PREFS.map((pref) => (
          <div
            key={pref.key}
            className="flex items-center justify-between py-2"
          >
            <div>
              <p className="text-sm text-white/70">{pref.label}</p>
              <p className="text-xs text-white/30">{pref.desc}</p>
            </div>
            <button
              onClick={() => toggleEmailPref(pref.key)}
              data-testid={`toggle-notif-${pref.key}`}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
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
          loading={saving}
          variant="secondary"
          data-testid="settings-save-notifications"
        >
          Sauvegarder les notifications
        </Button>
      </CardContent>
    </Card>
  )
}
