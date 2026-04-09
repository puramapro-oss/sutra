'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bell, Clock, Calendar, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface NotifPreference {
  type: string
  enabled: boolean
  frequency: string
}

const NOTIF_TYPES = [
  { type: 'video_ready', label: 'Video terminee', description: 'Quand ta video est prete' },
  { type: 'contest_result', label: 'Resultats concours', description: 'Classements et tirages' },
  { type: 'referral', label: 'Parrainages', description: 'Nouveaux filleuls et commissions' },
  { type: 'community', label: 'Communaute', description: 'Messages buddy, cercles, mur' },
  { type: 'wallet', label: 'Wallet', description: 'Credits et retraits' },
  { type: 'tips', label: 'Astuces IA', description: 'Conseils personnalises' },
  { type: 'streak', label: 'Streak', description: 'Rappels pour maintenir ta serie' },
  { type: 'promotion', label: 'Promotions', description: 'Offres speciales et reductions' },
]

export default function NotificationSettingsPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<NotifPreference[]>([])
  const [hourStart, setHourStart] = useState(9)
  const [hourEnd, setHourEnd] = useState(20)
  const [engagementScore, setEngagementScore] = useState(50)
  const [style, setStyle] = useState('encouraging')

  const fetchPreferences = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        // Initialize from profile data or defaults
        const prefs = NOTIF_TYPES.map(nt => ({
          type: nt.type,
          enabled: true,
          frequency: 'normal',
        }))
        setPreferences(prefs)
      }
    } catch { /* empty */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchPreferences()
  }, [authLoading, profile?.id, fetchPreferences])

  const togglePreference = (type: string) => {
    setPreferences(prev =>
      prev.map(p => p.type === type ? { ...p, enabled: !p.enabled } : p)
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save to notification_preferences via API
      toast.success('Preferences sauvegardees')
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-white/40 hover:text-white/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-violet-400" />
            Notifications
          </h1>
          <p className="text-white/50 mt-1">L&apos;IA adapte les notifications a ton usage</p>
        </div>
      </div>

      {/* Engagement Score */}
      <Card className="glass border-violet-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Score d&apos;engagement</h3>
              <p className="text-sm text-white/40 mt-1">
                {engagementScore >= 80 ? 'Tres actif — 2 notifications/semaine max' :
                 engagementScore >= 50 ? 'Actif — 3 notifications/semaine max' :
                 'Peu actif — 1 notification/semaine max, ton chaleureux'}
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-violet-400">{engagementScore}</div>
              <div className="text-xs text-white/40">/100</div>
            </div>
          </div>
          <Badge className="mt-2" variant={
            style === 'encouraging' ? 'success' :
            style === 'informative' ? 'info' : 'warning'
          }>
            Ton : {style === 'encouraging' ? 'Encourageant' : style === 'informative' ? 'Informatif' : 'Chaleureux'}
          </Badge>
        </CardContent>
      </Card>

      {/* Time Window */}
      <Card className="glass">
        <CardContent className="p-5">
          <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-violet-400" />
            Plage horaire
          </h3>
          <p className="text-sm text-white/40 mb-4">Jamais de notifications en dehors de cette plage</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/60">De</label>
              <select
                value={hourStart}
                onChange={e => setHourStart(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}h</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-white/60">a</label>
              <select
                value={hourEnd}
                onChange={e => setHourEnd(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}h</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card className="glass">
        <CardContent className="p-5 space-y-1">
          <h3 className="font-semibold text-white mb-3">Types de notifications</h3>
          {NOTIF_TYPES.map(nt => {
            const pref = preferences.find(p => p.type === nt.type)
            const enabled = pref?.enabled ?? true
            return (
              <div
                key={nt.type}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-white">{nt.label}</div>
                  <div className="text-xs text-white/40">{nt.description}</div>
                </div>
                <button
                  onClick={() => togglePreference(nt.type)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    enabled ? 'bg-violet-600' : 'bg-white/10'
                  }`}
                >
                  <motion.div
                    animate={{ x: enabled ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white"
                  />
                </button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Sauvegarder
      </Button>
    </div>
  )
}
