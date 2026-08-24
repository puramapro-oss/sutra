import { useState, useCallback } from 'react'
import type { FolderData } from '@/types/library'
import { generateId } from '@/lib/library-helpers'

function loadFolders(): FolderData[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('sutra_folders')
    return raw ? (JSON.parse(raw) as FolderData[]) : []
  } catch {
    return []
  }
}

function saveFolders(folders: FolderData[]) {
  localStorage.setItem('sutra_folders', JSON.stringify(folders))
}

export function useLibraryFolders() {
  const [folders, setFolders] = useState<FolderData[]>(() => loadFolders())

  const createFolder = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const folder: FolderData = { id: generateId(), name: trimmed, videoIds: [] }
    setFolders((prev) => {
      const next = [...prev, folder]
      saveFolders(next)
      return next
    })
  }, [])

  const deleteFolder = useCallback((folderId: string) => {
    setFolders((prev) => {
      const next = prev.filter((f) => f.id !== folderId)
      saveFolders(next)
      return next
    })
  }, [])

  const addVideoToFolder = useCallback((folderId: string, videoId: string) => {
    setFolders((prev) => {
      const next = prev.map((f) => {
        if (f.id === folderId && !f.videoIds.includes(videoId)) {
          return { ...f, videoIds: [...f.videoIds, videoId] }
        }
        return f
      })
      saveFolders(next)
      return next
    })
  }, [])

  return { folders, createFolder, deleteFolder, addVideoToFolder }
}
