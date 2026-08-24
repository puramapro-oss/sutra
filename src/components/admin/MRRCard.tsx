import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { Skeleton } from '@/components/ui/Skeleton'
import { GoldCard } from '@/components/admin/AdminComponents'
import { cn, formatPrice } from '@/lib/utils'

export interface MRRCardProps {
  mrr: number | null
  margin: string
  marginAlert: boolean
  totalApiCosts: number
  loading: boolean
}

export function MRRCard({ mrr, margin, marginAlert, totalApiCosts, loading }: MRRCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <GoldCard glow className="p-8 text-center" data-testid="admin-mrr-card">
        <p className="text-sm font-medium text-amber-400/60 uppercase tracking-widest mb-2">
          Monthly Recurring Revenue
        </p>
        {loading ? (
          <Skeleton height={56} width={240} rounded="lg" className="mx-auto mb-3" />
        ) : (
          <div className="mb-3">
            <AnimatedCounter
              value={mrr ?? 0}
              prefix=""
              suffix=" EUR"
              decimals={2}
              className="text-5xl md:text-6xl font-bold text-amber-400"
              data-testid="admin-mrr-value"
            />
          </div>
        )}
        <div className="flex items-center justify-center gap-6 text-sm text-white/40">
          <span>
            Marge :{' '}
            <span className={cn('font-semibold', marginAlert ? 'text-red-400' : 'text-emerald-400')}>
              {loading ? '...' : `${margin}%`}
            </span>
            {marginAlert && !loading && <AlertTriangle className="inline h-3.5 w-3.5 text-red-400 ml-1" />}
          </span>
          <span className="w-px h-4 bg-white/10" />
          <span>
            Couts API :{' '}
            <span className="font-semibold text-white/60">{loading ? '...' : formatPrice(totalApiCosts)}</span>
          </span>
        </div>
      </GoldCard>
    </motion.div>
  )
}
