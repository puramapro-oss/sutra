'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'
import { PageHeader } from '@/components/settings/social/PageHeader'
import { ConnectionSummary } from '@/components/settings/social/ConnectionSummary'
import { PlatformGrid } from '@/components/settings/social/PlatformGrid'
import { AutopilotSection, type AutopilotConfig } from '@/components/settings/social/AutopilotSection'
import { DisconnectConfirmModal } from '@/components/settings/social/DisconnectConfirmModal'
import { accountLabel, isAccountAvailable, MAX_SELECTED_ACCOUNTS, platformsForAccounts, readSocialAccounts, type SocialAccount } from '@/components/settings/social/accounts'
import Button from '@/components/ui/Button'
import { oauthErrorMessage } from './oauth-error-message'
import { readAutopilotConfig } from '@/components/settings/social/config'
import { useConnectSocialAccount } from '@/components/settings/social/useConnectSocialAccount'

const DEFAULT_AUTOPILOT: AutopilotConfig = {
  enabled: false,
  default_platforms: [],
  publish_account_ids: [],
  auto_caption: true,
  auto_hashtags: true,
  caption_style: 'engaging',
  max_hashtags: 10,
  include_cta: true,
}

const PLATFORMS_ORDER: SocialPlatform[] = [
  'tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'pinterest',
  'reddit', 'threads', 'snapchat', 'tumblr', 'mastodon', 'bluesky', 'vimeo',
]

const TOTAL_PLATFORMS = PLATFORMS_ORDER.length

export default function SocialAccountsPage() {
  const auth = useAuth()
  const fallback = <div role="status" className="p-6 text-white/70">Chargement des comptes sociaux…</div>
  if (auth.loading) return fallback
  return <Suspense fallback={fallback}><SocialAccountsPageContent key={auth.profile?.id ?? 'signed-out'} /></Suspense>
}

