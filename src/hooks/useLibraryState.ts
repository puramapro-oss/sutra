import { useMemo } from 'react'
import type { Video } from '@/types'
import type { FilterId, FolderData } from '@/types/library'

export function useLibraryState(
  videos: Video[],
  favorites: Set<string>,
  folders: FolderData[],
  filter: FilterId,
  activeFolder: string | null
) {
  // Filtered videos (favorites + folder)
  const displayedVideos = useMemo(() => {
    let result = videos

    if (filter === 'favorites') {
      result = result.filter((v) => favorites.has(v.id))
    }

    if (activeFolder) {
      const folder = folders.find((f) => f.id === activeFolder)
      if (folder) {
        const idSet = new Set(folder.videoIds)
        result = result.filter((v) => idSet.has(v.id))
      }
    }

    return result
  }, [videos, filter, favorites, activeFolder, folders])

  return { displayedVideos }
}
