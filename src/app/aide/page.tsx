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
  Video,
  CreditCard,
  Users,
  Shield,
  Zap,
  Mail,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface FAQItem {
  question: string
  answer: string
  icon: React.ComponentType<{ className?: string }>
}

const faqs: FAQItem[] = [
  {
    icon: Video,
    question: "Comment generer ma premiere video ?",
    answer: "Clique sur 'Creer' dans le menu, decris ton sujet, et SUTRA genere automatiquement le script, la voix, les visuels et le montage. En quelques minutes, ta video est prete.",
  },
  {
    icon: Zap,
    question: "Quelle est la difference entre les plans ?",
    answer: "Free : 2 videos/mois en 720p. Starter : 10 videos en 720p. Createur : 50 videos en 1080p avec voix et autopilot. Empire : videos illimitees en 4K avec toutes les fonctionnalites.",
  },
  {
    icon: CreditCard,
    question: "Comment fonctionne le systeme de points ?",
    answer: "Tu gagnes des points en creant du contenu, en parrainant, en completant des achievements et en ouvrant ton coffre quotidien. Les points peuvent etre echanges contre des reductions, des abonnements ou convertis en euros.",
  },
  {
    icon: Users,
    question: "Comment fonctionne le parrainage ?",
    answer: "Partage ton lien de parrainage. Tu recois une commission sur chaque abonnement de tes filleuls. Les paliers vont de Bronze (10 filleuls) a Legende (100+) avec des avantages croissants.",
  },
  {
    icon: Shield,
    question: "Mes donnees sont-elles protegees ?",
    answer: "Oui. SUTRA est conforme RGPD. Tes videos et donnees sont chiffrees. Tu peux exporter ou supprimer tes donnees a tout moment depuis les parametres.",
  },
  {
    icon: Video,
    question: "Puis-je personnaliser les voix ?",
    answer: "Oui ! Avec le plan Createur ou Empire, tu as acces a plusieurs voix francaises naturelles et tu peux meme cloner ta propre voix pour un rendu unique.",
  },
]

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function AidePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: "Salut ! Je suis l'assistant SUTRA. Pose-moi ta question, je suis la pour t'aider." },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Escalade form
  const [showEscalade, setShowEscalade] = useState(false)
  const [escaladeName, setEscaladeName] = useState('')
  const [escaladeEmail, setEscaladeEmail] = useState('')
  const [escaladeMessage, setEscaladeMessage] = useState('')
  const [escaladeLoading, setEscaladeLoading] = useState(false)
  const [escaladeSent, setEscaladeSent] = useState(false)

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
        { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response ?? "Desole, je n'ai pas pu repondre." },
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

  const handleEscalade = async () => {
    if (!escaladeName.trim() || !escaladeEmail.trim() || !escaladeMessage.trim()) {
      toast.error('Remplis tous les champs')
      return
    }
    setEscaladeLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: escaladeName.trim(),
          email: escaladeEmail.trim(),
          subject: 'Escalade SAV — Aide',
          message: escaladeMessage.trim(),
        }),
      })
      if (res.ok) {
        setEscaladeSent(true)
        toast.success('Message envoye ! On te repond sous 24h.')
      } else {
        toast.error("Erreur lors de l'envoi. Reessaie.")
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setEscaladeLoading(false)
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

        {/* Escalade */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Contacter un humain
          </h2>
          <p className="text-sm text-white/50">
            Le chatbot ne repond pas a ta question ? Ecris-nous, on te repond sous 24h.
          </p>

          {!showEscalade && !escaladeSent && (
            <Button
              variant="secondary"
              onClick={() => setShowEscalade(true)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Ecrire au support
            </Button>
          )}

          <AnimatePresence>
            {showEscalade && !escaladeSent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass rounded-2xl p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      value={escaladeName}
                      onChange={(e) => setEscaladeName(e.target.value)}
                      placeholder="Ton prenom"
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                    />
                    <input
                      value={escaladeEmail}
                      onChange={(e) => setEscaladeEmail(e.target.value)}
                      placeholder="ton@email.com"
                      type="email"
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <textarea
                    value={escaladeMessage}
                    onChange={(e) => setEscaladeMessage(e.target.value)}
                    placeholder="Decris ton probleme en detail..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEscalade(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleEscalade}
                      disabled={escaladeLoading}
                    >
                      {escaladeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Envoyer
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {escaladeSent && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6 border border-emerald-500/20 text-center"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="font-semibold text-white">Message envoye</h3>
              <p className="text-white/50 text-sm mt-1">On te repond sous 24h sur {escaladeEmail}</p>
            </motion.div>
          )}
        </section>

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
