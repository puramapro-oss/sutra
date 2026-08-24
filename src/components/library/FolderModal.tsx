import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface FolderModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export default function FolderModal({ isOpen, onClose, onCreate }: FolderModalProps) {
  const [folderName, setFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setFolderName('')
    }
  }, [isOpen])

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreate(folderName)
      setFolderName('')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-4 rounded-2xl bg-[#0c0b14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl p-6"
            data-testid="folder-modal"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nouveau dossier</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-white/40 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <input
              ref={inputRef}
              data-testid="folder-name-input"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              placeholder="Nom du dossier"
              className={cn(
                'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/30',
                'bg-white/[0.03] backdrop-blur-xl',
                'border border-white/[0.06] hover:border-white/[0.12]',
                'focus:border-violet-500/60 outline-none transition-all duration-200'
              )}
            />

            <div className="flex items-center gap-3 mt-5">
              <Button
                data-testid="folder-cancel"
                variant="secondary"
                size="md"
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                data-testid="folder-create"
                variant="primary"
                size="md"
                disabled={!folderName.trim()}
                onClick={handleCreate}
              >
                <FolderPlus className="h-4 w-4" />
                Creer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
