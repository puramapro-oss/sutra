'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'
import { PageHeader } from '@/components/settings/social/PageHeader'
import { ConnectionSummary } from '@/components/settings/social/ConnectionSummary'
import { PlatformGrid } from '@/components/settings/social/PlatformGrid'
import { AutopilotSection, type AutopilotConfig } from '@/components/settings/social/AutopilotSection'
import { DisconnectConfirmModal } from '@/components/settings/social/DisconnectConfirmModal'
import Button from '@/components/ui/Button'

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
  display_name: string
  avatar_url: string | null
  status: string
  connected_at: string
}

const DEFAULT_AUTOPILOT: AutopilotConfig = {
  enabled: false,
  default_platforms: [],
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

// A failed or malformed read is unknown; never replace saved preferences with defaults.
function isAutopilotConfig(value: unknown): value is AutopilotConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const config = value as Record<string, unknown>
  return ['enabled', 'auto_caption', 'auto_hashtags', 'include_cta'].every(key => typeof config[key] === 'boolean')
    && Array.isArray(config.default_platforms)
    && config.default_platforms.every(platform => typeof platform === 'string' && PLATFORMS_ORDER.includes(platform as SocialPlatform))
    && typeof config.caption_style === 'string'
    && ['engaging', 'professional', 'casual', 'educational', 'humorous'].includes(config.caption_style)
    && typeof config.max_hashtags === 'number' && Number.isInteger(config.max_hashtags)
    && config.max_hashtags >= 0 && config.max_hashtags <= 30
}

