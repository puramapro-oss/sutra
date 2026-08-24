'use client'

import { Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface HallOfFameEntry {
  id: string
  name: string
  totalPrize: number
  wins: number
}

interface HallOfFameProps {
  entries: HallOfFameEntry[]
}

export default function HallOfFame({ entries }: HallOfFameProps) {
  if (entries.length === 0) return null

  return (
    <Card data-testid="hall-of-fame">
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Hall of Fame</h2>
        </div>
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02]"
            >
              <span className={cn(
                'text-lg font-bold',
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/20'
              )}>
                #{i + 1}
              </span>
              <span className="flex-1 text-sm text-white/70">{entry.name}</span>
              <div className="text-right">
                <p className="text-sm font-medium text-emerald-400">{formatPrice(entry.totalPrize)}</p>
                <p className="text-[10px] text-white/30">
                  {entry.wins} victoire{entry.wins > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
