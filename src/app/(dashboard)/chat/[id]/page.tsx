'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Send,
  ArrowLeft,
  Loader2,
  Bot,
  User as UserIcon,
  Copy,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const supabase = createClient()

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const { user, session } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load conversation + messages
  useEffect(() => {
    if (!user || !id) return
    async function load() {
      const [convRes, msgRes] = await Promise.all([
        supabase
          .from('conversations')
          .select('title')
          .eq('id', id)
          .eq('user_id', user!.id)
          .single(),
        supabase
          .from('messages')
          .select('id, role, content, created_at')
          .eq('conversation_id', id)
          .order('created_at', { ascending: true }),
      ])
      if (convRes.data) setTitle(convRes.data.title)
      if (msgRes.data) setMessages(msgRes.data as Message[])
      setLoading(false)
      setTimeout(scrollToBottom, 100)
    }
    load()
  }, [user, id, scrollToBottom])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || !user || !session) return
    setInput('')
    setSending(true)

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setTimeout(scrollToBottom, 50)

    try {
      // Save user message
      await supabase.from('messages').insert({
        conversation_id: id,
        role: 'user',
        content: text,
      })

      // Call AI
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!res.ok) throw new Error('Erreur IA')

      const data = await res.json()
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Save assistant message + update conversation
      await Promise.all([
        supabase.from('messages').insert({
          conversation_id: id,
          role: 'assistant',
          content: data.message,
        }),
        supabase
          .from('conversations')
          .update({
            last_message: data.message.slice(0, 100),
            title: messages.length === 0 ? text.slice(0, 60) : undefined,
            message_count: messages.length + 2,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id),
      ])

      if (messages.length === 0) setTitle(text.slice(0, 60))
      setTimeout(scrollToBottom, 50)
    } catch {
      toast.error('Erreur lors de l\'envoi. Reessaie.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending, user, session, id, messages, scrollToBottom])

  const copyMessage = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="flex-1 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-3/4 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-5rem)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.06]">
        <Link
          href="/chat"
          className="p-2 rounded-lg hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-white truncate">{title || 'Nouvelle conversation'}</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-violet-400" />
            </div>
            <p className="text-white/60 text-sm max-w-md">
              Je suis SUTRA, ton assistant creatif video. Pose-moi une question sur tes projets, scripts, ou strategies de contenu.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center mt-1">
                <Bot className="h-4 w-4 text-violet-400" />
              </div>
            )}
            <div
              className={cn(
                'group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-violet-600/30 border border-violet-500/20 text-white'
                  : 'bg-white/[0.04] border border-white/[0.06] text-white/90'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/10 text-white/40 hover:text-white transition-all"
                >
                  {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center mt-1">
                <UserIcon className="h-4 w-4 text-white/50" />
              </div>
            )}
          </motion.div>
        ))}

        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-violet-400" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                SUTRA reflechit...
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-white/[0.06]">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ecris ton message..."
            rows={1}
            data-testid="chat-input"
            className={cn(
              'flex-1 resize-none rounded-xl px-4 py-3 text-sm text-white',
              'bg-white/[0.04] border border-white/[0.08]',
              'placeholder:text-white/30',
              'focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20',
              'transition-all'
            )}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            data-testid="chat-send-btn"
            className={cn(
              'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
              'bg-gradient-to-r from-violet-600 to-purple-600 text-white',
              'hover:from-violet-500 hover:to-purple-500',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'transition-all active:scale-95'
            )}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
