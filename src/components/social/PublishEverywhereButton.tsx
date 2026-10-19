'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'
import { PublishTriggerButton } from './publish/PublishTriggerButton'
import { PublishVideoPreview } from './publish/PublishVideoPreview'
import { PublishPlatformGrid } from './publish/PublishPlatformGrid'
import { PublishCaptionSection } from './publish/PublishCaptionSection'
import { PublishScheduleSection, localDateTime } from './publish/PublishScheduleSection'
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

interface Submission {
  videoId: string
  platforms: SocialPlatform[]
  accountIds: Partial<Record<SocialPlatform, string>>
  autoCaption: boolean
  caption?: string
  hashtags?: string[]
  scheduledAt?: string
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

  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const accountRequest = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const submitted = useRef<Submission | null>(null)
  const connectedPlatforms = useMemo(() => new Set(accounts.map(a => a.platform)), [accounts])
  // A result is retryable only when this platform has an explicit failure and no
  // successful/uncertain destination. The server journal remains authoritative.
  const retryPlatforms = new Set((results ?? []).filter(r => r.status === 'failed'
    && submitted.current?.platforms.includes(r.platform)
    && accounts.some(account => account.platform === r.platform && account.id === submitted.current?.accountIds[r.platform])
    && !results?.some(other => other.platform === r.platform && other.status !== 'failed'))
    .map(r => r.platform))
  const targets = results ? retryPlatforms : selectedPlatforms

