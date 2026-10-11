'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import type { UserNotification } from '@/types'
import { toast } from 'sonner'

const supabase = createClient()

export default function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const userIdRef = useRef(user?.id)

  const fetchNotifications = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      if (userIdRef.current !== uid) return
      setNotifications((data as UserNotification[]) ?? [])
    } catch {
      if (userIdRef.current === uid) setLoadError(true)
    } finally {
      if (userIdRef.current === uid) setLoading(false)
    }
  }, [])

  useEffect(() => {
    userIdRef.current = user?.id
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setNotifications([])
      if (user?.id) void fetchNotifications()
    })
    return () => { active = false; userIdRef.current = undefined }
  }, [user?.id, fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAsRead = async (id: string) => {
    if (!user) return
    const { data, error } = await supabase.from('user_notifications').update({ read: true }).eq('id', id).eq('user_id', user.id).select('id').maybeSingle()
    if (error || !data) { toast.error('La notification n’a pas pu être mise à jour.'); return }
    if (userIdRef.current !== user.id) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = async () => {
    if (!user) return
    const { error } = await supabase
      .from('user_notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    if (error) { toast.error('Les notifications n’ont pas pu être mises à jour.'); return }
    if (userIdRef.current !== user.id) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const typeColors: Record<string, string> = {
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    achievement: 'bg-violet-500',
    referral: 'bg-pink-500',
    payment: 'bg-emerald-500',
    contest: 'bg-amber-500',
    system: 'bg-gray-500',
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-white/65 hover:text-white hover:bg-white/5 transition-colors"
        data-testid="notification-bell"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} non lues` : ''}`}
        aria-expanded={open}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-20 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 rounded-xl bg-[#0f0e1a]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  data-testid="mark-all-read"
                >
                  <Check className="w-3 h-3" />
                  Tout lire
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {loadError ? <p role="alert" className="p-4 text-sm text-amber-200">Notifications indisponibles. <button type="button" className="underline" onClick={fetchNotifications}>Réessayer</button></p> : loading && notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-sm text-white/30">Aucune notification</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0',
                      !notif.read && 'bg-violet-500/[0.03]'
                    )}
                  >
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full mt-1.5 shrink-0',
                          notif.read
                            ? 'bg-white/10'
                            : typeColors[notif.type] ?? 'bg-violet-500'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm truncate',
                            notif.read ? 'text-white/50' : 'text-white/80 font-medium'
                          )}
                        >
                          {notif.title}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-white/20 mt-1">
                          {formatRelativeDate(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06]">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Voir toutes les notifications
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
