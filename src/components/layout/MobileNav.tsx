'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LayoutDashboard, Plus, Film, Gift, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard, testId: 'mobile-dashboard' },
  { label: 'Creer', href: '/create', icon: Plus, testId: 'mobile-create' },
  { label: 'Videos', href: '/library', icon: Film, testId: 'mobile-library' },
  { label: 'Parrainage', href: '/referral', icon: Gift, testId: 'mobile-referral' },
  { label: 'Profil', href: '/profile', icon: User, testId: 'mobile-profile' },
]

export default function MobileNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname?.startsWith(href) ?? false
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#06050e]/90 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="mobile-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.testId}
              href={item.href}
              data-testid={item.testId}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
            >
              {active && (
                <motion.div
                  layoutId="mobile-active"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-violet-500 rounded-full"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icon
                className={cn(
                  'w-5 h-5 transition-colors',
                  active ? 'text-violet-400' : 'text-white/35'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  active ? 'text-violet-400' : 'text-white/35'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
