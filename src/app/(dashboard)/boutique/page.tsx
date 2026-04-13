'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Coins, Tag, Ticket, Zap, Wallet, Loader2, Star, Gift } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPrice } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import Button from '@/components/ui/Button'

interface ShopItem {
  id: string
  category: string
  name: string
  description: string
  cost_points: number
  value: Record<string, unknown>
  sort_order: number
}

interface PointsData {
  balance: number
  lifetime_earned: number
}

const categoryIcons: Record<string, React.ElementType> = {
  reduction: Tag,
  subscription: Star,
  ticket: Ticket,
  feature: Zap,
  cash: Wallet,
}

const categoryLabels: Record<string, string> = {
  reduction: 'Reductions',
  subscription: 'Abonnements',
  ticket: 'Tickets',
  feature: 'Bonus',
  cash: 'Convertir',
}

export default function BoutiquePage() {
  const { profile, loading: authLoading } = useAuth()
  const [items, setItems] = useState<ShopItem[]>([])
  const [points, setPoints] = useState<PointsData>({ balance: 0, lifetime_earned: 0 })
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [dailyGift, setDailyGift] = useState<{ canOpen: boolean; streakCount: number } | null>(null)
  const [openingGift, setOpeningGift] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [boutiqueRes, pointsRes, giftRes] = await Promise.all([
        fetch('/api/boutique'),
        fetch('/api/points'),
        fetch('/api/daily-gift'),
      ])
      if (boutiqueRes.ok) {
        const data = await boutiqueRes.json()
        setItems(data.items || [])
      }
      if (pointsRes.ok) {
        const data = await pointsRes.json()
        setPoints({ balance: data.balance, lifetime_earned: data.lifetime_earned })
      }
      if (giftRes.ok) {
        const data = await giftRes.json()
        setDailyGift(data)
      }
    } catch {
      // defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

  const handlePurchase = async (itemId: string) => {
    setPurchasing(itemId)
    try {
      const res = await fetch('/api/boutique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'achat')
        return
      }
      toast.success(`${data.item?.name || 'Article'} achete !`)
      setPoints(prev => ({ ...prev, balance: data.newBalance ?? prev.balance - (items.find(i => i.id === itemId)?.cost_points || 0) }))
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setPurchasing(null)
    }
  }

  const handleOpenGift = async () => {
    setOpeningGift(true)
    try {
      const res = await fetch('/api/daily-gift', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Impossible d\'ouvrir le coffre')
        return
      }
      const giftMessages: Record<string, string> = {
        points_small: `+${data.gift?.gift_value?.amount || 0} points !`,
        points_large: `+${data.gift?.gift_value?.amount || 0} points !`,
        coupon_small: `Coupon -${data.gift?.gift_value?.discount_percent || 0}% obtenu !`,
        coupon_large: `Coupon -${data.gift?.gift_value?.discount_percent || 0}% obtenu !`,
        mega_coupon: `MEGA COUPON -${data.gift?.gift_value?.discount_percent || 0}% !`,
        ticket: '1 ticket tirage obtenu !',
        credits: '+3 credits video !',
      }
      toast.success(giftMessages[data.gift?.gift_type] || 'Cadeau ouvert !')
      setDailyGift({ canOpen: false, streakCount: data.gift?.streak_count || 0 })
      fetchData()
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setOpeningGift(false)
    }
  }

  const categories = [...new Set(items.map(i => i.category))]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShoppingBag className="w-7 h-7 text-violet-400" />
            Boutique
          </h1>
          <p className="text-white/50 mt-1">Echange tes points contre des recompenses</p>
        </div>
        <div className="glass rounded-2xl px-6 py-3 flex items-center gap-3">
          <Coins className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-2xl font-bold text-white">
              <AnimatedCounter value={points.balance} />
            </div>
            <div className="text-xs text-white/40">points disponibles</div>
          </div>
        </div>
      </div>

      {/* Daily Gift — Animated Chest */}
      {dailyGift && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative glass rounded-2xl p-6 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-violet-500/5 overflow-hidden"
        >
          {/* Glow effect behind chest */}
          {dailyGift.canOpen && (
            <div className="absolute top-1/2 left-8 -translate-y-1/2 w-24 h-24 rounded-full bg-amber-500/20 blur-2xl animate-pulse pointer-events-none" />
          )}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={dailyGift.canOpen ? {
                  rotate: [-2, 2, -2],
                  scale: [1, 1.05, 1],
                } : {}}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                  dailyGift.canOpen
                    ? "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-amber-500/30"
                    : "bg-gradient-to-br from-white/10 to-white/5"
                )}
              >
                <Gift className={cn("w-8 h-8", dailyGift.canOpen ? "text-white" : "text-white/40")} />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-white">Coffre Quotidien</h3>
                <p className="text-white/50 text-sm">
                  {dailyGift.canOpen
                    ? 'Ton cadeau du jour t\'attend !'
                    : `Reviens demain ! Serie : ${dailyGift.streakCount} jours`}
                </p>
                {dailyGift.streakCount >= 7 && (
                  <div className="flex items-center gap-1.5 text-amber-400/80 text-xs mt-1">
                    <Zap className="w-3 h-3" />
                    Serie {dailyGift.streakCount}j — bonus garanti
                  </div>
                )}
              </div>
            </div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleOpenGift}
                disabled={!dailyGift.canOpen || openingGift}
                className={cn(
                  'px-6 min-w-[100px]',
                  dailyGift.canOpen
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                {openingGift ? <Loader2 className="w-4 h-4 animate-spin" /> : dailyGift.canOpen ? 'Ouvrir ✨' : 'Ouvert'}
              </Button>
            </motion.div>
          </div>
          {/* Streak progress dots */}
          {dailyGift.streakCount > 0 && dailyGift.streakCount < 7 && (
            <div className="mt-4 flex items-center gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    i < dailyGift.streakCount ? "bg-amber-400" : "bg-white/10"
                  )}
                />
              ))}
              <span className="text-[10px] text-white/30 ml-1">{dailyGift.streakCount}/7</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Shop Items by Category */}
      {categories.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Boutique vide" description="Les articles arrivent bientot" />
      ) : (
        categories.map(cat => {
          const CatIcon = categoryIcons[cat] || ShoppingBag
          const catItems = items.filter(i => i.category === cat)

          return (
            <div key={cat} className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <CatIcon className="w-5 h-5 text-violet-400" />
                {categoryLabels[cat] || cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catItems.map((item, idx) => {
                  const canAfford = points.balance >= item.cost_points
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
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
                              onClick={() => handlePurchase(item.id)}
                              disabled={!canAfford || purchasing === item.id}
                              className={cn(
                                !canAfford && 'opacity-40 cursor-not-allowed'
                              )}
                            >
                              {purchasing === item.id ? (
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
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
