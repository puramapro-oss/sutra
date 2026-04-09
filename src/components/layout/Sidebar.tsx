'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Plus,
  Film,
  Share2,
  Bot,
  Mic,
  Copy,
  Palette,
  Layers,
  Users,
  Trophy,
  Wallet,
  BarChart3,
  TrendingUp,
  Settings,
  Crown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Clapperboard,
  Handshake,
  ListVideo,
  Sparkles,
  Gift,
  ShoppingBag,
  Medal,
  Heart,
  Ticket,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  testId: string
}

const mainNav: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    testId: 'sidebar-dashboard',
  },
  { label: 'Creer', href: '/create', icon: Plus, testId: 'sidebar-create' },
  { label: 'Production', href: '/production', icon: Clapperboard, testId: 'sidebar-production' },
  { label: 'Batch', href: '/batch', icon: ListVideo, testId: 'sidebar-batch' },
  {
    label: 'Bibliotheque',
    href: '/library',
    icon: Film,
    testId: 'sidebar-library',
  },
{
    label: 'Publier',
    href: '/publish',
    icon: Share2,
    testId: 'sidebar-publish',
  },
  {
    label: 'Autopilot',
    href: '/autopilot',
    icon: Bot,
    testId: 'sidebar-autopilot',
  },
  {
    label: 'Mode Auto',
    href: '/auto',
    icon: Sparkles,
    testId: 'sidebar-auto',
  },
  { label: 'Voix', href: '/voices', icon: Mic, testId: 'sidebar-voices' },
  {
    label: 'Templates',
    href: '/templates',
    icon: Copy,
    testId: 'sidebar-templates',
  },
  {
    label: 'Styles',
    href: '/styles',
    icon: Palette,
    testId: 'sidebar-styles',
  },
  {
    label: 'Storyboard',
    href: '/storyboard',
    icon: Layers,
    testId: 'sidebar-storyboard',
  },
  {
    label: 'Parrainage',
    href: '/referral',
    icon: Users,
    testId: 'sidebar-referral',
  },
  {
    label: 'Partenariat',
    href: '/dashboard/partenaire',
    icon: Handshake,
    testId: 'sidebar-partner',
  },
  {
    label: 'Concours',
    href: '/contest',
    icon: Trophy,
    testId: 'sidebar-contest',
  },
  {
    label: 'Classement',
    href: '/classement',
    icon: BarChart3,
    testId: 'sidebar-classement',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: TrendingUp,
    testId: 'sidebar-analytics',
  },
  {
    label: 'Wallet',
    href: '/wallet',
    icon: Wallet,
    testId: 'sidebar-wallet',
  },
  {
    label: 'Boutique',
    href: '/boutique',
    icon: ShoppingBag,
    testId: 'sidebar-boutique',
  },
  {
    label: 'Achievements',
    href: '/achievements',
    icon: Medal,
    testId: 'sidebar-achievements',
  },
  {
    label: 'Communaute',
    href: '/community',
    icon: Heart,
    testId: 'sidebar-community',
  },
  {
    label: 'Tirage',
    href: '/lottery',
    icon: Ticket,
    testId: 'sidebar-lottery',
  },
  {
    label: 'Parametres',
    href: '/settings',
    icon: Settings,
    testId: 'sidebar-settings',
  },
  {
    label: 'Guide',
    href: '/guide',
    icon: BookOpen,
    testId: 'sidebar-guide',
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isSuperAdmin } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col h-dvh sticky top-0 bg-white/[0.02] backdrop-blur-xl border-r border-white/[0.06] z-40 select-none"
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/[0.06] shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shrink-0">
            <span className="font-display text-xs font-bold text-white">S</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-display text-lg font-bold tracking-wider bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent overflow-hidden whitespace-nowrap"
              >
                SUTRA
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="text-white/30 hover:text-white/60 transition-colors p-1 rounded-md hover:bg-white/5"
          data-testid="sidebar-toggle"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {mainNav.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.testId}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-violet-600/15 border border-violet-500/20 rounded-xl"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icon
                className={cn(
                  'w-[18px] h-[18px] shrink-0 relative z-10 transition-colors',
                  active ? 'text-violet-400' : 'text-white/40 group-hover:text-white/60'
                )}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative z-10 overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Admin section */}
      {isSuperAdmin && (
        <div className="px-2 pb-2 border-t border-white/[0.06] pt-2 shrink-0">
          <Link
            href="/admin"
            data-testid="sidebar-admin"
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
              pathname?.startsWith('/admin')
                ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                : 'text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/5'
            )}
          >
            <Crown className="w-[18px] h-[18px] shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Command Center
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
      )}
    </motion.aside>
  )
}
