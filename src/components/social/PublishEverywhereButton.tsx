'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import { type SocialPlatform } from '@/lib/zernio'
import { accountLabel, isAccountAvailable, MAX_SELECTED_ACCOUNTS, readSocialAccounts, type SocialAccount } from '@/components/settings/social/accounts'
import { PublishTriggerButton } from './publish/PublishTriggerButton'
import { PublishVideoPreview } from './publish/PublishVideoPreview'
import { PublishPlatformGrid } from './publish/PublishPlatformGrid'
import { PublishCaptionSection } from './publish/PublishCaptionSection'
import { PublishScheduleSection, localDateTime } from './publish/PublishScheduleSection'
import { PublishResultsSection, type PublishResultUI } from './publish/PublishResultsSection'
import { PublishModalFooter } from './publish/PublishModalFooter'
import { mergePublicationResults, normalizePublicationResults, readDurablePublicationReceipt, unknownPublicationResults } from './publish/publication-results'
import { usePublicationReconciliation } from './publish/usePublicationReconciliation'
import type { PublicationIntent, PublicationSnapshot } from './publish/publication-intent'

export interface PublishEverywhereButtonProps {
  videoId: string
  videoTitle: string
  videoUrl?: string
  variant?: 'primary' | 'secondary' | 'compact'
  defaultPlatforms?: SocialPlatform[]
  defaultAccountIds?: string[]
  onPublishComplete?: (
    results: Array<{ platform: SocialPlatform; localAccountId?: string; accountId?: string; success: boolean; postUrl?: string }>
  ) => void | Promise<void>
}

export function PublishEverywhereButton(props: PublishEverywhereButtonProps) {
  return <PublishEverywhereButtonContent key={props.videoId} {...props} />
}

