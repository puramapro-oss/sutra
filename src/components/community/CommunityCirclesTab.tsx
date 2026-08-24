import { Users, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { Circle } from '@/hooks/useCommunity'

interface CommunityCirclesTabProps {
  circles: Circle[]
  joiningCircle: string | null
  onJoinCircle: (circleId: string) => void
}

export function CommunityCirclesTab({ circles, joiningCircle, onJoinCircle }: CommunityCirclesTabProps) {
  if (circles.length === 0) {
    return <EmptyState icon={Users} title="Aucun cercle" description="Les cercles creatifs arrivent bientot" />
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {circles.map(circle => (
        <Card key={circle.id} className="glass">
          <CardContent className="p-5">
            <h3 className="font-semibold text-white">{circle.objective}</h3>
            {circle.description && (
              <p className="text-sm text-white/50 mt-1">{circle.description}</p>
            )}
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-white/40">
                {circle.member_count || 0}/{circle.max_members} membres
              </span>
              {circle.is_member ? (
                <Badge>Membre</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onJoinCircle(circle.id)}
                  disabled={joiningCircle === circle.id}
                >
                  {joiningCircle === circle.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rejoindre'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
