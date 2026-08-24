import { Share2, X } from 'lucide-react'

export interface PublishModalHeaderProps {
  videoTitle: string
  onClose: () => void
  publishing: boolean
}

export function PublishModalHeader({ videoTitle, onClose, publishing }: PublishModalHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0c0b14]/95 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <Share2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white/95">Publier sur les reseaux sociaux</h2>
          <p className="text-xs text-white/40 truncate max-w-[200px] sm:max-w-md">{videoTitle}</p>
        </div>
      </div>
      <button
        type="button"
        data-testid="publish-modal-close"
        onClick={onClose}
        disabled={publishing}
        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
        aria-label="Fermer"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
