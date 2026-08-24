import { Folder, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FolderData } from '@/types/library'

interface FolderPillsProps {
  folders: FolderData[]
  activeFolder: string | null
  onSelectFolder: (folderId: string | null) => void
  onDeleteFolder: (folderId: string) => void
}

export default function FolderPills({
  folders,
  activeFolder,
  onSelectFolder,
  onDeleteFolder,
}: FolderPillsProps) {
  if (folders.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Folder className="h-4 w-4 text-white/30 shrink-0" />
      {folders.map((folder) => (
        <div key={folder.id} className="flex items-center gap-0">
          <button
            data-testid={`folder-${folder.id}`}
            onClick={() =>
              onSelectFolder(activeFolder === folder.id ? null : folder.id)
            }
            className={cn(
              'px-3 py-1.5 rounded-l-lg text-xs font-medium transition-all duration-200 border',
              activeFolder === folder.id
                ? 'bg-violet-600/80 text-white border-violet-500/40'
                : 'bg-white/[0.03] text-white/50 border-white/[0.06] hover:text-white/70 hover:border-white/[0.12]'
            )}
          >
            {folder.name}
            <span className="ml-1.5 text-white/30">{folder.videoIds.length}</span>
          </button>
          <button
            data-testid={`folder-delete-${folder.id}`}
            onClick={() => onDeleteFolder(folder.id)}
            className={cn(
              'px-1.5 py-1.5 rounded-r-lg text-xs transition-all duration-200 border border-l-0',
              activeFolder === folder.id
                ? 'bg-violet-600/60 text-white/70 border-violet-500/40 hover:text-red-300'
                : 'bg-white/[0.03] text-white/30 border-white/[0.06] hover:text-red-400'
            )}
            aria-label={`Supprimer dossier ${folder.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {activeFolder && (
        <button
          onClick={() => onSelectFolder(null)}
          className="px-2.5 py-1.5 rounded-lg text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Tout afficher
        </button>
      )}
    </div>
  )
}
