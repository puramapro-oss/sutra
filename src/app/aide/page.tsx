'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HelpCircle,
  ChevronDown,
  Send,
  MessageCircle,
  Loader2,
  Bot,
  Mail,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { type FAQItem, type ChatMessage, faqs } from './aide-data'
import { EscaladeForm } from './EscaladeForm'

export default function AidePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: "Salut ! Je suis l&apos;assistant SUTRA. Pose-moi ta question, je suis la pour t&apos;aider." },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput.trim() }
    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content }),
      })
      const data = await res.json()
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response ?? "Desole, je n&apos;ai pas pu repondre." },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Erreur de connexion. Reessaie.' },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#06050e] text-white">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-3">
            <HelpCircle className="w-8 h-8 text-violet-400" />
            Centre d&apos;aide
          </h1>
          <p className="text-white/50 mt-2">FAQ, chatbot IA et contact humain — tout pour t&apos;aider.</p>
        </div>

        {/* FAQ */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white mb-4">Questions frequentes</h2>
          {faqs.map((faq, idx) => {
            const Icon = faq.icon
            const isOpen = openFaq === idx
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <Icon className="w-5 h-5 text-violet-400 shrink-0" />
                  <span className="flex-1 font-medium text-sm">{faq.question}</span>
                  <ChevronDown className={cn('w-4 h-4 text-white/40 transition-transform', isOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-sm text-white/60 leading-relaxed pl-13">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </section>

        {/* Chatbot */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            Assistant IA
          </h2>
          <div className="glass rounded-2xl overflow-hidden">
            <div
              ref={chatScrollRef}
              className="h-80 overflow-y-auto p-4 space-y-3"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'ml-auto bg-violet-600/20 border border-violet-500/20 text-white'
                      : 'bg-white/5 border border-white/[0.06] text-white/80'
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reflexion...
                </div>
              )}
            </div>
            <div className="border-t border-white/[0.06] p-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder="Pose ta question..."
                className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none px-3"
              />
              <Button
                size="sm"
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatLoading}
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        <EscaladeForm />

        {/* Links */}
        <div className="text-center text-sm text-white/30 space-x-4">
          <Link href="/guide" className="hover:text-white/60 transition-colors">Guide</Link>
          <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
          <Link href="/mentions-legales" className="hover:text-white/60 transition-colors">Mentions legales</Link>
        </div>
      </div>
    </div>
  )
}
