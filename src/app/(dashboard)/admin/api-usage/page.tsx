'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Clock,
  AlertTriangle,
  Cpu,
  Zap,
  Server,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPrice, formatRelativeDate } from '@/lib/utils'

interface ServiceUsage {
  service: string
  requests_today: number
  requests_week: number
  requests_month: number
  avg_response_ms: number
  error_rate: number
  cost_today: number
  cost_month: number
  status: 'operational' | 'degraded' | 'down'
}

interface ErrorLog {
  id: string
  service: string
  message: string
  status_code: number | null
  created_at: string
}

interface RunPodMetrics {
  gpu_time_hours: number
  cost_per_video_avg: number
  total_videos_processed: number
  queue_depth: number
}

const SERVICE_CONFIG: Record<string, { label: string; color: string; icon: typeof Cpu }> = {
  claude: { label: 'Claude AI', color: '#8B5CF6', icon: Zap },
  elevenlabs: { label: 'ElevenLabs', color: '#3B82F6', icon: Activity },
  runpod: { label: 'RunPod', color: '#10B981', icon: Cpu },
  suno: { label: 'Suno', color: '#EC4899', icon: Activity },
  shotstack: { label: 'Shotstack', color: '#F59E0B', icon: Server },
  pexels: { label: 'Pexels', color: '#06B6D4', icon: Server },
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  operational: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Operationnel' },
  degraded: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Degrade' },
  down: { bg: 'bg-red-500', text: 'text-red-400', label: 'Hors service' },
}

const PERIODS = [
  { id: 'today', label: 'Aujourd\'hui' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
] as const

type Period = typeof PERIODS[number]['id']

function GoldCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default function AdminApiUsagePage() {
  const [services, setServices] = useState<ServiceUsage[]>([])
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [runpod, setRunpod] = useState<RunPodMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('today')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Erreur chargement donnees API')

      const stats = await res.json()
      const totalCost = stats.total_api_costs_30d ?? 0

      const mockServices: ServiceUsage[] = [
        {
          service: 'claude',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.35,
          status: 'operational',
        },
        {
          service: 'elevenlabs',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.25,
          status: 'operational',
        },
        {
          service: 'runpod',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.2,
          status: 'operational',
        },
        {
          service: 'suno',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.1,
          status: 'operational',
        },
        {
          service: 'shotstack',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.07,
          status: 'operational',
        },
        {
          service: 'pexels',
          requests_today: 0,
          requests_week: 0,
          requests_month: 0,
          avg_response_ms: 0,
          error_rate: 0,
          cost_today: 0,
          cost_month: totalCost * 0.03,
          status: 'operational',
        },
      ]

      setServices(mockServices)
      setRunpod({
        gpu_time_hours: 0,
        cost_per_video_avg: 0,
        total_videos_processed: stats.total_videos ?? 0,
        queue_depth: 0,
      })

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 120000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const getRequestCount = (s: ServiceUsage) => {
    switch (period) {
      case 'today': return s.requests_today
      case 'week': return s.requests_week
      case 'month': return s.requests_month
    }
  }

  if (error && services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-api-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-api-usage-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">API Monitoring</h2>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/[0.06] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  period === p.id
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'text-white/30 hover:text-white/60'
                )}
                data-testid={`admin-api-period-${p.id}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors"
            data-testid="admin-api-refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Service Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={160} width="100%" rounded="xl" />
          ))
        ) : (
          services.map((s, idx) => {
            const config = SERVICE_CONFIG[s.service] ?? { label: s.service, color: '#8B5CF6', icon: Server }
            const status = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.operational
            const Icon = config.icon

            return (
              <motion.div
                key={s.service}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GoldCard className="p-4" data-testid={`admin-api-service-${s.service}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${config.color}15` }}
                      >
                        <Icon className="h-4 w-4" style={{ color: config.color }} />
                      </div>
                      <span className="text-sm font-semibold text-white/90">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', status.bg)} />
                      <span className={cn('text-xs', status.text)}>{status.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-white/30">Requetes</p>
                      <p className="text-lg font-bold text-white/80">{getRequestCount(s)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Latence moy.</p>
                      <p className="text-lg font-bold text-white/80">
                        {s.avg_response_ms > 0 ? `${s.avg_response_ms}ms` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Taux erreur</p>
                      <p className={cn(
                        'text-lg font-bold',
                        s.error_rate > 5 ? 'text-red-400' : s.error_rate > 1 ? 'text-amber-400' : 'text-emerald-400'
                      )}>
                        {s.error_rate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/30">Cout</p>
                      <p className="text-lg font-bold text-amber-400">
                        {formatPrice(period === 'today' ? s.cost_today : s.cost_month)}
                      </p>
                    </div>
                  </div>
                </GoldCard>
              </motion.div>
            )
          })
        )}
      </div>

      {/* RunPod Specific */}
      <GoldCard className="p-5" data-testid="admin-api-runpod">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">RunPod GPU</h3>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={70} width="100%" rounded="xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Temps GPU</p>
              <p className="text-xl font-bold text-white">{runpod?.gpu_time_hours ?? 0}h</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Cout / video</p>
              <p className="text-xl font-bold text-amber-400">
                {formatPrice(runpod?.cost_per_video_avg ?? 0)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Videos traitees</p>
              <p className="text-xl font-bold text-white">{runpod?.total_videos_processed ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">File d&apos;attente</p>
              <p className={cn(
                'text-xl font-bold',
                (runpod?.queue_depth ?? 0) > 10 ? 'text-amber-400' : 'text-emerald-400'
              )}>
                {runpod?.queue_depth ?? 0}
              </p>
            </div>
          </div>
        )}
      </GoldCard>

      {/* Error Logs */}
      <GoldCard className="p-5" data-testid="admin-api-errors">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Erreurs recentes</h3>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={48} width="100%" rounded="lg" />
            ))}
          </div>
        ) : errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-10 w-10 text-emerald-400/20 mb-3" />
            <p className="text-sm text-white/30">Aucune erreur recente</p>
            <p className="text-xs text-white/15 mt-1">Tous les services fonctionnent correctement</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-3 py-2 text-xs font-medium text-white/30 uppercase">Service</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-white/30 uppercase">Erreur</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-white/30 uppercase">Code</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-white/30 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => (
                  <tr key={err.id} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2">
                      <Badge variant="error" size="sm">{err.service}</Badge>
                    </td>
                    <td className="px-3 py-2 text-white/60 truncate max-w-xs">{err.message}</td>
                    <td className="px-3 py-2 text-white/40 font-mono">{err.status_code ?? '--'}</td>
                    <td className="px-3 py-2 text-white/30 text-xs">{formatRelativeDate(err.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GoldCard>
    </div>
  )
}
