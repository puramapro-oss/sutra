'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Activity, AlertTriangle, Cpu, Zap, Server, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatPrice } from '@/lib/utils'
import GoldCard from '@/components/admin/GoldCard'

interface ServiceUsage { service: string; recordedCost30d: number | null }

const SVC: Record<string, { label: string; color: string; icon: typeof Cpu }> = {
  claude: { label: 'Claude AI', color: '#8B5CF6', icon: Zap },
  elevenlabs: { label: 'ElevenLabs', color: '#3B82F6', icon: Activity },
  runpod: { label: 'RunPod', color: '#10B981', icon: Cpu },
  suno: { label: 'Suno', color: '#EC4899', icon: Activity },
  shotstack: { label: 'Shotstack', color: '#F59E0B', icon: Server },
  pexels: { label: 'Pexels', color: '#06B6D4', icon: Server },
}

export default function AdminApiUsagePage() {
  const [services, setServices] = useState<ServiceUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const dataRequest = useRef<AbortController | null>(null)
  const fetchData = useCallback(() => {
    dataRequest.current?.abort()
    const controller = new AbortController()
    dataRequest.current = controller
    const active = () => dataRequest.current === controller && !controller.signal.aborted
    const commit = (write: () => void) => { if (active()) write() }
    return fetch('/api/admin/stats?type=service_costs', { signal: controller.signal }).then(async (res) => {
      if (!active()) return
      if (!res.ok) throw new Error('Impossible de charger les coûts enregistrés')
      const data = await res.json()
      if (!data.services || typeof data.services !== 'object' || Array.isArray(data.services)) {
        throw new Error('Coûts indisponibles')
      }
      const costs = data.services as Record<string, unknown>
      const names = [...new Set([...Object.keys(SVC), ...Object.keys(costs)])]
      commit(() => setServices(names.map(service => {
        const cost = costs[service]
        return { service, recordedCost30d: typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null }
      })))
      commit(() => setError(null))
    }).catch(err => {
      if (!active()) return
      commit(() => setServices([]))
      commit(() => setError(err instanceof Error ? err.message : 'Erreur inconnue'))
    }).finally(() => {
      commit(() => setLoading(false))
      commit(() => setRefreshing(false))
      if (dataRequest.current === controller) dataRequest.current = null
    })
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 120000)
    return () => { clearInterval(interval); dataRequest.current?.abort(); dataRequest.current = null }
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Mesures indisponibles</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button onClick={handleRefresh} disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 disabled:opacity-50"
          data-testid="admin-api-retry">
          {refreshing ? 'Chargement…' : 'Réessayer'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-api-usage-page">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Utilisation des API</h2>
          <p className="text-xs text-white/50 mt-1">Coûts enregistrés — 30 derniers jours</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} aria-label="Actualiser les coûts enregistrés"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-amber-400 disabled:opacity-50"
          data-testid="admin-api-refresh">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Actualiser
        </button>
      </div>

      <div role="status" className="rounded-xl border border-white/20 bg-white/5 p-4 text-sm text-white/70" data-testid="admin-api-metrics-unavailable">
        Seules les estimations de coût présentes dans le journal des API sont disponibles ici.
        Une valeur absente ne permet de conclure ni à une absence d&apos;usage ni au bon fonctionnement d&apos;un service.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={190} width="100%" rounded="xl" />) : services.map((service, idx) => {
          const config = Object.hasOwn(SVC, service.service) ? SVC[service.service] : { label: service.service, color: '#8B5CF6', icon: Server }
          const Icon = config.icon
          return (
            <motion.div key={service.service} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <GoldCard className="p-4" data-testid={`admin-api-service-${service.service}`}>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" style={{ color: config.color }} />
                    <span className="text-sm font-semibold text-white/90">{config.label}</span>
                  </div>
                  <span className="text-xs text-white/50">État non vérifié</span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-white/40">Requêtes</dt><dd className="text-white/60">Non disponible</dd></div>
                  <div><dt className="text-white/40">Latence moyenne</dt><dd className="text-white/60">Non disponible</dd></div>
                  <div><dt className="text-white/40">Taux d&apos;erreur</dt><dd className="text-white/60">Non disponible</dd></div>
                  <div><dt className="text-white/40">Coût estimé sur 30 j</dt><dd className={service.recordedCost30d === null ? 'text-white/60' : 'text-amber-400'}>
                    {service.recordedCost30d === null ? 'Non disponible' : formatPrice(service.recordedCost30d)}
                  </dd></div>
                </dl>
              </GoldCard>
            </motion.div>
          )
        })}
      </div>

      <GoldCard className="p-5" data-testid="admin-api-runpod">
        <h3 className="text-sm font-semibold text-amber-400 mb-4">RunPod GPU</h3>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {['Temps GPU', 'Coût par vidéo', 'Vidéos traitées', 'File d’attente'].map(label => (
            <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <dt className="text-white/40 mb-1">{label}</dt><dd className="text-white/60">Non disponible</dd>
            </div>
          ))}
        </dl>
      </GoldCard>

      <GoldCard className="p-5" data-testid="admin-api-errors">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Erreurs récentes</h3>
        <p className="text-sm text-white/60">Le journal des erreurs n&apos;est pas disponible dans cette vue. L&apos;absence de liste ne confirme pas l&apos;absence d&apos;erreurs.</p>
      </GoldCard>
    </div>
  )
}
