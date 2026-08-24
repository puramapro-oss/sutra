import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import Button from '@/components/ui/Button'
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
  return (
    <AnimatePresence>
      {account && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0A0A0F] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Deconnecter {PLATFORM_INFO[account.platform].label} ?
                </h3>
                <p className="text-sm text-white/60">
                  Tu ne pourras plus publier automatiquement sur ce reseau jusqu&apos;a une
                  nouvelle connexion.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="md" onClick={onCancel} data-testid="cancel-disconnect">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
