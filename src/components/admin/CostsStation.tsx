import { Cpu } from 'lucide-react'
import { GoldCard, StationHeader } from '@/components/admin/AdminComponents'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatPrice } from '@/lib/utils'

const SERVICE_COSTS = [
  { name: 'Claude AI', key: 'claude', color: 'bg-violet-500' },
  { name: 'ElevenLabs', key: 'elevenlabs', color: 'bg-blue-500' },
  { name: 'RunPod', key: 'runpod', color: 'bg-emerald-500' },
  { name: 'Suno', key: 'suno', color: 'bg-pink-500' },
  { name: 'Shotstack', key: 'shotstack', color: 'bg-amber-500' },
]

export interface CostsStationProps {
  serviceCosts: Record<string, number> | null
  totalApiCosts: number
  margin: string
  marginNumber: number
  marginAlert: boolean
  loading: boolean
}

export function CostsStation({
  serviceCosts,
  totalApiCosts,
  margin,
  marginNumber,
  marginAlert,
  loading,
}: CostsStationProps) {
  return (
    <GoldCard className="p-5" data-testid="admin-costs-station">
      <StationHeader title="Station Couts API" icon={Cpu} />
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={44} width="100%" rounded="lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {SERVICE_COSTS.map((service) => {
            const realCost = serviceCosts?.[service.key]
            const estimatedCost = realCost !== undefined ? realCost : totalApiCosts / SERVICE_COSTS.length
            return (
              <div
                key={service.key}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('h-2.5 w-2.5 rounded-full', service.color)} />
                  <span className="text-sm text-white/70">{service.name}</span>
                </div>
                <span className="text-sm font-semibold text-white/80">{formatPrice(estimatedCost)}</span>
              </div>
            )
          })}

          <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-400">Total couts 30j</span>
              <span className="text-lg font-bold text-amber-400">{formatPrice(totalApiCosts)}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  marginAlert ? 'bg-red-500' : 'bg-emerald-500'
                )}
                style={{ width: `${Math.min(100, 100 - marginNumber)}%` }}
              />
            </div>
            <p className="text-xs text-white/30 mt-1">
              {marginAlert ? 'Marge inferieure a 30% — attention' : `Marge saine : ${margin}%`}
            </p>
          </div>
        </div>
      )}
    </GoldCard>
  )
}
