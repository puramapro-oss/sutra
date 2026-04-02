'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  Trophy,
  Gift,
  CreditCard,
  Star,
  Settings,
  Check,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatRelativeDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import type { UserNotification } from '@/types'

const supabase = createClient()

const NOTIFICATION_ICONS: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  achievement: { icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  referral: { icon: Gift, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  payment: { icon: CreditCard, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  contest: { icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  system: { icon: Settings, color: 'text-white/50', bg: 'bg-white/5 border-white/[0.08]' },
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'Toutes' },
  { id: 'success', label: 'Succes' },
  { id: 'info', label: 'Info' },
  { id: 'warning', label: 'Alertes' },
  { id: 'payment', label: 'Paiements' },
  { id: 'referral', label: 'Parrainage' },
  { id: 'contest', label: 'Concours' },
  { id: 'achievement', label: 'Succes' },
] as const

export default function NotificationsPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setNotifications(data as UserNotification[])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchNotifications()
  }, [authLoading, profile?.id, fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    const notif = notifications.find((n) => n.id === id)
    if (!notif || notif.read) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )

    await supabase
      .from('user_notifications')
      .update({ read: true })
      .eq('id', id)
  }, [notifications])

  const markAllAsRead = useCallback(async () => {
    if (!profile) return
    setMarkingAll(true)
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ read: true })
        .eq('user_id', profile.id)
        .eq('read', false)

      if (error) throw error
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success('Toutes les notifications marquees comme lues')
    } catch {
      toast.error('Erreur')
    } finally {
      setMarkingAll(false)
    }
  }, [profile])

  const handleClick = useCallback(
    (notif: UserNotification) => {
      markAsRead(notif.id)
      // Notifications can link to specific pages
      // In production, notif would have a 'link' field
    },
    [markAsRead]
  )

  const filteredNotifications = notifications.filter((n) =>
    filter === 'all' || n.type === filter
  )

  const unreadCount = notifications.filter((n) => !n.read).length

  const notifsSkeleton = (
    <div className="space-y-4" data-testid="notifications-loading">
      <div className="flex items-center justify-between">
        <Skeleton width={200} height={32} rounded="lg" />
        <Skeleton width={150} height={36} rounded="lg" />
      </div>
      <Skeleton width="100%" height={48} rounded="lg" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={80} rounded="xl" />
      ))}
    </div>
  )

  if (authLoading) return notifsSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchNotifications} skeleton={notifsSkeleton}>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white" data-testid="notifications-title">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <Badge variant="premium" data-testid="notifications-unread-count">
              {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllAsRead}
            loading={markingAll}
            data-testid="notifications-mark-all"
          >
            <Check className="h-3.5 w-3.5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="notifications-filters">
        <Filter className="h-4 w-4 text-white/30 shrink-0" />
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.id
                ? 'bg-violet-500/20 text-violet-400'
                : 'bg-white/[0.02] text-white/40 hover:text-white/60'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === 'all' ? 'Aucune notification' : 'Aucune notification de ce type'}
          description={
            filter === 'all'
              ? 'Tu recevras des notifications ici quand il y aura de l\'activite.'
              : 'Essaie un autre filtre pour voir d\'autres notifications.'
          }
          data-testid="notifications-empty"
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((notif, i) => {
              const config = NOTIFICATION_ICONS[notif.type] ?? NOTIFICATION_ICONS.info
              const Icon = config.icon

              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                >
                  <button
                    onClick={() => handleClick(notif)}
                    data-testid={`notification-${notif.id}`}
                    className={cn(
                      'w-full text-left rounded-xl border transition-all',
                      notif.read
                        ? 'bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]'
                        : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      {/* Icon */}
                      <div
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5',
                          config.bg
                        )}
                      >
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              'text-sm font-medium truncate',
                              notif.read ? 'text-white/50' : 'text-white'
                            )}
                          >
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <div className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                          )}
                        </div>
                        <p
                          className={cn(
                            'text-xs mt-0.5 line-clamp-2',
                            notif.read ? 'text-white/25' : 'text-white/40'
                          )}
                        >
                          {notif.message}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-white/20 whitespace-nowrap shrink-0 mt-1">
                        {formatRelativeDate(notif.created_at)}
                      </span>
                    </div>
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
    </LoadingTimeout>
  )
}
