'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sparkles, Calendar, Tag, Brain, Film, Settings } from 'lucide-react'

const TABS = [
  { href: '/auto', label: 'Vue', icon: Sparkles, exact: true },
  { href: '/auto/schedules', label: 'Plannings', icon: Calendar },
  { href: '/auto/themes', label: 'Themes', icon: Tag },
  { href: '/auto/memory', label: 'Memoire', icon: Brain },
  { href: '/auto/videos', label: 'Videos', icon: Film },
  { href: '/auto/settings', label: 'Reglages', icon: Settings },
]

export default function AutoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white" data-testid="auto-title">Mode Autonome</h1>
        <p className="text-sm text-white/40 mt-1">
          SUTRA cree, edite et publie tes videos automatiquement.
        </p>
      </div>

      <nav className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/[0.06]">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-testid={`auto-tab-${tab.label.toLowerCase()}`}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all whitespace-nowrap',
                active
                  ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:text-white/80'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
