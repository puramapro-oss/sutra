import { useRef, useState } from 'react'
import { FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface FolderModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export default function FolderModal({ isOpen, onClose, onCreate }: FolderModalProps) {
  const [folderName, setFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const handleClose = () => { setFolderName(''); onClose() }
  const handleCreate = () => {
    if (!folderName.trim()) return
    onCreate(folderName.trim())
    handleClose()
  }

  return (
    <Modal open={isOpen} onClose={handleClose} title="Nouveau dossier" initialFocusRef={inputRef} data-testid="folder-modal">
      <form onSubmit={event => { event.preventDefault(); handleCreate() }}>
        <label htmlFor="folder-name" className="block mb-2 text-sm text-white/70">Nom du dossier</label>
        <input
          id="folder-name" ref={inputRef} data-testid="folder-name-input" type="text" required maxLength={100}
          value={folderName} onChange={event => setFolderName(event.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm text-white/90 bg-white/[0.03] border border-white/20 focus:border-violet-400"
        />
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Button data-testid="folder-cancel" variant="secondary" onClick={handleClose}>Annuler</Button>
          <Button data-testid="folder-create" type="submit" disabled={!folderName.trim()}><FolderPlus className="h-4 w-4" />Créer</Button>
        </div>
      </form>
    </Modal>
  )
}
