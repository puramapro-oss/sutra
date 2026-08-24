import { Plus, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface LibraryHeaderProps {
  totalCount: number
  onNewFolder: () => void
  onNewVideo: () => void
}

export default function LibraryHeader({ totalCount, onNewFolder, onNewVideo }: LibraryHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]">
          Ma bibliotheque
        </h1>
        <p className="text-sm text-white/50 mt-0.5">
          {totalCount} video{totalCount !== 1 ? 's' : ''} au total
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          data-testid="library-new-folder-btn"
          variant="secondary"
          size="md"
          onClick={onNewFolder}
        >
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </Button>
        <Button
          data-testid="library-create-btn"
          variant="primary"
          size="md"
          onClick={onNewVideo}
        >
          <Plus className="h-4 w-4" />
          Nouvelle video
        </Button>
      </div>
    </div>
  )
}
