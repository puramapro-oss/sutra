import { useState, useCallback } from 'react'

function loadFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem('sutra_favorites')
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem('sutra_favorites', JSON.stringify([...favs]))
}

export function useLibraryFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())

  const toggleFavorite = useCallback((videoId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(videoId)) {
        next.delete(videoId)
      } else {
        next.add(videoId)
      }
      saveFavorites(next)
      return next
    })
  }, [])

  return { favorites, toggleFavorite }
}
