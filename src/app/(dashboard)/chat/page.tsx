'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatRelativeDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const supabase = createClient()

interface Conversation {
  id: string
  title: string
  last_message: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export default function ChatListPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('conversations')
        .select('id, title, last_message, message_count, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50)
      setConversations((data as Conversation[]) ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const createConversation = useCallback(async () => {
    if (!user || creating) return
    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'Nouvelle conversation',
          message_count: 0,
        })
        .select('id')
        .single()

      if (data && !error) {
        router.push(`/chat/${data.id}`)
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false)
    }
  }, [user, creating, router])

  const deleteConversation = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      if (!user) return
      await supabase.from('conversations').delete().eq('id', id).eq('user_id', user.id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
    },
    [user]
  )

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Conversations
        </h1>
        <Button onClick={createConversation} disabled={creating} data-testid="new-chat-btn">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nouveau chat
        </Button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-5">
            <MessageSquare className="h-7 w-7 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Aucune conversation</h3>
          <p className="text-sm text-white/50 max-w-sm mb-6">
            Demande a SUTRA de t&apos;aider avec tes projets video.
          </p>
          <Button onClick={createConversation} disabled={creating}>
            <Plus className="h-4 w-4" />
            Commencer une conversation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((conv, i) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={`/chat/${conv.id}`}
                data-testid={`conversation-${conv.id}`}
                className={cn(
                  'group flex items-center gap-4 p-4 rounded-xl',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'hover:bg-white/[0.06] hover:border-white/[0.1]',
                  'transition-all duration-200'
                )}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{conv.title}</p>
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {conv.last_message ?? 'Pas encore de message'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-white/30">{formatRelativeDate(conv.updated_at)}</span>
                  <button
                    onClick={(e) => deleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
