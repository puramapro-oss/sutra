'use client'

import { motion } from 'framer-motion'
import { Coins, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface ShopItemCardProps {
  item: {
    id: string
    name: string
    description: string
    cost_points: number
  }
  balance: number
  purchasing: boolean
  onPurchase: (itemId: string) => void
  delay: number
}

export default function ShopItemCard({ item, balance, purchasing, onPurchase, delay }: ShopItemCardProps) {
  const canAfford = balance >= item.cost_points

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="glass hover:border-violet-500/30 transition-all h-full">
        <CardContent className="p-5 flex flex-col h-full">
          <h3 className="font-semibold text-white">{item.name}</h3>
          <p className="text-sm text-white/50 mt-1 flex-1">{item.description}</p>
          <div className="flex items-center justify-between mt-4">
            <Badge variant={canAfford ? 'default' : 'warning'} className="flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {item.cost_points.toLocaleString('fr-FR')} pts
            </Badge>
            <Button
              size="sm"
              onClick={() => onPurchase(item.id)}
              disabled={!canAfford || purchasing}
              className={cn(
                !canAfford && 'opacity-40 cursor-not-allowed'
              )}
            >
              {purchasing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : canAfford ? (
                'Acheter'
              ) : (
                'Insuffisant'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
