import { Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Mission } from '@/hooks/useCommunity'

interface CommunityMissionsTabProps {
  missions: Mission[]
}

export function CommunityMissionsTab({ missions }: CommunityMissionsTabProps) {
  if (missions.length === 0) {
    return <EmptyState icon={Target} title="Aucune mission collective" description="Les missions arrivent bientot !" />
  }

  return (
    <div className="space-y-4">
      {missions.map(m => (
        <Card key={m.id} className="glass">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white">{m.title}</h3>
              {m.achieved && <Badge className="bg-green-500/20 text-green-400">Accompli</Badge>}
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-pink-500 rounded-full transition-all"
                style={{ width: `${Math.min((m.current_value / m.target_value) * 100, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-white/40">
              <span>{m.current_value.toLocaleString()} / {m.target_value.toLocaleString()}</span>
              <span>+{m.reward_value} pts</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
