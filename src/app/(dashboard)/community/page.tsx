'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Users, MessageCircle, Target, Send, Loader2, Plus, Flame, Award } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'

type Tab = 'wall' | 'circles' | 'buddy' | 'missions'

interface WallPost {
  id: string
  user_id: string
  content: string
  type: string
  reactions_count: number
  created_at: string
  author?: { name: string; avatar_url: string | null }
}

interface Circle {
  id: string
  objective: string
  description: string | null
  max_members: number
  member_count?: number
  is_member?: boolean
}

interface Buddy {
  id: string
  partner: { name: string; avatar_url: string | null }
  streak_days: number
  status: string
}

interface Mission {
  id: string
  title: string
  description: string | null
  target_value: number
  current_value: number
  reward_value: number
  deadline: string | null
  achieved: boolean
}

export default function CommunityPage() {
  const { profile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<Tab>('wall')
  const [loading, setLoading] = useState(true)

  // Wall state
  const [posts, setPosts] = useState<WallPost[]>([])
  const [newPost, setNewPost] = useState('')
  const [postType, setPostType] = useState<string>('victory')
  const [posting, setPosting] = useState(false)

  // Circles state
  const [circles, setCircles] = useState<Circle[]>([])
  const [joiningCircle, setJoiningCircle] = useState<string | null>(null)

  // Buddy state
  const [buddy, setBuddy] = useState<Buddy | null>(null)
  const [checkinMsg, setCheckinMsg] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)

  // Missions state
  const [missions, setMissions] = useState<Mission[]>([])

  const fetchWall = useCallback(async () => {
    try {
      const res = await fetch('/api/community/wall')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch { /* empty */ }
  }, [])

  const fetchCircles = useCallback(async () => {
    try {
      const res = await fetch('/api/community/circles')
      if (res.ok) {
        const data = await res.json()
        setCircles(data.circles || [])
      }
    } catch { /* empty */ }
  }, [])

  const fetchBuddy = useCallback(async () => {
    try {
      const res = await fetch('/api/community/buddy')
      if (res.ok) {
        const data = await res.json()
        setBuddy(data.buddy || null)
      }
    } catch { /* empty */ }
  }, [])

  useEffect(() => {
    if (authLoading || !profile?.id) return
    setLoading(true)
    Promise.all([fetchWall(), fetchCircles(), fetchBuddy()]).finally(() => setLoading(false))
  }, [authLoading, profile?.id, fetchWall, fetchCircles, fetchBuddy])

  const handlePost = async () => {
    if (!newPost.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/community/wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newPost, type: postType }),
      })
      if (res.ok) {
        toast.success('Message publie ! +50 points')
        setNewPost('')
        fetchWall()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setPosting(false)
    }
  }

  const handleReact = async (postId: string, emoji: string) => {
    try {
      await fetch('/api/community/wall/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, emoji }),
      })
      fetchWall()
    } catch { /* empty */ }
  }

  const handleJoinCircle = async (circleId: string) => {
    setJoiningCircle(circleId)
    try {
      const res = await fetch('/api/community/circles/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId }),
      })
      if (res.ok) {
        toast.success('Cercle rejoint !')
        fetchCircles()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setJoiningCircle(null)
    }
  }

  const handleCheckin = async () => {
    if (!buddy) return
    setCheckingIn(true)
    try {
      const res = await fetch('/api/community/buddy/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: checkinMsg, moodEmoji: '' }),
      })
      if (res.ok) {
        toast.success('Check-in envoye ! +20 points')
        setCheckinMsg('')
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleFindBuddy = async () => {
    try {
      const res = await fetch('/api/community/buddy', { method: 'POST' })
      if (res.ok) {
        toast.success('Buddy trouve !')
        fetchBuddy()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Aucun buddy disponible')
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const tabs = [
    { id: 'wall' as Tab, label: 'Mur d\'amour', icon: Heart },
    { id: 'circles' as Tab, label: 'Cercles', icon: Users },
    { id: 'buddy' as Tab, label: 'Buddy', icon: MessageCircle },
    { id: 'missions' as Tab, label: 'Missions', icon: Target },
  ]

  const postTypes = [
    { value: 'victory', label: 'Victoire' },
    { value: 'encouragement', label: 'Encouragement' },
    { value: 'milestone', label: 'Palier' },
    { value: 'gratitude', label: 'Gratitude' },
  ]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Heart className="w-7 h-7 text-pink-400" />
          Communaute
        </h1>
        <p className="text-white/50 mt-1">Createurs SUTRA, ensemble on va plus loin</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap',
              tab === t.id
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Wall Tab */}
      {tab === 'wall' && (
        <div className="space-y-4">
          {/* Post form */}
          <Card className="glass">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                {postTypes.map(pt => (
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
                  onKeyDown={e => e.key === 'Enter' && handlePost()}
                />
                <Button onClick={handlePost} disabled={posting || !newPost.trim()}>
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
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
                              onClick={() => handleReact(post.id, emoji)}
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
      )}

      {/* Circles Tab */}
      {tab === 'circles' && (
        <div className="space-y-4">
          {circles.length === 0 ? (
            <EmptyState icon={Users} title="Aucun cercle" description="Les cercles creatifs arrivent bientot" />
          ) : (
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
                          onClick={() => handleJoinCircle(circle.id)}
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
          )}
        </div>
      )}

      {/* Buddy Tab */}
      {tab === 'buddy' && (
        <div className="space-y-4">
          {buddy ? (
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
                    onKeyDown={e => e.key === 'Enter' && handleCheckin()}
                  />
                  <Button onClick={handleCheckin} disabled={checkingIn}>
                    {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-pink-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Trouve ton buddy createur</h3>
                <p className="text-white/50 text-sm mb-4">
                  Un buddy t&apos;accompagne au quotidien. Check-ins mutuels, points doubles, recompenses a 30 jours !
                </p>
                <Button onClick={handleFindBuddy}>
                  <Plus className="w-4 h-4 mr-2" />
                  Trouver un buddy
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Missions Tab */}
      {tab === 'missions' && (
        <div className="space-y-4">
          {missions.length === 0 ? (
            <EmptyState icon={Target} title="Aucune mission collective" description="Les missions arrivent bientot !" />
          ) : (
            missions.map(m => (
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
            ))
          )}
        </div>
      )}
    </div>
  )
}
