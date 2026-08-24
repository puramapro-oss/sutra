import { Users } from 'lucide-react'
import { GoldCard, StationHeader } from '@/components/admin/AdminComponents'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatPrice } from '@/lib/utils'

export interface ReferralStationProps {
  commissionsPaid: number
  commissionsPending: number
  topPartners: { code: string; referrals: number; commissions: number }[]
  loading: boolean
}

export function ReferralStation({
  commissionsPaid,
  commissionsPending,
  topPartners,
  loading,
}: ReferralStationProps) {
  return (
    <GoldCard className="p-5" data-testid="admin-referral-station">
      <StationHeader title="Station Parrainage" icon={Users} />
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={60} width="100%" rounded="lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Commissions payees</p>
            <p className="text-xl font-bold text-emerald-400">{formatPrice(commissionsPaid)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Commissions en attente</p>
            <p className="text-xl font-bold text-amber-400">{formatPrice(commissionsPending)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 col-span-1 sm:col-span-2">
            <p className="text-xs text-white/40 mb-2">Top 5 parrains</p>
            {topPartners.length === 0 ? (
              <p className="text-sm text-white/20">Aucun parrain pour le moment</p>
            ) : (
              <ul className="space-y-1.5">
                {topPartners.map((p, i) => (
                  <li key={p.code} className="flex items-center justify-between text-xs">
                    <span className="text-white/60">
                      <span className="text-amber-400 font-semibold mr-2">#{i + 1}</span>
                      <code className="text-white/80">{p.code}</code>
                      <span className="text-white/30 ml-2">· {p.referrals} filleuls</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">{formatPrice(p.commissions)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </GoldCard>
  )
}
