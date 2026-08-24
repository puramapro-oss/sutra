import { useState, useEffect, useCallback } from 'react'
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

export function useCommunity(userId?: string) {
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [circles, setCircles] = useState<Circle[]>([])
  const [buddy, setBuddy] = useState<Buddy | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [posting, setPosting] = useState(false)
  const [joiningCircle, setJoiningCircle] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)

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
    if (!userId) return
    setLoading(true)
    Promise.all([fetchWall(), fetchCircles(), fetchBuddy()]).finally(() => setLoading(false))
  }, [userId, fetchWall, fetchCircles, fetchBuddy])

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
    loading,
    posts,
    circles,
    buddy,
    missions,
    posting,
    joiningCircle,
    checkingIn,
    handlePost,
    handleReact,
    handleJoinCircle,
    handleCheckin,
    handleFindBuddy,
  }
}
