'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'

interface ReferralTiersProps {
  activeFilleuls: number
}

export default function ReferralTiers({ activeFilleuls }: ReferralTiersProps) {
  const tiers = [
    { name: 'Bronze', min: 5, color: 'from-amber-700 to-amber-900', icon: '🥉' },
    { name: 'Argent', min: 10, color: 'from-gray-400 to-gray-600', icon: '🥈' },
    { name: 'Or', min: 25, color: 'from-amber-400 to-amber-600', icon: '🥇' },
    { name: 'Platine', min: 50, color: 'from-cyan-400 to-blue-600', icon: '💎' },
    { name: 'Diamant', min: 75, color: 'from-violet-400 to-purple-600', icon: '👑' },
    { name: 'Legende', min: 100, color: 'from-pink-400 to-rose-600', icon: '🔥' },
  ]

  return (
    <Card>
      <CardContent>
        <h2 className="text-sm font-semibold text-white/60 mb-4">Tes paliers de parrainage</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {tiers.map((tier) => {
            const reached = activeFilleuls >= tier.min
            return (
              <div
                key={tier.name}
                className={cn(
                  'relative rounded-xl p-3 text-center border transition-all',
                  reached
                    ? 'border-white/20 bg-gradient-to-br opacity-100'
                    : 'border-white/[0.04] bg-white/[0.02] opacity-50'
                )}
              >
                <div className="text-2xl mb-1">{tier.icon}</div>
                <p className={cn('text-xs font-bold', reached ? 'text-white' : 'text-white/40')}>{tier.name}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{tier.min} filleuls</p>
                {reached && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 bg-white/[0.04] rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (activeFilleuls / 100) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full"
            />
          </div>
          <span className="text-xs text-white/30 shrink-0">{activeFilleuls}/100</span>
        </div>
      </CardContent>
    </Card>
  )
}