function SocialAccountsPageContent() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const accountsRequest = useRef<AbortController | null>(null)
  const disconnectRequest = useRef<AbortController | null>(null)
  const autopilotRequest = useRef<AbortController | null>(null)
  const { connecting, connectingAccountId, connectError, connectRequest, handleConnect } = useConnectSocialAccount(oauthErrorMessage(searchParams.get('error')), disconnectRequest)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [savingAutopilot, setSavingAutopilot] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState<SocialAccount | null>(null)
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null)

  const loadAccounts = useCallback(() => {
    if (accountsRequest.current) return
    const controller = new AbortController()
    accountsRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    return Promise.all([
        fetch('/api/social/accounts', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/social/autopilot', { cache: 'no-store', signal: controller.signal }),
      ]).then(async ([accountsResponse, autopilotResponse]) => {
      if (!accountsResponse.ok || !autopilotResponse.ok) throw new Error('fetch_failed')
      const [data, autopilot] = await Promise.all([accountsResponse.json(), autopilotResponse.json()])
      const loadedAccounts = readSocialAccounts(data?.accounts)
      const loadedAutopilot = readAutopilotConfig(autopilot?.config)
      if (accountsRequest.current !== controller || controller.signal.aborted) return
      setAccounts(loadedAccounts)
      setAutopilotConfig(loadedAutopilot)
      setLoadError(null)
    }).catch(() => {
      if (accountsRequest.current === controller) {
        setLoadError('Impossible de vérifier tes comptes et réglages sociaux. Leur état est indisponible. Réessaie dans un instant.')
      }
    }).finally(() => {
      clearTimeout(timeout)
      controller.abort()
      if (accountsRequest.current === controller) {
        accountsRequest.current = null
        setLoading(false)
      }
    })
  }, [])

  const fetchAccounts = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    void loadAccounts()
    return () => {
      accountsRequest.current?.abort()
      accountsRequest.current = null
      disconnectRequest.current?.abort()
      disconnectRequest.current = null
      autopilotRequest.current?.abort()
      autopilotRequest.current = null
    }
  }, [loadAccounts])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')

    if (connected) {
      const info = PLATFORM_INFO[connected as SocialPlatform]
      toast.success(
        info ? `${info.label} connecte avec succes !` : 'Compte connecte avec succes !'
      )
      params.delete('connected')
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }

    if (error) {
      // URL parameters are untrusted; only expose our safe callback contract.
      const message = oauthErrorMessage(error)
      if (message) toast.error(message)
      params.delete('error')
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const handleDisconnect = useCallback(
    async (account: SocialAccount) => {
      if (disconnectRequest.current || connectRequest.current) return
      const controller = new AbortController()
      disconnectRequest.current = controller
      const current = () => disconnectRequest.current === controller
      const timeout = setTimeout(() => controller.abort(), 30_000)
      setDisconnectingId(account.id)
      setConfirmDisconnect(null)
      setDisconnectNotice(null)
      try {
        const res = await fetch('/api/social/accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: account.id }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('disconnect_failed')
        const result = await res.json()
        if (!current() || controller.signal.aborted) return
        if (res.status === 200 && result.success === true && result.remoteStatus === 'revoked') {
          toast.success(`${PLATFORM_INFO[account.platform].label} : ${accountLabel(account)} déconnecté`)
        } else {
          setDisconnectNotice('Révocation distante non confirmée. Vérifie les autorisations dans ton réseau social avant de reconnecter ce compte. Aucune nouvelle tentative automatique ne sera lancée.')
        }
        await fetchAccounts()
      } catch {
        if (!current()) return
        setDisconnectNotice('Déconnexion non confirmée pour ce compte. Vérifie son état et ses autorisations avant toute nouvelle tentative.')
        await fetchAccounts()
      } finally {
        clearTimeout(timeout)
        if (current()) { disconnectRequest.current = null; setDisconnectingId(null) }
      }
    },
    [fetchAccounts, connectRequest]
  )

  const handleSaveAutopilot = useCallback(async () => {
    if (!autopilotConfig || autopilotRequest.current) return
    const selected = autopilotConfig.publish_account_ids
    if (autopilotConfig.enabled && (!selected.length || selected.some(id => !accounts.some(account => account.id === id && isAccountAvailable(account))))) return
    const controller = new AbortController()
    autopilotRequest.current = controller
    const current = () => autopilotRequest.current === controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    setSavingAutopilot(true)
    try {
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...autopilotConfig, default_platforms: platformsForAccounts(accounts, selected) }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('save_failed')
      const data = await res.json()
      const saved = readAutopilotConfig(data?.config)
      if (!current() || controller.signal.aborted) return
      setAutopilotConfig(saved)
      toast.success('Autopilot mis a jour')
    } catch {
      if (current()) toast.error('Enregistrement de l’autopilot non confirmé. Recharge les réglages pour vérifier leur état.')
    } finally {
      clearTimeout(timeout)
      if (current()) { autopilotRequest.current = null; setSavingAutopilot(false) }
    }
  }, [autopilotConfig, accounts])

  const accountsByPlatform = accounts.reduce<Partial<Record<SocialPlatform, SocialAccount[]>>>(
    (acc, a) => {
      ;(acc[a.platform] ??= []).push(a)
      return acc
    },
    {}
  )
  const connectedAccounts = accounts.filter(account => isAccountAvailable(account))
  const connectedCount = connectedAccounts.length
  const connectedPlatformCount = new Set(connectedAccounts.map(account => account.platform)).size
  const progressPct = Math.round((connectedPlatformCount / TOTAL_PLATFORMS) * 100)

  const updateAutopilot = <K extends keyof AutopilotConfig>(
    key: K,
    value: AutopilotConfig[K]
  ) => {
    setAutopilotConfig((prev) => ({ ...(prev ?? DEFAULT_AUTOPILOT), [key]: value }))
  }

  const toggleAccountDefault = (accountId: string) => {
    setAutopilotConfig((prev) => {
      const base = prev ?? DEFAULT_AUTOPILOT
      const list = new Set(base.publish_account_ids)
      if (list.has(accountId)) list.delete(accountId)
      else if (list.size < MAX_SELECTED_ACCOUNTS && accounts.some(account => account.id === accountId && isAccountAvailable(account))) list.add(accountId)
      const ids = [...list]
      return { ...base, publish_account_ids: ids, default_platforms: platformsForAccounts(accounts, ids) }
    })
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        <PageHeader />

        {loading && <p role="status" className="mb-6 text-sm text-white/70">Vérification des comptes sociaux…</p>}

        {loadError && (
          <div id="autopilot" role="alert" data-testid="social-load-error" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
            <p className="mb-4">{loadError}</p>
            <Button variant="secondary" onClick={() => void fetchAccounts()}>Réessayer</Button>
          </div>
        )}

        {!loading && !loadError && <ConnectionSummary
          connectedCount={connectedCount}
          connectedPlatformCount={connectedPlatformCount}
          totalPlatforms={TOTAL_PLATFORMS}
          progressPct={progressPct}
        />}

        {disconnectNotice && <p role="alert" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">{disconnectNotice}</p>}
        {connectError && <p role="alert" data-testid="social-connect-error" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">{connectError}</p>}

        {!loadError && <PlatformGrid
          loading={loading}
          accountsByPlatform={accountsByPlatform}
          connecting={connecting}
          connectingAccountId={connectingAccountId}
          disconnectingId={disconnectingId}
          onConnect={handleConnect}
          onDisconnectClick={setConfirmDisconnect}
        />}

        {!loading && !loadError && <AutopilotSection
          config={autopilotConfig}
          accounts={accounts}
          savingAutopilot={savingAutopilot}
          onUpdateConfig={updateAutopilot}
          onToggleAccount={toggleAccountDefault}
          onSave={handleSaveAutopilot}
        />}
      </div>

      <DisconnectConfirmModal
        account={confirmDisconnect}
        onCancel={() => setConfirmDisconnect(null)}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
