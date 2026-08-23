'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingBag, Coins, Tag, Ticket, Zap, Wallet, Star } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import DailyGiftChest from '@/components/boutique/DailyGiftChest'
import ShopItemCard from '@/components/boutique/ShopItemCard'

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

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
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
        <DailyGiftChest
          canOpen={dailyGift.canOpen}
          streakCount={dailyGift.streakCount}
          onOpen={handleOpenGift}
          opening={openingGift}
        />
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
                {catItems.map((item, idx) => (
                  <ShopItemCard
                    key={item.id}
                    item={item}
                    balance={points.balance}
                    purchasing={purchasing === item.id}
                    onPurchase={handlePurchase}
                    delay={idx * 0.05}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