  const fetchAccounts = useCallback(async () => {
    accountRequest.current?.abort()
    const controller = new AbortController()
    accountRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 8000)
    setAccountsLoading(true)
    setAccountsError(null)
    setAccounts([])
    try {
      const res = await fetch('/api/social/accounts', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      if (!res.ok) throw new Error('accounts_unavailable')
      const data = await res.json()
      if (!Array.isArray(data.accounts)) throw new Error('accounts_invalid')
      const connected = data.accounts.filter((a: { id?: unknown; platform?: unknown; username?: unknown; status?: unknown; token_expires_at?: string | null }) =>
        typeof a.id === 'string' && typeof a.platform === 'string' && Object.hasOwn(PLATFORM_INFO, a.platform)
        && typeof a.username === 'string' && a.status === 'connected'
        && (a.token_expires_at == null || Date.parse(a.token_expires_at) > Date.now())) as SocialAccount[]
      // Do not silently choose a different account when a platform is ambiguous.
      const list = connected.filter(a => connected.filter(other => other.platform === a.platform).length === 1)
      if (accountRequest.current !== controller) return
      setAccounts(list)
      setSelectedPlatforms(previous => new Set([...previous].filter(platform => list.some(a => a.platform === platform))))
    } catch {
      if (accountRequest.current === controller) setAccountsError('Impossible de vérifier les comptes. Réessaie ou ouvre les paramètres sociaux.')
    } finally {
      clearTimeout(timer)
      if (accountRequest.current === controller) setAccountsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void fetchAccounts()
    return () => { accountRequest.current?.abort(); accountRequest.current = null }
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

  const handlePublish = async () => {
    if (submitting.current || accountsLoading || accountsError || !targets.size) return
    if (results && !retryPlatforms.size) return
    const platforms = [...targets].filter(platform => connectedPlatforms.has(platform))
    if (!platforms.length) return
    setSubmissionError(null)
    let instant: Date | undefined
    if (!submitted.current && schedule === 'later') {
      instant = new Date(scheduledAt)
      if (!Number.isFinite(instant.getTime()) || localDateTime(instant) !== scheduledAt || instant.getTime() <= Date.now()) {
        setSubmissionError('Choisis une date et une heure futures valides dans le fuseau indiqué. Une heure supprimée par le changement d’heure est refusée.')
        return
      }
    }
    if (!submitted.current && captionMode === 'custom' && !customCaption.trim()) {
      setSubmissionError('Ajoute une légende avant de confirmer la publication.')
      return
    }
    const payload: Submission = submitted.current
      ? { ...submitted.current, platforms }
      : { videoId, platforms, accountIds: Object.fromEntries(accounts.filter(a => platforms.includes(a.platform)).map(a => [a.platform, a.id])),
        autoCaption: captionMode === 'auto', ...(captionMode === 'custom' ? { caption: customCaption.trim() } : {}),
        ...(!autoHashtags ? { hashtags: [] } : {}), ...(instant ? { scheduledAt: instant.toISOString() } : {}) }
    submitted.current ??= payload
    submitting.current = true
    setPublishing(true)
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) throw new Error('publication_unconfirmed')
      const data = await res.json()
      if (!Array.isArray(data.results) || !data.results.length) throw new Error('publication_unconfirmed')
      const list: PublishResultUI[] = data.results.map((r: PublishResultUI) => {
        if (!r || !submitted.current?.platforms.includes(r.platform)) throw new Error('publication_unconfirmed')
        const status = r.status && ['published', 'scheduled', 'publishing', 'failed', 'unknown'].includes(r.status) ? r.status : 'unknown'
        return { platform: r.platform, accountId: r.accountId, status, success: status === 'published',
          postUrl: typeof r.postUrl === 'string' && /^https:\/\//i.test(r.postUrl) ? r.postUrl : undefined }
      })
      for (const platform of platforms) if (!list.some(r => r.platform === platform)) list.push({ platform, status: 'unknown', success: false })
      setResults(previous => [...(previous ?? []).filter(old => !list.some(r => r.platform === old.platform && r.accountId === old.accountId)), ...list])
      if (list.every(r => r.status === 'published')) toast.success('Publication confirmée sur les destinations sélectionnées.')
      else if (list.every(r => r.status === 'scheduled')) toast.info('Publication programmée. Elle n’a pas encore été publiée.')
      onPublishComplete?.(list.map(r => ({ platform: r.platform, success: r.success, postUrl: r.postUrl })))
    } catch {
      // A lost response is not a confirmed failure. Never offer a second POST.
      setResults(previous => [...(previous ?? []).filter(r => !platforms.includes(r.platform)), ...platforms.map(platform => ({ platform, success: false, status: 'unknown' as const }))])
      setSubmissionError('Le résultat n’est pas confirmé. Consulte le suivi avant toute nouvelle action : la publication a peut-être été reçue.')
    } finally {
      submitting.current = false
      setPublishing(false)
    }
  }

  const close = () => { if (!submitting.current) setIsOpen(false) }
  return (
    <>
      <PublishTriggerButton videoId={videoId} variant={variant} onClick={() => setIsOpen(true)} />
      <Modal open={isOpen} onClose={close} title="Publier sur les réseaux sociaux" className="sm:max-w-2xl" data-testid="publish-everywhere-modal">
        <p className="mb-4 break-words text-sm text-white/70">{videoTitle}</p>
        <div className="space-y-5" aria-busy={publishing}>
          <PublishVideoPreview videoUrl={videoUrl} />
          <fieldset disabled={publishing || results !== null} className="min-w-0 space-y-5">
            <legend className="sr-only">Préparer la publication</legend>
            <PublishPlatformGrid accounts={accounts} selectedPlatforms={selectedPlatforms}
              onTogglePlatform={togglePlatform} onSelectAll={selectAll} onDeselectAll={deselectAll}
              accountsLoading={accountsLoading} accountsError={accountsError} onRetryFetch={fetchAccounts} />
            <PublishCaptionSection captionMode={captionMode} customCaption={customCaption} autoHashtags={autoHashtags}
              onCaptionModeChange={setCaptionMode} onCustomCaptionChange={setCustomCaption} onAutoHashtagsChange={setAutoHashtags} />
            <PublishScheduleSection schedule={schedule} scheduledAt={scheduledAt} onScheduleChange={setSchedule} onScheduledAtChange={setScheduledAt} />
          </fieldset>
          {submissionError && <p role="alert" className="text-sm text-red-300">{submissionError}</p>}
          <PublishResultsSection results={results} />
          {results ? <Link href="/publish" className="inline-block text-sm text-violet-300 underline">Consulter le suivi des publications</Link>
            : <p className="text-sm text-white/70">Vérifie la vidéo, les comptes et la date. Le bouton ci-dessous confirme ton envoi vers les destinations sélectionnées.</p>}
          <PublishModalFooter onCancel={close} onPublish={handlePublish} publishing={publishing}
            selectedPlatforms={accountsLoading || accountsError ? new Set() : targets} schedule={schedule} retry={results !== null} />
        </div>
      </Modal>
    </>
  )
}

export default PublishEverywhereButton
