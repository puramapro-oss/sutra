import { useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
  display_name: string
  avatar_url: string | null
  status: string
  connected_at: string
}

export interface DisconnectConfirmModalProps {
  account: SocialAccount | null
  onCancel: () => void
  onConfirm: (account: SocialAccount) => void
}

export function DisconnectConfirmModal({
  account,
  onCancel,
  onConfirm,
}: DisconnectConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      open={!!account}
      onClose={onCancel}
      title={account ? `Deconnecter ${PLATFORM_INFO[account.platform].label} ?` : undefined}
      initialFocusRef={cancelRef}
      className="max-w-md bg-[#0A0A0F]"
    >
      {account && (
        <>
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">
                Tu ne pourras plus publier automatiquement sur ce reseau jusqu&apos;a une
                nouvelle connexion.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button ref={cancelRef} variant="secondary" size="md" onClick={onCancel} data-testid="cancel-disconnect">
              Annuler
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => onConfirm(account)}
              data-testid="confirm-disconnect"
            >
              Deconnecter
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
