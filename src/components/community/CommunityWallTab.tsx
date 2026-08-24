import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Send, Loader2 } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { WallPost } from '@/hooks/useCommunity'

interface CommunityWallTabProps {
  posts: WallPost[]
  posting: boolean
  onPost: (content: string, type: string) => Promise<boolean>
  onReact: (postId: string, emoji: string) => void
}

const POST_TYPES = [
  { value: 'victory', label: 'Victoire' },
  { value: 'encouragement', label: 'Encouragement' },
  { value: 'milestone', label: 'Palier' },
  { value: 'gratitude', label: 'Gratitude' },
]

export function CommunityWallTab({ posts, posting, onPost, onReact }: CommunityWallTabProps) {
  const [newPost, setNewPost] = useState('')
  const [postType, setPostType] = useState<string>('victory')

  const handleSubmit = async () => {
    const success = await onPost(newPost, postType)
    if (success) setNewPost('')
  }

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            {POST_TYPES.map(pt => (
              <button
                key={pt.value}
                onClick={() => setPostType(pt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  postType === pt.value
                    ? 'bg-violet-600/30 text-violet-300'
                    : 'text-white/40 hover:text-white/60 bg-white/5'
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              placeholder="Partage ta victoire, encourage un createur..."
              className="flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            <Button onClick={handleSubmit} disabled={posting || !newPost.trim()}>
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <EmptyState icon={Heart} title="Le mur est vide" description="Sois le premier a partager !" />
      ) : (
        posts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
          >
            <Card className="glass">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={post.author?.name || 'Utilisateur'} src={post.author?.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{post.author?.name || 'Createur'}</span>
                      <Badge variant="info" className="text-xs">{post.type}</Badge>
                      <span className="text-xs text-white/30">{formatDate(post.created_at)}</span>
                    </div>
                    <p className="text-white/80 mt-1 text-sm">{post.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {['❤️', '🔥', '💪'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => onReact(post.id, emoji)}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                      <span className="text-xs text-white/30 ml-1">{post.reactions_count} reactions</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))
      )}
    </div>
  )
}
