'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Crown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mainNav } from '@/data/sidebar-nav'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const aliases: Record<string, string> = {
  '/create': 'nouvelle generer video creation', '/library': 'mes videos bibliotheque',
  '/production': 'studio film montage', '/batch': 'plusieurs lot campagne',
  '/auto': 'automatique autonome planification', '/settings': 'reglages profil theme langue',
  '/wallet': 'portefeuille retrait argent gains', '/voices': 'voice voix narration doublage',
}

export default function SearchModal() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { isSuperAdmin } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const items = [
    ...mainNav,
    { label: 'Tarifs', href: '/pricing', icon: Crown, testId: 'search-pricing' },
    ...(isSuperAdmin ? [{ label: 'Admin', href: '/admin', icon: Crown, testId: 'search-admin' }] : []),
  ]
  const filtered = items.filter(item => !query.trim() || normalize(`${item.label} ${item.href} ${aliases[item.href] ?? ''}`).includes(normalize(query.trim())))

  function show() { setQuery(''); setSelectedIndex(0); setOpen(true) }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuery('')
        setSelectedIndex(0)
        setOpen(current => !current)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  function navigate(href: string) { setOpen(false); router.push(href) }

  return (
    <>
      <button type="button" onClick={show} aria-label="Rechercher dans le studio" aria-haspopup="dialog" aria-expanded={open} data-testid="search-trigger" className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70 hover:bg-white/[0.08]">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden sm:inline ml-2 text-xs text-white/50">⌘K</kbd>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Rechercher dans le studio" initialFocusRef={inputRef} data-testid="search-modal">
        <input
          ref={inputRef} type="search" value={query} aria-label="Rechercher une page" aria-controls="studio-search-results"
          onChange={event => { setQuery(event.target.value); setSelectedIndex(0) }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex(index => Math.min(index + 1, Math.max(0, filtered.length - 1))) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(index => Math.max(0, index - 1)) }
            if (event.key === 'Enter' && filtered[selectedIndex]) { event.preventDefault(); navigate(filtered[selectedIndex].href) }
          }}
          placeholder="Créer, montage, paramètres…" data-testid="search-input"
          className="mb-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-base text-white placeholder:text-white/60"
        />
        <p role="status" className="mb-2 text-xs text-white/60">{filtered.length} page{filtered.length > 1 ? 's' : ''}</p>
        <div id="studio-search-results" className="max-h-[min(50dvh,360px)] overflow-y-auto">
          {filtered.length === 0 ? <p className="py-6 text-sm text-white/70">Aucun résultat pour « {query} ».</p> : filtered.map((item, index) => (
            <button key={item.href} type="button" onClick={() => navigate(item.href)} onMouseEnter={() => setSelectedIndex(index)}
              data-testid={`search-result-${item.href.slice(1).replaceAll('/', '-')}`}
              className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', index === selectedIndex ? 'bg-violet-500/15 text-white' : 'text-white/70 hover:bg-white/5')}>
              <item.icon className="h-4 w-4 shrink-0" /><span className="flex-1">{item.label}</span>
              {index === selectedIndex && <ArrowRight className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}