export default function SocialAccountsPage() {
  useAuth()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const accountsRequest = useRef<AbortController | null>(null)
  const connectRequest = useRef<AbortController | null>(null)
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [savingAutopilot, setSavingAutopilot] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState<SocialAccount | null>(null)
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    if (accountsRequest.current) return
    const controller = new AbortController()
    accountsRequest.current = controller
    setLoading(true)
    setLoadError(null)
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const [accountsResponse, autopilotResponse] = await Promise.all([
        fetch('/api/social/accounts', { cache: 'no-store', signal: controller.signal }),
        fetch('/api/social/autopilot', { cache: 'no-store', signal: controller.signal }),
      ])
      if (!accountsResponse.ok || !autopilotResponse.ok) throw new Error('fetch_failed')
      const [data, autopilot] = await Promise.all([accountsResponse.json(), autopilotResponse.json()])
      if (!Array.isArray(data?.accounts) || !isAutopilotConfig(autopilot?.config)) throw new Error('invalid_social_state')
      if (accountsRequest.current !== controller || controller.signal.aborted) return
      setAccounts(data.accounts)
      setAutopilotConfig(autopilot.config)
    } catch {
      if (accountsRequest.current === controller) {
        setLoadError('Impossible de vérifier tes comptes et réglages sociaux. Leur état est indisponible. Réessaie dans un instant.')
      }
    } finally {
      clearTimeout(timeout)
      controller.abort()
      if (accountsRequest.current === controller) {
        accountsRequest.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchAccounts()
    return () => {
      accountsRequest.current?.abort()
      accountsRequest.current = null
      connectRequest.current?.abort()
      connectRequest.current = null
    }
  }, [fetchAccounts])

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
      const message = error === 'invalid_or_expired_state'
        ? 'Ce lien a expiré ou a déjà été utilisé. Relance la connexion depuis cette page.'
        : error === 'session_required'
          ? 'Ta session a expiré. Reconnecte-toi à SUTRA, puis relance la connexion du compte.'
          : error === 'oauth_denied'
            ? 'Autorisation refusée. Aucun compte ajouté ; tu peux réessayer si tu le souhaites.'
            : error === 'oauth_empty_profile'
              ? 'Aucun compte autorisé trouvé. Relance la connexion et sélectionne le compte souhaité.'
              : error === 'db_error'
                ? 'Impossible d’enregistrer la connexion. Vérifie la liste des comptes avant de réessayer.'
                : 'Connexion indisponible. Relance la connexion depuis cette page.'
      toast.error(message)
      setConnectError(message)
      params.delete('error')
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const handleConnect = useCallback(async (platform: SocialPlatform) => {
    // React state alone cannot guard two activations in the same event turn.
    if (connectRequest.current) return
    const controller = new AbortController()
    connectRequest.current = controller
    const current = () => connectRequest.current === controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let redirecting = false
    setConnecting(platform)
    setConnectError(null)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
        signal: controller.signal,
      })
      if (!current() || controller.signal.aborted) return
      if (!res.ok) {
        // These statuses are SUTRA's safe contract; never display provider error bodies.
        const message = res.status === 409
          ? 'Déconnexion en cours de vérification. Réessayez plus tard ; si le blocage persiste, contactez votre administrateur.'
          : res.status === 503
            ? 'Profil social non attribué. Contactez votre administrateur.'
            : `Connexion ${PLATFORM_INFO[platform].label} indisponible`
        toast.error(message)
        setConnectError(message)
        return
      }
      const data = await res.json()
      if (!current() || controller.signal.aborted) return
      if (data?.oauthUrl) {
        window.location.href = data.oauthUrl
        redirecting = true
      } else {
        throw new Error('no_oauth_url')
      }
    } catch {
      if (!current()) return // Unmounted: no late toast or redirect.
      const message = controller.signal.aborted
        ? 'Le lien de connexion n’a pas pu être récupéré à temps. Réessaie manuellement.'
        : `Connexion ${PLATFORM_INFO[platform].label} indisponible`
      toast.error(message)
      setConnectError(message)
    } finally {
      clearTimeout(timeout)
      // Hold the guard until navigation; an OAuth redirect must not be duplicated.
      if (current() && !redirecting) {
        connectRequest.current = null
        setConnecting(null)
      }
    }
  }, [])

  const handleDisconnect = useCallback(
    async (account: SocialAccount) => {
      setDisconnectingId(account.id)
      setConfirmDisconnect(null)
      setDisconnectNotice(null)
      try {
        const res = await fetch('/api/social/accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: account.id }),
        })
        if (!res.ok) throw new Error('disconnect_failed')
        const result = await res.json()
        if (res.status === 200 && result.success === true && result.remoteStatus === 'revoked') {
          toast.success(`${PLATFORM_INFO[account.platform].label} deconnecte`)
        } else {
          setDisconnectNotice('Révocation distante non confirmée. Vérifie les autorisations dans ton réseau social avant de reconnecter ce compte. Aucune nouvelle tentative automatique ne sera lancée.')
        }
        await fetchAccounts()
      } catch {
        toast.error('Impossible de deconnecter ce compte')
      } finally {
        setDisconnectingId(null)
      }
    },
    [fetchAccounts]
  )

  const handleSaveAutopilot = useCallback(async () => {
    if (!autopilotConfig) return
    setSavingAutopilot(true)
    try {
      const res = await fetch('/api/social/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autopilotConfig),
      })
      if (!res.ok) throw new Error('save_failed')
      toast.success('Autopilot mis a jour')
    } catch {
      toast.error("Impossible d&apos;enregistrer l&apos;autopilot")
    } finally {
      setSavingAutopilot(false)
    }
  }, [autopilotConfig])

  const accountsByPlatform = accounts.reduce<Partial<Record<SocialPlatform, SocialAccount>>>(
    (acc, a) => {
      // Keep the historical row visible, but never let it mask a live connection.
      if (acc[a.platform]?.status !== 'connected') acc[a.platform] = a
      return acc
    },
    {}
  )
  const connectedAccountsByPlatform = Object.fromEntries(
    Object.entries(accountsByPlatform).filter(([, account]) => account.status === 'connected')
  )
  const connectedCount = Object.keys(connectedAccountsByPlatform).length
  const progressPct = Math.round((connectedCount / TOTAL_PLATFORMS) * 100)

  const updateAutopilot = <K extends keyof AutopilotConfig>(
    key: K,
    value: AutopilotConfig[K]
  ) => {
    setAutopilotConfig((prev) => ({ ...(prev ?? DEFAULT_AUTOPILOT), [key]: value }))
  }

  const togglePlatformDefault = (platform: SocialPlatform) => {
    setAutopilotConfig((prev) => {
      const base = prev ?? DEFAULT_AUTOPILOT
      const list = new Set(base.default_platforms)
      if (list.has(platform)) list.delete(platform)
      else list.add(platform)
      return { ...base, default_platforms: Array.from(list) }
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
          totalPlatforms={TOTAL_PLATFORMS}
          progressPct={progressPct}
        />}

        {disconnectNotice && <p role="alert" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">{disconnectNotice}</p>}
        {connectError && <p role="alert" data-testid="social-connect-error" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">{connectError}</p>}

        {!loadError && <PlatformGrid
          loading={loading}
          accountsByPlatform={accountsByPlatform}
          connecting={connecting}
          disconnectingId={disconnectingId}
          onConnect={handleConnect}
          onDisconnectClick={setConfirmDisconnect}
        />}

        {!loading && !loadError && <AutopilotSection
          config={autopilotConfig}
          accountsByPlatform={connectedAccountsByPlatform}
          connectedCount={connectedCount}
          savingAutopilot={savingAutopilot}
          onUpdateConfig={updateAutopilot}
          onTogglePlatformDefault={togglePlatformDefault}
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
