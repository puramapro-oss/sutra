'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  CreditCard,
  Mic,
  Cpu,
  Globe,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'down'
  latency_ms?: number
}

interface StatusResponse {
  status: 'ok' | 'degraded' | 'partial_outage' | 'error'
  services: Record<string, ServiceStatus>
  timestamp: string
  message?: string
}

const serviceLabels: Record<string, { label: string; icon: React.ElementType }> = {
  supabase: { label: 'Base de donnees', icon: Database },
  stripe: { label: 'Paiements (Stripe)', icon: CreditCard },
  elevenlabs: { label: 'Synthese vocale', icon: Mic },
  anthropic: { label: 'IA (Claude)', icon: Cpu },
  api: { label: 'API SUTRA', icon: Globe },
}

function getOverallLabel(status: string): { label: string; color: string; bgColor: string; icon: React.ElementType } {
  switch (status) {
    case 'ok':
      return {
        label: 'Tous les systemes sont operationnels',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10 border-green-500/20',
        icon: CheckCircle2,
      }
    case 'degraded':
      return {
        label: 'Performances degradees sur certains services',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10 border-yellow-500/20',
        icon: AlertTriangle,
      }
    case 'partial_outage':
      return {
        label: 'Panne partielle detectee',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/20',
        icon: XCircle,
      }
    default:
      return {
        label: 'Impossible de verifier le statut',
        color: 'text-white/50',
        bgColor: 'bg-white/5 border-white/[0.08]',
        icon: AlertTriangle,
      }
  }
}

function getServiceStatusInfo(status: string) {
  switch (status) {
    case 'operational':
      return { label: 'Operationnel', color: 'text-green-400', dot: 'bg-green-400' }
    case 'degraded':
      return { label: 'Degrade', color: 'text-yellow-400', dot: 'bg-yellow-400' }
    case 'down':
      return { label: 'Hors ligne', color: 'text-red-400', dot: 'bg-red-400' }
    default:
      return { label: 'Inconnu', color: 'text-white/40', dot: 'bg-white/40' }
  }
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      if (res.ok) {
        const json: StatusResponse = await res.json()
        setData(json)
      } else {
        setData({
          status: 'error',
          services: {},
          timestamp: new Date().toISOString(),
          message: 'Impossible de contacter le serveur',
        })
      }
    } catch {
      setData({
        status: 'error',
        services: {},
        timestamp: new Date().toISOString(),
        message: 'Erreur reseau',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => fetchStatus(), 60_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const overall = data ? getOverallLabel(data.status) : null

  return (
    <main className="min-h-screen bg-[#06050e] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#06050e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-orbitron)' }}
            data-testid="header-logo"
          >
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              SUTRA
            </span>
          </Link>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            data-testid="status-refresh"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/[0.08] text-sm text-white/70 hover:bg-white/10 transition-all"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Actualiser
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white mb-3"
            style={{ fontFamily: 'var(--font-orbitron)' }}
          >
            Statut des{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              services
            </span>
          </h1>
          <p className="text-white/50">
            Surveillance en temps reel de l&apos;infrastructure SUTRA
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Overall banner */}
            {overall && (
              <div
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-5 sm:p-6',
                  overall.bgColor
                )}
                data-testid="status-banner"
              >
                <overall.icon className={cn('w-6 h-6 flex-shrink-0', overall.color)} />
                <div>
                  <p className={cn('font-semibold', overall.color)}>
                    {overall.label}
                  </p>
                  {data.timestamp && (
                    <p className="text-xs text-white/30 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Derniere verification :{' '}
                      {new Date(data.timestamp).toLocaleString('fr-FR', {
                        timeZone: 'Europe/Paris',
                      })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Service cards */}
            <div className="space-y-3" data-testid="status-services">
              <AnimatePresence>
                {Object.entries(data.services).map(([key, service], i) => {
                  const meta = serviceLabels[key] ?? {
                    label: key,
                    icon: Globe,
                  }
                  const Icon = meta.icon
                  const info = getServiceStatusInfo(service.status)

                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5"
                      data-testid={`status-service-${key}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
                          <Icon className="w-4.5 h-4.5 text-white/60" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/90">
                            {meta.label}
                          </p>
                          {service.latency_ms !== undefined && (
                            <p className="text-xs text-white/30">
                              {service.latency_ms} ms
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-medium', info.color)}>
                          {info.label}
                        </span>
                        <span
                          className={cn('w-2.5 h-2.5 rounded-full', info.dot)}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {Object.keys(data.services).length === 0 && (
                <div className="text-center py-12 text-white/40 text-sm">
                  Aucun service a afficher.
                </div>
              )}
            </div>

            {/* Auto-refresh note */}
            <p className="text-center text-xs text-white/25">
              Cette page se rafraichit automatiquement toutes les 60 secondes.
            </p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] py-8 text-center">
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-white/60 transition-colors"
        >
          Retour a l&apos;accueil
        </Link>
      </div>
    </main>
  )
}
