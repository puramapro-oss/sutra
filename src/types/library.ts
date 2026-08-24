import type { VideoStatus } from './index'

export type FilterId = VideoStatus | 'all' | 'favorites'

export type ViewMode = 'grid' | 'list'

export interface FolderData {
  id: string
  name: string
  videoIds: string[]
}

export const statusConfig: Record<
  VideoStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }
> = {
  draft: { label: 'Brouillon', variant: 'default' },
  generating: { label: 'En cours', variant: 'warning' },
  ready: { label: 'Prete', variant: 'success' },
  published: { label: 'Publiee', variant: 'info' },
  failed: { label: 'Erreur', variant: 'error' },
}
