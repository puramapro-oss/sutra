'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  Plus,
  Film,
  Mic,
  Users,
  Trophy,
  Wallet,
  Settings,
  BarChart3,
  MessageCircle,
  ShoppingBag,
  Heart,
  Ticket,
  BookOpen,
  Handshake,
  Crown,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchItem {
  label: string
  href: string
  icon: React.ReactNode
  keywords: string[]
}

const SEARCH_ITEMS: SearchItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, keywords: ['accueil', 'home', 'tableau de bord'] },
  { label: 'Creer une video', href: '/create', icon: <Plus className="h-4 w-4" />, keywords: ['nouvelle', 'generer', 'video', 'create'] },
  { label: 'Mes videos', href: '/library', icon: <Film className="h-4 w-4" />, keywords: ['bibliotheque', 'library', 'videos'] },
  { label: 'Voix', href: '/voices', icon: <Mic className="h-4 w-4" />, keywords: ['voice', 'cloner', 'elevenlabs'] },
  { label: 'Chat IA', href: '/chat', icon: <MessageCircle className="h-4 w-4" />, keywords: ['conversation', 'assistant', 'ia', 'aide'] },
  { label: 'Analytics', href: '/analytics', icon: <BarChart3 className="h-4 w-4" />, keywords: ['statistiques', 'stats', 'performance'] },
  { label: 'Parrainage', href: '/referral', icon: <Users className="h-4 w-4" />, keywords: ['referral', 'filleuls', 'inviter'] },
  { label: 'Wallet', href: '/wallet', icon: <Wallet className="h-4 w-4" />, keywords: ['portefeuille', 'retrait', 'argent', 'gains'] },
  { label: 'Concours', href: '/contest', icon: <Trophy className="h-4 w-4" />, keywords: ['competition', 'classement', 'gagner'] },
  { label: 'Tirage', href: '/lottery', icon: <Ticket className="h-4 w-4" />, keywords: ['lottery', 'chance', 'tickets'] },
  { label: 'Boutique', href: '/boutique', icon: <ShoppingBag className="h-4 w-4" />, keywords: ['points', 'acheter', 'shop'] },
  { label: 'Communaute', href: '/community', icon: <Heart className="h-4 w-4" />, keywords: ['cercles', 'buddy', 'mur'] },
  { label: 'Partenaire', href: '/partenaire', icon: <Handshake className="h-4 w-4" />, keywords: ['influenceur', 'partner'] },
  { label: 'Guide', href: '/guide', icon: <BookOpen className="h-4 w-4" />, keywords: ['tutoriel', 'aide', 'comment'] },
  { label: 'Parametres', href: '/settings', icon: <Settings className="h-4 w-4" />, keywords: ['reglages', 'profil', 'theme', 'langue'] },
  { label: 'Admin', href: '/admin', icon: <Crown className="h-4 w-4" />, keywords: ['administration', 'gestion'] },
  { label: 'Tarifs', href: '/pricing', icon: <Crown className="h-4 w-4" />, keywords: ['pricing', 'abonnement', 'plan', 'prix'] },
]

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const filtered = query.trim()
    ? SEARCH_ITEMS.filter((item) => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
        )
      })
    : SEARCH_ITEMS.slice(0, 8)

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault()
        navigate(filtered[selectedIndex].href)
      }
    },
    [filtered, selectedIndex, navigate]
  )

  return (
    <>
      {/* Trigger button for header */}
      <button
        onClick={() => setOpen(true)}
        data-testid="search-trigger"
        className={cn(
          'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg',
          'bg-white/[0.04] border border-white/[0.08] text-white/40 text-sm',
          'hover:bg-white/[0.06] hover:text-white/60 transition-all'
        )}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Rechercher...</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/30 font-mono">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 top-[15%] z-[1001] mx-auto w-full max-w-lg px-4"
            >
              <div className="overflow-hidden rounded-2xl bg-[#0d0b16] border border-white/[0.08] shadow-2xl shadow-violet-500/10">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
                  <Search className="h-5 w-5 text-white/30 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setSelectedIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ou veux-tu aller ?"
                    data-testid="search-input"
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 outline-none"
                  />
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/30 font-mono">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[300px] overflow-y-auto py-2">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-white/30">
                      Aucun resultat pour &quot;{query}&quot;
                    </p>
                  ) : (
                    filtered.map((item, i) => (
                      <button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        data-testid={`search-result-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                          i === selectedIndex
                            ? 'bg-violet-500/10 text-white'
                            : 'text-white/60 hover:bg-white/[0.04]'
                        )}
                      >
                        <span className={cn(
                          'flex-shrink-0',
                          i === selectedIndex ? 'text-violet-400' : 'text-white/30'
                        )}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-sm">{item.label}</span>
                        {i === selectedIndex && (
                          <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
