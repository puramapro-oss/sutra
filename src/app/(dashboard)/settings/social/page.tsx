'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Sparkles,
  Check,
  X,
  Settings2,
  Zap,
  Hash,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

interface SocialAccount {
  id: string
  platform: SocialPlatform
  username: string
  display_name: string
  avatar_url: string | null
  status: string
  connected_at: string
}

interface AutopilotConfig {
  enabled: boolean
  default_platforms: string[]
  auto_caption: boolean
  auto_hashtags: boolean
  caption_style: 'engaging' | 'professional' | 'casual' | 'educational' | 'humorous'
  max_hashtags: number
  include_cta: boolean
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

  // URL params handler (success / error toasts)
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

  const handleDisconnect = useCallback(async (account: SocialAccount) => {
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
  }, [fetchAccounts])

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
      toast.error("Impossible d'enregistrer l'autopilot")
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Link
            href="/settings"
            data-testid="back-to-settings"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux parametres
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-violet-300 bg-clip-text text-transparent">
                Comptes sociaux
              </h1>
              <p className="mt-2 text-white/60 text-sm sm:text-base">
                Connecte tes reseaux pour publier automatiquement avec l&apos;autopilot IA.
              </p>
            </div>

            <Link href="#autopilot" data-testid="link-autopilot-config">
              <Button variant="secondary" size="md">
                <Settings2 className="w-4 h-4" />
                Configurer l&apos;autopilot
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Connected summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 sm:p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-white/60">Statut de connexion</p>
                <p className="text-lg font-semibold" data-testid="connected-count">
                  {connectedCount} / {TOTAL_PLATFORMS} comptes connectes
                </p>
              </div>
            </div>
            <Badge variant="premium">{progressPct}%</Badge>
          </div>
          <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"
            />
          </div>
        </motion.div>

