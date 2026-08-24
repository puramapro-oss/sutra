import type { FilterId } from '@/types/library'

export const PAGE_SIZE = 12

export const FILTER_TABS: { id: string; label: string; filter: FilterId }[] = [
  { id: 'all', label: 'Toutes', filter: 'all' },
  { id: 'favorites', label: 'Favoris', filter: 'favorites' },
  { id: 'draft', label: 'Brouillons', filter: 'draft' },
  { id: 'ready', label: 'Pretes', filter: 'ready' },
  { id: 'published', label: 'Publiees', filter: 'published' },
]

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Plus recentes' },
  { id: 'oldest', label: 'Plus anciennes' },
  { id: 'title', label: 'Titre A-Z' },
]
