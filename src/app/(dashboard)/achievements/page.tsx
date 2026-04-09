'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Medal, Lock, CheckCircle, Coins, Zap, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import Button from '@/components/ui/Button'

interface Achievement {
  id: string
  key: string
  name: string
  description: string
  icon: string
  xp_reward: number
  points_reward: number
  category: string
  unlocked: boolean
  unlocked_at?: string
}

const categoryLabels: Record<string, string> = {
  creation: 'Creation',
  publish: 'Publication',
  social: 'Social',
  engagement: 'Engagement',
  monetization: 'Monetisation',
}

export default function AchievementsPage() {
  const { profile, loading: authLoading } = useAuth()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [totalXP, setTotalXP] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/achievements')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAchievements(data.achievements || [])
      setTotalXP(data.totalXP || 0)
      setTotalPoints(data.totalPoints || 0)
    } catch {
      // defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

  const handleCheck = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkAll: true }),
      })
      const data = await res.json()
      if (data.newlyUnlocked?.length > 0) {
        data.newlyUnlocked.forEach((a: Achievement) => {
          toast.success(`${a.name} debloque ! +${a.xp_reward} XP +${a.points_reward} pts`)
        })
        fetchData()
      } else {
        toast('Aucun nouvel achievement debloque')
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setChecking(false)
    }
  }

  const unlocked = achievements.filter(a => a.unlocked)
  const locked = achievements.filter(a => !a.unlocked)
  const categories = [...new Set(achievements.map(a => a.category))]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Medal className="w-7 h-7 text-violet-400" />
            Achievements
          </h1>
          <p className="text-white/50 mt-1">
            {unlocked.length}/{achievements.length} debloques
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-lg font-bold text-white"><AnimatedCounter value={totalXP} /></span>
            <span className="text-xs text-white/40">XP</span>
          </div>
          <Button onClick={handleCheck} disabled={checking} size="sm">
            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Verifier
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm text-white/60 mb-2">
          <span>Progression</span>
          <span>{Math.round((unlocked.length / Math.max(achievements.length, 1)) * 100)}%</span>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unlocked.length / Math.max(achievements.length, 1)) * 100}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full"
          />
        </div>
      </div>

      {/* By Category */}
      {categories.map(cat => {
        const catAchievements = achievements.filter(a => a.category === cat)
        return (
          <div key={cat} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">
              {categoryLabels[cat] || cat}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catAchievements.map((a, idx) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={cn(
                    'glass transition-all',
                    a.unlocked ? 'border-violet-500/30 bg-violet-500/5' : 'opacity-60'
                  )}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                          a.unlocked
                            ? 'bg-gradient-to-br from-violet-600 to-purple-600'
                            : 'bg-white/5 border border-white/10'
                        )}>
                          {a.unlocked ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <Lock className="w-5 h-5 text-white/30" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className={cn('font-semibold', a.unlocked ? 'text-white' : 'text-white/50')}>
                            {a.name}
                          </h3>
                          <p className="text-sm text-white/40 mt-0.5">{a.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="info" className="text-xs flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {a.xp_reward} XP
                            </Badge>
                            <Badge variant="info" className="text-xs flex items-center gap-1">
                              <Coins className="w-3 h-3" /> {a.points_reward} pts
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
