'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Film } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useLibraryVideos } from '@/hooks/useLibraryVideos'
import { useLibraryState } from '@/hooks/useLibraryState'
import { useLibraryFavorites } from '@/hooks/useLibraryFavorites'
import { useLibraryFolders } from '@/hooks/useLibraryFolders'
import { useLibraryActions } from '@/hooks/useLibraryActions'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import LibrarySkeleton from '@/components/library/LibrarySkeleton'
import LibraryHeader from '@/components/library/LibraryHeader'
import LibraryFilters from '@/components/library/LibraryFilters'
import FolderPills from '@/components/library/FolderPills'
import FolderModal from '@/components/library/FolderModal'
import VideoGrid from '@/components/library/VideoGrid'
import VideoList from '@/components/library/VideoList'
import type { FilterId, ViewMode } from '@/types/library'

export default function LibraryPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  // State hooks
  const { favorites, toggleFavorite } = useLibraryFavorites()
  const { folders, createFolder, deleteFolder, addVideoToFolder } = useLibraryFolders()

  // UI state
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Videos data
  const {
    videos,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    loadMore,
    handleDelete,
    refetch,
  } = useLibraryVideos(profile?.id, filter, debouncedSearch, sort)

  // Filtered videos
  const displayedVideos = useLibraryState(videos, favorites, folders, filter, activeFolder).displayedVideos

  // Actions
  const { handleShare, handleRegenerate } = useLibraryActions()

  // Folder modal
  const [showFolderModal, setShowFolderModal] = useState(false)

  const handleAddToFolder = (folderId: string, videoId: string) => {
    addVideoToFolder(folderId, videoId)
    import('sonner').then(({ toast }) => toast.success('Ajoutee au dossier'))
  }

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder(folderId)
    if (activeFolder === folderId) {
      setActiveFolder(null)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setFilter('all')
    setSort('recent')
    setActiveFolder(null)
  }

  if (authLoading) {
    return <LibrarySkeleton />
  }

  return (
    <LoadingTimeout
      loading={loading}
      onRetry={refetch}
      skeleton={<LibrarySkeleton />}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto space-y-6"
      >
        <LibraryHeader
          totalCount={totalCount}
          onNewFolder={() => setShowFolderModal(true)}
          onNewVideo={() => router.push('/create')}
        />

        <LibraryFilters
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <FolderPills
          folders={folders}
          activeFolder={activeFolder}
          onSelectFolder={setActiveFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {displayedVideos.length > 0 ? (
          <>
            {viewMode === 'grid' ? (
              <VideoGrid
                videos={displayedVideos}
                favorites={favorites}
                folders={folders}
                onDelete={handleDelete}
                onShare={handleShare}
                onRegenerate={handleRegenerate}
                onToggleFavorite={toggleFavorite}
                onAddToFolder={handleAddToFolder}
              />
            ) : (
              <VideoList
                videos={displayedVideos}
                favorites={favorites}
                onDelete={handleDelete}
                onShare={handleShare}
                onRegenerate={handleRegenerate}
                onToggleFavorite={toggleFavorite}
              />
            )}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  data-testid="load-more"
                  variant="secondary"
                  size="md"
                  loading={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? 'Chargement...' : 'Charger plus'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Film}
            title="Aucune video trouvee"
            description={
              search || filter !== 'all' || activeFolder
                ? 'Aucune video ne correspond a tes filtres. Essaie de modifier ta recherche.'
                : "Tu n&apos;as pas encore de video. Cree ta premiere !"
            }
            action={
              search || filter !== 'all' || activeFolder
                ? {
                    label: 'Reinitialiser les filtres',
                    onClick: resetFilters,
                    variant: 'secondary',
                  }
                : {
                    label: 'Creer ma premiere video',
                    onClick: () => router.push('/create'),
                  }
            }
            data-testid="empty-library"
          />
        )}
      </motion.div>

      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onCreate={createFolder}
      />
    </LoadingTimeout>
  )
}
