'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'
import { PageHeader } from '@/components/settings/social/PageHeader'
import { ConnectionSummary } from '@/components/settings/social/ConnectionSummary'
import { PlatformGrid } from '@/components/settings/social/PlatformGrid'
import { AutopilotSection, type AutopilotConfig } from '@/components/settings/social/AutopilotSection'
import { DisconnectConfirmModal } from '@/components/settings/social/DisconnectConfirmModal'

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

const TOTAL_PLATFORMS = PLATFORMS_ORDER.length

export default function SocialAccountsPage() {
  useAuth()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [autopilotConfig, setAutopilotConfig] = useState<AutopilotConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [savingAutopilot, setSavingAutopilot] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState<SocialAccount | null>(null)

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/social/accounts', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch_failed')
      const data = await res.json()
      setAccounts(Array.isArray(data?.accounts) ? data.accounts : [])
      if (data?.autopilot) {
        setAutopilotConfig({ ...DEFAULT_AUTOPILOT, ...data.autopilot })
      } else {
        setAutopilotConfig(DEFAULT_AUTOPILOT)
      }
    } catch {
      setAccounts([])
      setAutopilotConfig(DEFAULT_AUTOPILOT)
      toast.error('Impossible de charger tes comptes sociaux')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
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
      toast.error(`Connexion echouee : ${error}`)
      params.delete('error')
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const handleConnect = useCallback(async (platform: SocialPlatform) => {
    setConnecting(platform)
    try {
      const res = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (!res.ok) throw new Error('connect_failed')
      const data = await res.json()
      if (data?.oauthUrl) {
        window.location.href = data.oauthUrl
      } else {
        throw new Error('no_oauth_url')
      }
    } catch {
      toast.error(`Connexion ${PLATFORM_INFO[platform].label} indisponible`)
      setConnecting(null)
    }
  }, [])

  const handleDisconnect = useCallback(
    async (account: SocialAccount) => {
      setDisconnectingId(account.id)
      setConfirmDisconnect(null)
      try {
        const res = await fetch('/api/social/accounts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: account.id }),
        })
        if (!res.ok) throw new Error('disconnect_failed')
        toast.success(`${PLATFORM_INFO[account.platform].label} deconnecte`)
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
      acc[a.platform] = a
      return acc
    },
    {}
  )
  const connectedCount = Object.keys(accountsByPlatform).length
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

        <ConnectionSummary
          connectedCount={connectedCount}
          totalPlatforms={TOTAL_PLATFORMS}
          progressPct={progressPct}
        />

        <PlatformGrid
          loading={loading}
          accountsByPlatform={accountsByPlatform}
          connecting={connecting}
          disconnectingId={disconnectingId}
          onConnect={handleConnect}
          onDisconnectClick={setConfirmDisconnect}
        />

        <AutopilotSection
          config={autopilotConfig}
          accountsByPlatform={accountsByPlatform}
          connectedCount={connectedCount}
          savingAutopilot={savingAutopilot}
          onUpdateConfig={updateAutopilot}
          onTogglePlatformDefault={togglePlatformDefault}
          onSave={handleSaveAutopilot}
        />
      </div>

      <DisconnectConfirmModal
        account={confirmDisconnect}
        onCancel={() => setConfirmDisconnect(null)}
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
