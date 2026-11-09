'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Clock,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatRelativeDate } from '@/lib/utils'
import {
  type ServiceHealth,
  SERVICE_ICONS,
  SERVICE_LABELS,
  STATUS_CONFIG,
  GoldCard,
} from './health-config'

export default function AdminHealthPage() {
  const [services, setServices] = useState<ServiceHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  const dataRequest = useRef<AbortController | null>(null)
  const fetchHealth = useCallback(() => {
    dataRequest.current?.abort()
    const controller = new AbortController()
    dataRequest.current = controller
    const active = () => dataRequest.current === controller && !controller.signal.aborted
    const commit = (write: () => void) => { if (active()) write() }
    return fetch('/api/status', { signal: controller.signal }).then(async (res) => {
      if (!active()) return
      if (!res.ok) throw new Error('Erreur check sante')
      const data = await res.json()
      if (!data.services || typeof data.services !== 'object' || Array.isArray(data.services)) throw new Error('Mesures indisponibles')
      const checkedAt = typeof data.timestamp === 'string' && Number.isFinite(Date.parse(data.timestamp)) ? data.timestamp : null
      const healthServices: ServiceHealth[] = Object.entries(data.services as Record<string, unknown>).map(([key, raw]) => {
        const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
        const status: ServiceHealth['status'] = value.status === 'operational' || value.status === 'degraded' || value.status === 'down'
          ? value.status : 'unknown'
        return { name: SERVICE_LABELS[key] ?? key, key, status,
          latency_ms: typeof value.latency_ms === 'number' && Number.isFinite(value.latency_ms) && value.latency_ms >= 0 ? value.latency_ms : null,
          last_checked: status === 'unknown' ? null : checkedAt, uptime_30d: null }
      })
      const fullServices = Object.keys(SERVICE_LABELS).map((key) => {
        const found = healthServices.find((s) => s.key === key)
        return found ?? {
          name: SERVICE_LABELS[key] ?? key,
          key,
          status: 'unknown' as const,
          latency_ms: null,
          last_checked: null,
          uptime_30d: null,
        }
      })
      commit(() => setServices(fullServices))
      commit(() => setLastRefresh(checkedAt))
      commit(() => setError(null))
    }).catch(err => {
      if (!active()) return
      commit(() => setServices([]))
      commit(() => setLastRefresh(null))
      commit(() => setError(err instanceof Error ? err.message : 'Erreur inconnue'))
    }).finally(() => {
      commit(() => setLoading(false))
      commit(() => setTesting(false))
      if (dataRequest.current === controller) dataRequest.current = null
    })
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 300000) // 5 min
    return () => { clearInterval(interval); dataRequest.current?.abort(); dataRequest.current = null }
  }, [fetchHealth])

  const handleTestAll = () => {
    setTesting(true)
    fetchHealth()
  }

  const anyDown = services.some((s) => s.status === 'down')
  const anyDegraded = services.some((s) => s.status === 'degraded')
  const anyUnknown = services.some((s) => s.status === 'unknown')
  const allOperational = services.length > 0 && services.every((s) => s.status === 'operational')

  if (error && services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-health-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-health-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Services Health</h2>
          {lastRefresh && (
            <p className="text-xs text-white/30 mt-0.5">
              Derniere verification : {formatRelativeDate(lastRefresh)}
            </p>
          )}
        </div>
        <button
          onClick={handleTestAll}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          data-testid="admin-health-test-all"
        >
          <RefreshCw className={cn('h-4 w-4', testing && 'animate-spin')} />
          Actualiser les mesures
        </button>
      </div>

      {/* Alert Banner */}
      {!loading && anyDown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-red-500/[0.08] border border-red-500/20 px-5 py-4 flex items-center gap-3"
          data-testid="admin-health-alert"
        >
          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Service(s) hors service detecte(s)</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              {services.filter((s) => s.status === 'down').map((s) => s.name).join(', ')}
            </p>
          </div>
        </motion.div>
      )}

      {!loading && anyDegraded && !anyDown && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 px-5 py-4 flex items-center gap-3"
          data-testid="admin-health-warning"
        >
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Service(s) degrade(s)</p>
            <p className="text-xs text-amber-400/60 mt-0.5">
              {services.filter((s) => s.status === 'degraded').map((s) => s.name).join(', ')}
            </p>
          </div>
        </motion.div>
      )}

      {!loading && anyUnknown && (
        <div role="status" className="rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-white/70" data-testid="admin-health-unknown">
          Mesures indisponibles pour {services.filter(service => service.status === 'unknown').map(service => service.name).join(', ')}.
        </div>
      )}

      {!loading && allOperational && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 px-5 py-4 flex items-center gap-3"
        >
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Tous les services sont operationnels</p>
            <p className="text-xs text-emerald-400/60 mt-0.5">{services.length} services verifies</p>
          </div>
        </motion.div>
      )}

      {/* Service Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} height={180} width="100%" rounded="xl" />
          ))
        ) : (
          services.map((service, idx) => {
            const statusCfg = STATUS_CONFIG[service.status]
            const StatusIcon = statusCfg.icon
            const ServiceIcon = SERVICE_ICONS[service.key] ?? Server

            return (
              <motion.div
                key={service.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <GoldCard
                  className={cn('p-5', service.status !== 'operational' && 'border-current')}
                  style={
                    service.status === 'down'
                      ? { borderColor: 'rgba(239,68,68,0.2)' }
                      : service.status === 'degraded'
                        ? { borderColor: 'rgba(245,158,11,0.2)' }
                        : undefined
                  }
                  data-testid={`admin-health-service-${service.key}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                        <ServiceIcon className="h-5 w-5 text-white/60" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white/90">{service.name}</p>
                      </div>
                    </div>
                    <StatusIcon className={cn('h-5 w-5', statusCfg.color)} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">Statut</span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
                        <span className={cn('text-xs font-medium', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">Latence</span>
                      <span className={cn(
                        'text-xs font-medium',
                        service.latency_ms === null ? 'text-white/50' : service.latency_ms > 2000 ? 'text-red-400' :
                        service.latency_ms > 500 ? 'text-amber-400' : 'text-emerald-400'
                      )}>
                        {service.latency_ms !== null ? `${service.latency_ms}ms` : 'Non disponible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">Uptime 30j</span>
                      <span className={cn(
                        'text-xs font-medium',
                        service.uptime_30d === null ? 'text-white/50' : service.uptime_30d > 99 ? 'text-emerald-400' :
                        service.uptime_30d > 95 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {service.uptime_30d !== null ? `${service.uptime_30d.toFixed(1)}%` : 'Non disponible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/30">Verifie</span>
                      <span className="text-xs text-white/30">
                        {service.last_checked ? formatRelativeDate(service.last_checked) : 'Non vérifié'}
                      </span>
                    </div>

                    {/* Uptime bar */}
                    {service.uptime_30d !== null && <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${service.uptime_30d}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', statusCfg.dot)}
                      />
                    </div>}
                  </div>
                </GoldCard>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-white/20">
        <Clock className="h-3 w-3" />
        <span>Actualisation automatique toutes les 5 minutes</span>
      </div>
    </div>
  )
}
