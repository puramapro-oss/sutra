import { useState } from 'react'
import { Users, Flame, Send, Loader2, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { Buddy } from '@/hooks/useCommunity'

interface CommunityBuddyTabProps {
  buddy: Buddy | null
  checkingIn: boolean
  onCheckin: (message: string) => Promise<boolean>
  onFindBuddy: () => void
}

export function CommunityBuddyTab({ buddy, checkingIn, onCheckin, onFindBuddy }: CommunityBuddyTabProps) {
  const [checkinMsg, setCheckinMsg] = useState('')

  const handleSubmit = async () => {
    const success = await onCheckin(checkinMsg)
    if (success) setCheckinMsg('')
  }

  if (!buddy) {
    return (
      <Card className="glass">
        <CardContent className="p-8 text-center">
          <Users className="w-12 h-12 text-pink-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Trouve ton buddy createur</h3>
          <p className="text-white/50 text-sm mb-4">
            Un buddy t&apos;accompagne au quotidien. Check-ins mutuels, points doubles, recompenses a 30 jours !
          </p>
          <Button onClick={onFindBuddy}>
            <Plus className="w-4 h-4 mr-2" />
            Trouver un buddy
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass border-pink-500/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Avatar name={buddy.partner?.name || 'Buddy'} src={buddy.partner?.avatar_url} size="lg" />
          <div>
            <h3 className="font-semibold text-white text-lg">{buddy.partner?.name}</h3>
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Flame className="w-4 h-4 text-orange-400" />
              {buddy.streak_days} jours de suite
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            value={checkinMsg}
            onChange={e => setCheckinMsg(e.target.value)}
            placeholder="Envoie un message a ton buddy..."
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <Button onClick={handleSubmit} disabled={checkingIn}>
            {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
