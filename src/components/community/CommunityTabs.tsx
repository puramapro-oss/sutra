import { LucideIcon, Heart, Users, MessageCircle, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CommunityTab = 'wall' | 'circles' | 'buddy' | 'missions'

interface CommunityTabsProps {
  activeTab: CommunityTab
  onTabChange: (tab: CommunityTab) => void
}

const TABS: { id: CommunityTab; label: string; icon: LucideIcon }[] = [
  { id: 'wall', label: 'Mur d\'amour', icon: Heart },
  { id: 'circles', label: 'Cercles', icon: Users },
  { id: 'buddy', label: 'Buddy', icon: MessageCircle },
  { id: 'missions', label: 'Missions', icon: Target },
]

export function CommunityTabs({ activeTab, onTabChange }: CommunityTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
            activeTab === t.id
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
          )}
        >
          <t.icon className="w-4 h-4" />
          {t.label}
        </button>
      ))}
    </div>
  )
}
