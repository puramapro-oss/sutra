import { motion } from 'framer-motion'
import { Mic, Play, Pause, Trash2, Crown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import type { ClonedVoice } from '@/types'

interface VoiceCardProps {
  voice: ClonedVoice
  index: number
  isPremium: boolean
  isPlaying: boolean
  isDeleting: boolean
  onPlay: (id: string, url: string) => void
  onDelete: (id: string) => Promise<void>
}

export function VoiceCard({
  voice,
  index,
  isPremium,
  isPlaying,
  isDeleting,
  onPlay,
  onDelete,
}: VoiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card hover data-testid={`cloned-voice-${voice.id}`}>
        <div className="h-1 w-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-t-2xl" />
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start justify-between mb-2">
            <Mic className="h-5 w-5 text-purple-400/50" />
            {isPremium && <Crown className="h-4 w-4 text-amber-400" />}
          </div>
          <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">{voice.name}</h3>
          <p className="text-[11px] text-white/30 mb-3">{formatDate(voice.created_at)}</p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onPlay(voice.id, voice.url)}
              disabled={isDeleting}
              data-testid={`play-voice-${voice.id}`}
              className="flex-1 justify-center"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'Pause' : 'Ecouter'}
            </Button>
            <button
              onClick={() => onDelete(voice.id)}
              disabled={isDeleting}
              data-testid={`delete-voice-${voice.id}`}
              className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
