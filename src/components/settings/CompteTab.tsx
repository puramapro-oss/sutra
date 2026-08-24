import { Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import type { Profile } from '@/types'

interface CompteTabProps {
  profile: Profile | null
  currentPassword: string
  setCurrentPassword: (password: string) => void
  newPassword: string
  setNewPassword: (password: string) => void
  confirmPassword: string
  setConfirmPassword: (password: string) => void
  handlePasswordChange: () => void
  saving: boolean
}

export default function CompteTab({
  profile,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  handlePasswordChange,
  saving,
}: CompteTabProps) {
  return (
    <div className="space-y-4">
      <Card data-testid="settings-compte">
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Email</h3>
          <Input
            label="Adresse email"
            value={profile?.email ?? ''}
            disabled
            data-testid="settings-email"
          />
          <p className="text-xs text-white/25">L&apos;email ne peut pas etre modifie.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Changer le mot de passe</h3>
          <Input
            label="Mot de passe actuel"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            data-testid="settings-current-password"
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            data-testid="settings-new-password"
          />
          <Input
            label="Confirmer le mot de passe"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            data-testid="settings-confirm-password"
          />
          <Button
            onClick={handlePasswordChange}
            loading={saving}
            variant="secondary"
            data-testid="settings-change-password"
          >
            <Lock className="h-4 w-4" />
            Changer le mot de passe
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
