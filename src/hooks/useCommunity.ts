import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

export interface WallPost {
  id: string
  user_id: string
  content: string
  type: string
  reactions_count: number
  created_at: string
  author?: { name: string; avatar_url: string | null }
}

export interface Circle {
  id: string
  objective: string
  description: string | null
  max_members: number
  member_count?: number
  is_member?: boolean
}

export interface Buddy {
  id: string
  partner: { name: string; avatar_url: string | null }
  streak_days: number
  status: string
}

export interface Mission {
  id: string
  title: string
  description: string | null
  target_value: number
  current_value: number
  reward_value: number
  deadline: string | null
  achieved: boolean
}

async function readCommunity(path: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(path, { signal })
  if (!response.ok) throw new Error('Community unavailable')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Community response invalid')
  return data as Record<string, unknown>
}

export function useCommunity(userId?: string) {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [circles, setCircles] = useState<Circle[]>([])
  const [buddy, setBuddy] = useState<Buddy | null>(null)
  const [missions] = useState<Mission[]>([])
  const [posting, setPosting] = useState(false)
  const [joiningCircle, setJoiningCircle] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [loadedUser, setLoadedUser] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)

  const fetchWall = useCallback((signal?: AbortSignal) => {
    return readCommunity('/api/community/wall', signal).then(data => {
      if (signal?.aborted) return
      if (!Array.isArray(data.posts)) throw new Error('Wall response invalid')
      setPosts(data.posts as WallPost[])
    }).catch(() => {
      if (signal?.aborted) return
      setPosts([])
      setError('Impossible de charger le mur de la communauté. Réessaie.')
    })
  }, [])

  const fetchCircles = useCallback((signal?: AbortSignal) => {
    return readCommunity('/api/community/circles', signal).then(data => {
      if (signal?.aborted) return
      if (!Array.isArray(data.circles)) throw new Error('Circles response invalid')
      setCircles(data.circles as Circle[])
    }).catch(() => {
      if (signal?.aborted) return
      setCircles([])
      setError('Impossible de charger les cercles. Réessaie.')
    })
  }, [])

  const fetchBuddy = useCallback((signal?: AbortSignal) => {
    return readCommunity('/api/community/buddy', signal).then(data => {
      if (signal?.aborted) return
      setBuddy((data.buddy as Buddy | null) ?? null)
    }).catch(() => {
      if (signal?.aborted) return
      setBuddy(null)
      setError('Impossible de charger ton binôme. Réessaie.')
    })
  }, [])

  const load = useCallback(() => {
    if (!userId) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    return Promise.all([fetchWall(controller.signal), fetchCircles(controller.signal), fetchBuddy(controller.signal)]).finally(() => {
      if (controller.signal.aborted) return
      setLoadedUser(userId)
      setLoading(false)
    })
  }, [userId, fetchWall, fetchCircles, fetchBuddy])

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    return load()
  }, [load])

  useEffect(() => {
    void load()
    return () => { pending.current?.abort(); pending.current = null }
  }, [load])

  const handlePost = async (content: string, type: string): Promise<boolean> => {
    if (!content.trim()) return false
    setPosting(true)
    try {
      const res = await fetch('/api/community/wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type }),
      })
      if (res.ok) {
        toast.success('Message publie ! +50 points')
        fetchWall()
        return true
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setPosting(false)
    }
    return false
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

  const handleCheckin = async (message: string): Promise<boolean> => {
    if (!buddy) return false
    setCheckingIn(true)
    try {
      const res = await fetch('/api/community/buddy/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, moodEmoji: '' }),
      })
      if (res.ok) {
        toast.success('Check-in envoye ! +20 points')
        return true
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setCheckingIn(false)
    }
    return false
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

  return {
    loading: !!userId && (loading || loadedUser !== userId),
    posts: loadedUser === userId ? posts : [],
    circles: loadedUser === userId ? circles : [],
    buddy: loadedUser === userId ? buddy : null,
    missions: loadedUser === userId ? missions : [],
    posting,
    joiningCircle,
    checkingIn,
    handlePost,
    handleReact,
    handleJoinCircle,
    handleCheckin,
    handleFindBuddy,
    error: loadedUser === userId ? error : null,
    refresh,
  }
}
