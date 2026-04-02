'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Shield, BarChart3, Users, DollarSign, Activity, Heart, Settings, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const adminNavItems = [
  { href: '/admin', label: 'Mission Control', icon: BarChart3, id: 'overview' },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users, id: 'users' },
  { href: '/admin/finances', label: 'Finances', icon: DollarSign, id: 'finances' },
  { href: '/admin/api-usage', label: 'API Monitoring', icon: Activity, id: 'api-usage' },
  { href: '/admin/health', label: 'Services Health', icon: Heart, id: 'health' },
  { href: '/admin/config', label: 'Configuration', icon: Settings, id: 'config' },
  { href: '/admin/contest', label: 'Concours', icon: Trophy, id: 'contest' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSuperAdmin, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  useEffect(() => {
    if (!loading && !isSuperAdmin && mounted) {
      router.push('/dashboard')
    }
  }, [loading, isSuperAdmin, mounted, router])

  if (loading || !mounted) {
    return (
      <div className="space-y-6" data-testid="admin-loading">
        <Skeleton height={64} width="100%" rounded="xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={120} width="100%" rounded="xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
        data-testid="admin-access-denied"
      >
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <Shield className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Acces interdit</h1>
        <p className="text-white/50 max-w-md mb-6">
          Cette zone est reservee au super administrateur. Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez l&apos;equipe.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-3 rounded-xl bg-white/5 border border-white/[0.08] text-white/80 hover:bg-white/10 transition-colors"
        >
          Retour au dashboard
        </Link>
      </motion.div>
    )
  }

  return (
    <div data-testid="admin-section" className="space-y-6">
      {/* Gold Command Center Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] via-amber-600/[0.04] to-transparent backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(245,158,11,0.12),_transparent_60%)]" />
        <div className="relative flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/25">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-amber-400">Command Center</h1>
              <p className="text-xs text-amber-400/50">Super Admin &mdash; SUTRA</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400/70">Systeme operationnel</span>
          </div>
        </div>
      </motion.div>

      {/* Admin Sub-navigation */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
        {adminNavItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              data-testid={`admin-nav-${item.id}`}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200',
                'text-white/40 hover:text-amber-400/80 hover:bg-amber-500/[0.06]'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Page Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key="admin-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