function PublishEverywhereButtonContent({
  videoId,
  videoTitle,
  videoUrl,
  variant = 'primary',
  defaultPlatforms,
  defaultAccountIds,
  onPublishComplete,
}: PublishEverywhereButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [ownedAccounts, setOwnedAccounts] = useState<SocialAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const initialDefaults = useRef({ platforms: defaultPlatforms ?? [], accountIds: defaultAccountIds })
  const defaultsApplied = useRef(false)
  const [captionMode, setCaptionMode] = useState<'auto' | 'custom'>('auto')
  const [customCaption, setCustomCaption] = useState('')
  const [autoHashtags, setAutoHashtags] = useState(true)
  const [schedule, setSchedule] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<PublishResultUI[] | null>(null)

  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const accountRequest = useRef<AbortController | null>(null)
  const publicationRequest = useRef<AbortController | null>(null)
  const publicationVersion = useRef(0)
  const submitting = useRef(false)
  const submitted = useRef<{ payload: PublicationIntent; accounts: SocialAccount[] } | null>(null)
  const [submittedSnapshot, setSubmittedSnapshot] = useState<PublicationSnapshot | null>(null)
  const { canVerify, verifying, readingJournal, verificationError, verify, cancelJournalRead, canPrepare, pollingPaused, resetPolling } = usePublicationReconciliation({
    videoId, isOpen, accounts: ownedAccounts, setSnapshot: setSubmittedSnapshot,
    snapshot: submittedSnapshot, results, setResults, submittingRef: submitting, requestRef: publicationRequest, versionRef: publicationVersion,
  })
  // A sibling account's success or uncertainty must not affect a confirmed failure.
  // Reconnection to a different external identity is never a retry destination.
  const retryAccountIds = new Set((results ?? []).filter(result => (submittedSnapshot?.durable === true
    ? result.canRequestRetry === true && (result.status === 'failed' || (result.status === 'unknown' && result.deliveryState === 'blocked'))
    : result.status === 'failed' && result.retryEligible === true) && result.localAccountId
    && submittedSnapshot?.accounts.some(original => original.id === result.localAccountId
      && original.platform === result.platform
      && accounts.some(current => current.id === original.id && current.platform === original.platform
        && current.external_id === original.external_id && isAccountAvailable(current))))
    .map(result => result.localAccountId!))
  const targets = results ? retryAccountIds : selectedAccountIds

  const loadAccounts = useCallback(() => {
    accountRequest.current?.abort()
    const controller = new AbortController()
    accountRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 8000)
    return fetch('/api/social/accounts', { credentials: 'include', cache: 'no-store', signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('accounts_unavailable')
      const data = await res.json()
      const owned = readSocialAccounts(data.accounts)
      const list = owned.filter(account => isAccountAvailable(account))
      if (accountRequest.current !== controller) return
      controller.signal.throwIfAborted()
      setOwnedAccounts(owned)
      setAccounts(list)
      if (!defaultsApplied.current) {
        defaultsApplied.current = true
        const explicit = initialDefaults.current.accountIds
        const defaults = list.filter(account => explicit !== undefined
          ? explicit.includes(account.id)
          : initialDefaults.current.platforms.includes(account.platform)
            && list.filter(other => other.platform === account.platform).length === 1)
        setSelectedAccountIds(new Set(defaults.length <= MAX_SELECTED_ACCOUNTS ? defaults.map(account => account.id) : []))
      } else {
        setSelectedAccountIds(previous => new Set([...previous].filter(id => list.some(account => account.id === id))))
      }
    }).catch(() => {
      if (accountRequest.current === controller) setAccountsError('Impossible de vérifier les comptes. Réessaie ou ouvre les paramètres sociaux.')
    }).finally(() => {
      clearTimeout(timer)
      if (accountRequest.current === controller) setAccountsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (isOpen) void loadAccounts()
    return () => { accountRequest.current?.abort(); accountRequest.current = null }
  }, [isOpen, loadAccounts])

  useEffect(() => () => { publicationVersion.current++; publicationRequest.current?.abort(); publicationRequest.current = null }, [])

  const fetchAccounts = useCallback(() => {
    setAccountsLoading(true)
    setAccountsError(null)
    setAccounts([])
    return loadAccounts()
  }, [loadAccounts])

  const open = () => {
    resetPolling()
    setAccountsLoading(true)
    setAccountsError(null)
    setAccounts([])
    setIsOpen(true)
  }

  const toggleAccount = useCallback(
    (accountId: string) => {
      if (submitting.current || results) return
      setSelectedAccountIds((prev) => {
        const next = new Set(prev)
        if (next.has(accountId)) next.delete(accountId)
        else if (next.size < MAX_SELECTED_ACCOUNTS && accounts.some(account => account.id === accountId && isAccountAvailable(account))) next.add(accountId)
        return next
      })
    },
    [accounts, results]
  )

  const selectAll = useCallback(() => {
    if (submitting.current || results) return
    const available = accounts.filter(account => isAccountAvailable(account))
    if (available.length <= MAX_SELECTED_ACCOUNTS) setSelectedAccountIds(new Set(available.map(account => account.id)))
  }, [accounts, results])

  const deselectAll = useCallback(() => {
    if (submitting.current || results) return
    setSelectedAccountIds(new Set())
  }, [results])

  const handlePublish = async () => {
    if (submitting.current || !canPrepare || accountsLoading || accountsError || !targets.size) return
    if (results && !retryAccountIds.size) return
    const selectedAccounts = accounts.filter(account => targets.has(account.id) && isAccountAvailable(account))
    if (selectedAccounts.length !== targets.size) {
      setSubmissionError('Un compte sélectionné n’est plus disponible. Vérifie les connexions avant de confirmer.')
      return
    }
    if (!selectedAccounts.length || selectedAccounts.length > MAX_SELECTED_ACCOUNTS) return
    const platforms = [...new Set(selectedAccounts.map(account => account.platform))]
    const destinations = selectedAccounts.map(account => ({ platform: account.platform, accountId: account.id }))
    setSubmissionError(null)
    let instant: Date | undefined
    if (!submitted.current && !submittedSnapshot?.durable && schedule === 'later') {
      instant = new Date(scheduledAt)
      if (!Number.isFinite(instant.getTime()) || localDateTime(instant) !== scheduledAt || instant.getTime() <= Date.now()) {
        setSubmissionError('Choisis une date et une heure futures valides dans le fuseau indiqué. Une heure supprimée par le changement d’heure est refusée.')
        return
      }
    }
    if (!submitted.current && !submittedSnapshot?.durable && captionMode === 'custom' && !customCaption.trim()) {
      setSubmissionError('Ajoute une légende avant de confirmer la publication.')
      return
    }
    const payload: PublicationIntent = submittedSnapshot?.durable === true
      ? { videoId, platforms, destinations, autoCaption: false }
      : submitted.current
      ? { ...submitted.current.payload, platforms, destinations }
      : { videoId, platforms, destinations,
        autoCaption: captionMode === 'auto', ...(captionMode === 'custom' ? { caption: customCaption.trim() } : {}),
        ...(!autoHashtags ? { hashtags: [] } : {}), ...(instant ? { scheduledAt: instant.toISOString() } : {}) }
    submitted.current ??= { payload, accounts: selectedAccounts.map(account => ({ ...account })) }
    const intentSnapshot: PublicationSnapshot = submittedSnapshot?.durable === true ? submittedSnapshot
      : { ...submitted.current, videoId, destinations: submitted.current.payload.destinations }
    setSubmittedSnapshot(intentSnapshot)
    submitting.current = true
    const controller = new AbortController()
    const version = ++publicationVersion.current
    let receivedResults: PublishResultUI[] | null = null
    publicationRequest.current = controller
    const current = () => publicationRequest.current === controller
    const timeout = setTimeout(() => controller.abort(), 30_000)
    setPublishing(true)
    try {
      const res = await fetch('/api/social/publish', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      })
      if (!res.ok) throw new Error('publication_unconfirmed')
      const data = await res.json()
      if (!current()) return
      controller.signal.throwIfAborted()
      if (!Array.isArray(data.results) || !data.results.length) throw new Error('publication_unconfirmed')
      let list: PublishResultUI[]
      if (data.durable === true) {
        const receipt = readDurablePublicationReceipt({ ...data, destinations: data.destinations ?? payload.destinations },
          videoId, ownedAccounts, intentSnapshot)
        list = receipt.results
        setSubmittedSnapshot(receipt.snapshot)
      } else {
        list = normalizePublicationResults(data.results, selectedAccounts).map(result => ({ ...result, retryEligible: result.status === 'failed' }))
        setSubmittedSnapshot({ ...intentSnapshot, durable: false })
      }
      receivedResults = list
      setResults(previous => mergePublicationResults(previous, list))
      if (list.every(r => r.status === 'published')) toast.success('Publication confirmée sur les destinations sélectionnées.')
      else if (list.every(r => r.status === 'scheduled')) toast.info('Publication programmée. Elle n’a pas encore été publiée.')
    } catch {
      if (!current()) return
      // A lost response is not a confirmed failure. Never offer a second POST.
      setResults(previous => mergePublicationResults(previous, unknownPublicationResults(selectedAccounts)))
      setSubmissionError('Le résultat n’est pas confirmé. Consulte le suivi avant toute nouvelle action : la publication a peut-être été reçue.')
    } finally {
      clearTimeout(timeout)
      if (current()) { publicationRequest.current = null; submitting.current = false; setPublishing(false) }
    }
    if (receivedResults && publicationVersion.current === version) {
      // Refreshing the parent is separate from the provider's publication evidence.
      try {
        await onPublishComplete?.(receivedResults.map(r => ({ platform: r.platform, localAccountId: r.localAccountId, accountId: r.accountId, success: r.success, postUrl: r.postUrl })))
      } catch {
        if (publicationVersion.current === version) setSubmissionError('Les résultats de publication sont conservés. L’actualisation de la page a échoué ; consulte le suivi des publications.')
      }
    }
  }

  const close = () => {
    if (submitting.current && !cancelJournalRead()) return
    setIsOpen(false)
  }
  const labeledResults = results?.map(result => {
    const account = ownedAccounts.find(item => item.id === result.localAccountId && item.platform === result.platform
      && item.external_id === result.accountId)
    return account ? { ...result, accountLabel: accountLabel(account) } : result
  }) ?? null
  return (
    <>
      <PublishTriggerButton videoId={videoId} variant={variant} onClick={open} />
      <Modal open={isOpen} onClose={close} title="Publier sur les réseaux sociaux" className="sm:max-w-2xl" data-testid="publish-everywhere-modal">
        <p className="mb-4 break-words text-sm text-white/70">{videoTitle}</p>
        <div className="space-y-5" aria-busy={publishing || verifying}>
          <PublishVideoPreview videoUrl={videoUrl} />
          <PublishPlatformGrid accounts={accounts} selectedAccountIds={selectedAccountIds}
            onToggleAccount={toggleAccount} onSelectAll={selectAll} onDeselectAll={deselectAll}
            selectionLocked={publishing || verifying || results !== null}
            accountsLoading={accountsLoading} accountsError={accountsError} onRetryFetch={fetchAccounts} />
          <fieldset disabled={publishing || verifying || results !== null} className="min-w-0 space-y-5">
            <legend className="sr-only">Préparer la publication</legend>
            <PublishCaptionSection captionMode={captionMode} customCaption={customCaption} autoHashtags={autoHashtags}
              onCaptionModeChange={setCaptionMode} onCustomCaptionChange={setCustomCaption} onAutoHashtagsChange={setAutoHashtags} />
            <PublishScheduleSection schedule={schedule} scheduledAt={scheduledAt} onScheduleChange={setSchedule} onScheduledAtChange={setScheduledAt} />
          </fieldset>
          {submissionError && <p role="alert" className="text-sm text-red-300">{submissionError}</p>}
          {verificationError && <p role="alert" className="text-sm text-amber-200">{verificationError}</p>}
          {pollingPaused && <p className="text-sm text-white/70">L’actualisation automatique est en pause. Le traitement continue en arrière-plan ; utilise « Vérifier l’état » pour actualiser le suivi.</p>}
          <PublishResultsSection results={labeledResults} />
          {results ? <Link href="/publish" className="inline-block text-sm text-violet-300 underline">Consulter le suivi des publications</Link>
            : <p className="text-sm text-white/70">Vérifie la vidéo, les comptes et la date. Le bouton ci-dessous confirme ton envoi vers les destinations sélectionnées.</p>}
          <PublishModalFooter onCancel={close} onPublish={handlePublish} publishing={publishing} verifying={verifying} canVerify={canVerify}
            canCloseWhileVerifying={readingJournal}
            onVerify={results || verificationError ? () => { setSubmissionError(null); void verify() } : undefined}
            selectedCount={!canPrepare || accountsLoading || accountsError ? 0 : targets.size} schedule={schedule} retry={results !== null} />
        </div>
      </Modal>
    </>
  )
}

export default PublishEverywhereButton
