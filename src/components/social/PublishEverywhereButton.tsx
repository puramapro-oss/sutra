'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Sparkles,
  Check,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Wand2,
  Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { type SocialPlatform, PLATFORM_INFO } from '@/lib/zernio'

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

interface PublishResultUI {
  platform: SocialPlatform
  success: boolean
  postUrl?: string
  error?: string
}

const ALL_PLATFORMS: SocialPlatform[] = [
  'tiktok',
  'youtube',
  'instagram',
  'facebook',
  'x',
  'linkedin',
  'pinterest',
  'reddit',
  'threads',
  'snapchat',
  'tumblr',
  'mastodon',
  'bluesky',
  'vimeo',
]

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

  const allSelected =
    selectedPlatforms.size > 0 &&
    selectedPlatforms.size === connectedPlatforms.size

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

  // ---- Trigger button ----
  const triggerLabel = 'Publier partout'

  const renderTrigger = () => {
    if (variant === 'compact') {
      return (
        <button
          type="button"
          data-testid={`publish-everywhere-${videoId}`}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(true)
          }}
          aria-label={triggerLabel}
          className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/50 hover:text-violet-400 transition-colors flex items-center gap-1"
        >
          <Share2 className="h-3.5 w-3.5" />
          <Sparkles className="h-3 w-3" />
        </button>
      )
    }

    return (
      <Button
        variant={variant === 'secondary' ? 'secondary' : 'primary'}
        size="md"
        data-testid={`publish-everywhere-${videoId}`}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
      >
        <Share2 className="h-4 w-4" />
        {triggerLabel}
        <Sparkles className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      {renderTrigger()}

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
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#0c0b14]/95 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Share2 className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white/95">
                      Publier sur les reseaux sociaux
                    </h2>
                    <p className="text-xs text-white/40 truncate max-w-[200px] sm:max-w-md">
                      {videoTitle}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="publish-modal-close"
                  onClick={() => setIsOpen(false)}
                  disabled={publishing}
                  className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-6">
                {/* Video preview */}
                {videoUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/[0.06] bg-black aspect-video max-h-48 mx-auto">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full h-full object-contain"
                      preload="metadata"
                    />
                  </div>
                )}

                {/* Platforms */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white/90">
                      Plateformes
                    </h3>
                    <button
                      type="button"
                      data-testid="publish-toggle-all"
                      onClick={allSelected ? deselectAll : selectAll}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      {allSelected ? 'Tout deselectionner' : 'Tout selectionner'}
                    </button>
                  </div>

                  {accountsLoading && (
                    <div className="flex items-center justify-center py-8 text-white/40">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}

                  {accountsError && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p>{accountsError}</p>
                        <button
                          type="button"
                          onClick={() => void fetchAccounts()}
                          className="mt-1 underline hover:text-red-300"
                        >
                          Reessayer
                        </button>
                      </div>
                    </div>
                  )}

                  {!accountsLoading && !accountsError && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {ALL_PLATFORMS.map((platform) => {
                        const info = PLATFORM_INFO[platform]
                        const account = accounts.find((a) => a.platform === platform)
                        const connected = !!account
                        const selected = selectedPlatforms.has(platform)
                        return (
                          <button
                            key={platform}
                            type="button"
                            data-testid={`publish-platform-${platform}`}
                            onClick={() => togglePlatform(platform)}
                            disabled={!connected}
                            className={cn(
                              'relative flex flex-col items-start gap-1 p-3 rounded-xl border transition-all duration-200 text-left',
                              connected
                                ? selected
                                  ? 'bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10'
                                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                                : 'bg-white/[0.01] border-white/[0.04] opacity-40 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-lg leading-none">{info.icon}</span>
                              {connected && selected && (
                                <div className="h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center">
                                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <div className="w-full min-w-0">
                              <p className="text-xs font-medium text-white/90 truncate">
                                {info.label}
                              </p>
                              {connected ? (
                                <p className="text-[10px] text-white/40 truncate">
                                  @{account?.username}
                                </p>
                              ) : (
                                <Link
                                  href="/settings/social"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-violet-400/80 hover:text-violet-300 underline pointer-events-auto"
                                >
                                  Connecter
                                </Link>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Caption */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/90">Caption</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="caption-mode-auto"
                      onClick={() => setCaptionMode('auto')}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border transition-all',
                        captionMode === 'auto'
                          ? 'bg-violet-500/15 border-violet-500/50'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      )}
                    >
                      <Wand2 className="h-4 w-4 text-violet-400" />
                      <span className="text-xs text-white/90 text-left">
                        Caption automatique IA
                      </span>
                    </button>
                    <button
                      type="button"
                      data-testid="caption-mode-custom"
                      onClick={() => setCaptionMode('custom')}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border transition-all',
                        captionMode === 'custom'
                          ? 'bg-violet-500/15 border-violet-500/50'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      )}
                    >
                      <Hash className="h-4 w-4 text-violet-400" />
                      <span className="text-xs text-white/90 text-left">
                        Caption personnalisee
                      </span>
                    </button>
                  </div>

                  {captionMode === 'custom' && (
                    <textarea
                      data-testid="custom-caption-input"
                      value={customCaption}
                      onChange={(e) => setCustomCaption(e.target.value)}
                      placeholder="Ecris ta caption..."
                      rows={3}
                      maxLength={2200}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
                    />
                  )}

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoHashtags}
                      onChange={(e) => setAutoHashtags(e.target.checked)}
                      className="h-4 w-4 rounded accent-violet-500"
                      data-testid="auto-hashtags-toggle"
                    />
                    <span className="text-xs text-white/70">
                      Ajouter hashtags viraux automatiquement
                    </span>
                  </label>
                </div>

                {/* Schedule */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white/90">Diffusion</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="schedule-now"
                      onClick={() => setSchedule('now')}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border transition-all',
                        schedule === 'now'
                          ? 'bg-violet-500/15 border-violet-500/50'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      )}
                    >
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      <span className="text-xs text-white/90">Publier maintenant</span>
                    </button>
                    <button
                      type="button"
                      data-testid="schedule-later"
                      onClick={() => setSchedule('later')}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border transition-all',
                        schedule === 'later'
                          ? 'bg-violet-500/15 border-violet-500/50'
                          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                      )}
                    >
                      <Calendar className="h-4 w-4 text-violet-400" />
                      <span className="text-xs text-white/90">Programmer</span>
                    </button>
                  </div>

                  {schedule === 'later' && (
                    <input
                      type="datetime-local"
                      data-testid="scheduled-at-input"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/90 focus:outline-none focus:border-violet-500/50"
                    />
                  )}
                </div>

                {/* Results */}
                {results && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-white/90">Resultats</h3>
                    <div className="space-y-1.5">
                      {results.map((r) => {
                        const info = PLATFORM_INFO[r.platform]
                        return (
                          <div
                            key={r.platform}
                            data-testid={`publish-result-${r.platform}`}
                            className={cn(
                              'flex items-center justify-between p-2.5 rounded-lg border text-xs',
                              r.success
                                ? 'bg-emerald-500/10 border-emerald-500/20'
                                : 'bg-red-500/10 border-red-500/20'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span>{info.icon}</span>
                              <span className="font-medium text-white/90">{info.label}</span>
                              {r.success ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                                  Publie
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px]">
                                  Echec
                                </span>
                              )}
                            </div>
                            {r.postUrl && (
                              <a
                                href={r.postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                              >
                                Voir
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {r.error && !r.success && (
                              <span className="text-red-400/80 truncate max-w-[180px]">
                                {r.error}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] bg-[#0c0b14]/95 backdrop-blur-xl">
                <Button
                  variant="ghost"
                  size="md"
                  data-testid="publish-cancel"
                  onClick={() => setIsOpen(false)}
                  disabled={publishing}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  data-testid="publish-submit"
                  onClick={handlePublish}
                  loading={publishing}
                  disabled={publishing || selectedPlatforms.size === 0}
                >
                  {publishing
                    ? 'Publication...'
                    : schedule === 'later'
                      ? 'Programmer'
                      : `Publier (${selectedPlatforms.size})`}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default PublishEverywhereButton
