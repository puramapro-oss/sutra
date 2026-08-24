'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { type SocialPlatform } from '@/lib/zernio'
import { PublishTriggerButton } from './publish/PublishTriggerButton'
import { PublishModalHeader } from './publish/PublishModalHeader'
import { PublishVideoPreview } from './publish/PublishVideoPreview'
import { PublishPlatformGrid } from './publish/PublishPlatformGrid'
import { PublishCaptionSection } from './publish/PublishCaptionSection'
import { PublishScheduleSection } from './publish/PublishScheduleSection'
import { PublishResultsSection, type PublishResultUI } from './publish/PublishResultsSection'
import { PublishModalFooter } from './publish/PublishModalFooter'

export interface PublishEverywhereButtonProps {
  videoId: string
  videoTitle: string
  videoUrl?: string
  variant?: 'primary' | 'secondary' | 'compact'
  defaultPlatforms?: SocialPlatform[]
  onPublishComplete?: (
    results: Array<{ platform: SocialPlatform; success: boolean; postUrl?: string }>
  ) => void
}

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
}

export function PublishEverywhereButton({
  videoId,
  videoTitle,
  videoUrl,
  variant = 'primary',
  defaultPlatforms,
  onPublishComplete,
}: PublishEverywhereButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<SocialPlatform>>(
    new Set(defaultPlatforms ?? [])
  )
  const [captionMode, setCaptionMode] = useState<'auto' | 'custom'>('auto')
  const [customCaption, setCustomCaption] = useState('')
  const [autoHashtags, setAutoHashtags] = useState(true)
  const [schedule, setSchedule] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResultUI[] | null>(null)

  const connectedPlatforms = useMemo(() => {
    const set = new Set<SocialPlatform>()
    accounts.forEach((a) => set.add(a.platform))
    return set
  }, [accounts])

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const res = await fetch('/api/social/accounts', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        accounts?: Array<{ id: string; platform: string; username: string }>
      }
      const list = (data.accounts ?? []).map((a) => ({
        id: a.id,
        platform: a.platform as SocialPlatform,
        username: a.username,
      }))
      setAccounts(list)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement comptes'
      setAccountsError(msg)
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      void fetchAccounts()
      setResults(null)
    }
  }, [isOpen, fetchAccounts])

  const togglePlatform = useCallback(
    (platform: SocialPlatform) => {
      if (!connectedPlatforms.has(platform)) return
      setSelectedPlatforms((prev) => {
        const next = new Set(prev)
        if (next.has(platform)) next.delete(platform)
        else next.add(platform)
        return next
      })
    },
    [connectedPlatforms]
  )

  const selectAll = useCallback(() => {
    const all = new Set<SocialPlatform>()
    accounts.forEach((a) => all.add(a.platform))
    setSelectedPlatforms(all)
  }, [accounts])

  const deselectAll = useCallback(() => {
    setSelectedPlatforms(new Set())
  }, [])

  const handlePublish = useCallback(async () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Selectionne au moins une plateforme')
      return
    }
    if (schedule === 'later' && !scheduledAt) {
      toast.error('Choisis une date de programmation')
      return
    }
    if (captionMode === 'custom' && customCaption.trim().length === 0) {
      toast.error('Saisis une caption ou choisis le mode auto')
      return
    }

    setPublishing(true)
    setResults(null)

    try {
      const payload: Record<string, unknown> = {
        videoId,
        platforms: Array.from(selectedPlatforms),
        autoCaption: captionMode === 'auto',
      }
      if (captionMode === 'custom') {
        payload.caption = customCaption
      }
      if (!autoHashtags) {
        payload.hashtags = []
      }
      if (schedule === 'later' && scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString()
      }

      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => ({}))) as {
        results?: PublishResultUI[]
        error?: string
        message?: string
      }

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
      }

      const list = data.results ?? []
      setResults(list)

      const successCount = list.filter((r) => r.success).length
      const failCount = list.length - successCount

      if (successCount > 0 && failCount === 0) {
        toast.success(
          schedule === 'later'
            ? `Programme sur ${successCount} plateforme(s)`
            : `Publie sur ${successCount} plateforme(s)`
        )
      } else if (successCount > 0) {
        toast.warning(`${successCount} reussie(s), ${failCount} echouee(s)`)
      } else {
        toast.error('Toutes les publications ont echoue')
      }

      onPublishComplete?.(
        list.map((r) => ({ platform: r.platform, success: r.success, postUrl: r.postUrl }))
      )

      if (failCount === 0 && successCount > 0) {
        setTimeout(() => setIsOpen(false), 3000)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur publication'
      toast.error(msg)
    } finally {
      setPublishing(false)
    }
  }, [
    selectedPlatforms,
    schedule,
    scheduledAt,
    captionMode,
    customCaption,
    autoHashtags,
    videoId,
    onPublishComplete,
  ])

  return (
    <>
      <PublishTriggerButton videoId={videoId} variant={variant} onClick={() => setIsOpen(true)} />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !publishing && setIsOpen(false)}
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            data-testid="publish-everywhere-modal"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto',
                'bg-[#0c0b14]/95 backdrop-blur-2xl',
                'border border-white/[0.06] rounded-t-2xl sm:rounded-2xl',
                'shadow-2xl shadow-violet-500/10'
              )}
            >
              <PublishModalHeader
                videoTitle={videoTitle}
                onClose={() => setIsOpen(false)}
                publishing={publishing}
              />

              <div className="px-5 py-5 space-y-6">
                <PublishVideoPreview videoUrl={videoUrl} />

                <PublishPlatformGrid
                  accounts={accounts}
                  selectedPlatforms={selectedPlatforms}
                  onTogglePlatform={togglePlatform}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  accountsLoading={accountsLoading}
                  accountsError={accountsError}
                  onRetryFetch={fetchAccounts}
                />

                <PublishCaptionSection
                  captionMode={captionMode}
                  customCaption={customCaption}
                  autoHashtags={autoHashtags}
                  onCaptionModeChange={setCaptionMode}
                  onCustomCaptionChange={setCustomCaption}
                  onAutoHashtagsChange={setAutoHashtags}
                />

                <PublishScheduleSection
                  schedule={schedule}
                  scheduledAt={scheduledAt}
                  onScheduleChange={setSchedule}
                  onScheduledAtChange={setScheduledAt}
                />

                <PublishResultsSection results={results} />
              </div>

              <PublishModalFooter
                onCancel={() => setIsOpen(false)}
                onPublish={handlePublish}
                publishing={publishing}
                selectedPlatforms={selectedPlatforms}
                schedule={schedule}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default PublishEverywhereButton