        {/* Platform grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {PLATFORMS_ORDER.map((platform, i) => {
              const info = PLATFORM_INFO[platform]
              const account = accountsByPlatform[platform]
              const isConnected = !!account
              const isConnecting = connecting === platform
              const isDisconnecting = account && disconnectingId === account.id

              return (
                <motion.div
                  key={platform}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.35 }}
                  className={cn(
                    'relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5 flex flex-col',
                    'hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300'
                  )}
                  style={{ boxShadow: isConnected ? `0 0 0 1px ${info.color}40` : undefined }}
                  data-testid={`platform-card-${platform}`}
                >
                  {/* Top accent */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: info.color }}
                    aria-hidden
                  />

                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-lg',
                        info.bgColor
                      )}
                    >
                      <span aria-hidden>{info.icon}</span>
                    </div>
                    {isConnected && (
                      <Badge variant="success" className="gap-1">
                        <Check className="w-3 h-3" />
                        Connecte
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-white mb-1">{info.label}</h3>
                  <p className="text-xs text-white/50 line-clamp-2 mb-4 flex-1">
                    {info.description}
                  </p>

                  {isConnected && account ? (
                    <div className="space-y-2">
                      <div className="text-xs text-white/70 truncate">
                        @{account.username || account.display_name || 'compte'}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        loading={!!isDisconnecting}
                        onClick={() => setConfirmDisconnect(account)}
                        data-testid={`disconnect-${platform}`}
                      >
                        <X className="w-3 h-3" />
                        Deconnecter
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      loading={isConnecting}
                      onClick={() => handleConnect(platform)}
                      data-testid={`connect-${platform}`}
                    >
                      Se connecter
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Autopilot section */}
        <motion.div
          id="autopilot"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Autopilot IA</h2>
                <p className="text-sm text-white/60">
                  Publication automatique multi-reseaux avec captions et hashtags generes par
                  Claude.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                updateAutopilot('enabled', !(autopilotConfig?.enabled ?? false))
              }
              data-testid="toggle-autopilot"
              className={cn(
                'relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0',
                autopilotConfig?.enabled ? 'bg-violet-500' : 'bg-white/10'
              )}
              aria-label="Activer l'autopilot"
            >
              <motion.span
                animate={{ x: autopilotConfig?.enabled ? 22 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {autopilotConfig?.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-6 pt-2">
                  {/* Default platforms */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      Plateformes par defaut
                    </label>
                    {connectedCount === 0 ? (
                      <p className="text-xs text-white/50 italic">
                        Aucun compte connecte. Connecte au moins un reseau social ci-dessus.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {PLATFORMS_ORDER.filter((p) => accountsByPlatform[p]).map((p) => {
                          const info = PLATFORM_INFO[p]
                          const checked = autopilotConfig.default_platforms.includes(p)
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePlatformDefault(p)}
                              data-testid={`autopilot-platform-${p}`}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
                                checked
                                  ? 'bg-violet-500/15 border-violet-500/50 text-white'
                                  : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:border-white/[0.12]'
                              )}
                            >
                              <span aria-hidden>{info.icon}</span>
                              <span className="truncate">{info.label}</span>
                              {checked && (
                                <Check className="w-3.5 h-3.5 ml-auto text-violet-300" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Toggles row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <ToggleRow
                      label="Auto-caption"
                      icon={<MessageSquare className="w-4 h-4" />}
                      checked={autopilotConfig.auto_caption}
                      onChange={(v) => updateAutopilot('auto_caption', v)}
                      testId="toggle-auto-caption"
                    />
                    <ToggleRow
                      label="Auto-hashtags"
                      icon={<Hash className="w-4 h-4" />}
                      checked={autopilotConfig.auto_hashtags}
                      onChange={(v) => updateAutopilot('auto_hashtags', v)}
                      testId="toggle-auto-hashtags"
                    />
                    <ToggleRow
                      label="Inclure CTA"
                      icon={<Sparkles className="w-4 h-4" />}
                      checked={autopilotConfig.include_cta}
                      onChange={(v) => updateAutopilot('include_cta', v)}
                      testId="toggle-include-cta"
                    />
                  </div>

                  {/* Caption style */}
                  <div>
                    <label
                      htmlFor="caption-style"
                      className="block text-sm font-semibold text-white mb-2"
                    >
                      Style de caption
                    </label>
                    <select
                      id="caption-style"
                      data-testid="select-caption-style"
                      value={autopilotConfig.caption_style}
                      onChange={(e) =>
                        updateAutopilot(
                          'caption_style',
                          e.target.value as AutopilotConfig['caption_style']
                        )
                      }
                      className="w-full sm:w-auto bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    >
                      <option value="engaging">Engageant</option>
                      <option value="professional">Professionnel</option>
                      <option value="casual">Decontracte</option>
                      <option value="educational">Educatif</option>
                      <option value="humorous">Humoristique</option>
                    </select>
                  </div>

                  {/* Max hashtags */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="max-hashtags"
                        className="text-sm font-semibold text-white"
                      >
                        Nombre max de hashtags
                      </label>
                      <span className="text-sm font-mono text-violet-300">
                        {autopilotConfig.max_hashtags}
                      </span>
                    </div>
                    <input
                      id="max-hashtags"
                      type="range"
                      min={1}
                      max={30}
                      value={autopilotConfig.max_hashtags}
                      onChange={(e) =>
                        updateAutopilot('max_hashtags', Number(e.target.value))
                      }
                      data-testid="slider-max-hashtags"
                      className="w-full accent-violet-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end mt-8">
            <Button
              variant="primary"
              size="md"
              loading={savingAutopilot}
              onClick={handleSaveAutopilot}
              disabled={!autopilotConfig}
              data-testid="save-autopilot"
            >
              <Check className="w-4 h-4" />
              Enregistrer l&apos;autopilot
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Confirm disconnect modal */}
      <AnimatePresence>
        {confirmDisconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmDisconnect(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0A0A0F] border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Deconnecter {PLATFORM_INFO[confirmDisconnect.platform].label} ?
                  </h3>
                  <p className="text-sm text-white/60">
                    Tu ne pourras plus publier automatiquement sur ce reseau jusqu&apos;a une
                    nouvelle connexion.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setConfirmDisconnect(null)}
                  data-testid="cancel-disconnect"
                >
                  Annuler
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={() => handleDisconnect(confirmDisconnect)}
                  data-testid="confirm-disconnect"
                >
                  Deconnecter
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToggleRow({
  label,
  icon,
  checked,
  onChange,
  testId,
}: {
  label: string
  icon: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all w-full',
        checked
          ? 'bg-violet-500/10 border-violet-500/40'
          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
      )}
    >
      <span className="flex items-center gap-2 text-sm text-white/90">
        <span className={cn(checked ? 'text-violet-300' : 'text-white/50')}>{icon}</span>
        {label}
      </span>
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-violet-500' : 'bg-white/10'
        )}
      >
        <motion.span
          animate={{ x: checked ? 20 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="inline-block h-4 w-4 rounded-full bg-white shadow"
        />
      </span>
    </button>
  )
}
