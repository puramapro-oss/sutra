'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookHeart, Plus, Send, Sparkles, Flame, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useAwakening } from '@/hooks/useAwakening'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface GratitudeEntry {
  id: string
  content: string
  created_at: string
}

const MAX_DAILY = 3
const POINTS_REWARD = 100

export default function GratitudePage() {
  const { profile, loading: authLoading } = useAuth()
  const { addXp, streak } = useAwakening(profile?.id)
  const [entries, setEntries] = useState<GratitudeEntry[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [newEntry, setNewEntry] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gratitude')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
        setTodayCount(data.todayCount || 0)
      }
    } catch {
      // defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchEntries()
  }, [authLoading, profile?.id, fetchEntries])

  const handleSubmit = async () => {
    if (!newEntry.trim() || todayCount >= MAX_DAILY) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/gratitude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newEntry.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur lors de l\'enregistrement')
        return
      }
      const data = await res.json()
      setEntries((prev) => [data.entry, ...prev])
      setTodayCount((prev) => prev + 1)
      setNewEntry('')
      setShowInput(false)

      if (profile?.id) {
        addXp('gratitude', POINTS_REWARD)
      }

      const remaining = MAX_DAILY - todayCount - 1
      if (remaining > 0) {
        toast.success(`Merci pour cette gratitude ! +${POINTS_REWARD} pts. Encore ${remaining} aujourd'hui.`)
      } else {
        toast.success(`3 gratitudes du jour completees ! +${POINTS_REWARD} pts`)
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setSubmitting(false)
    }
  }

  const canAdd = todayCount < MAX_DAILY

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookHeart className="w-7 h-7 text-pink-400" />
            Journal de gratitude
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            3 gratitudes par jour transforment ta vision du monde.
          </p>
        </div>
        {streak > 0 && (
          <div className="glass rounded-2xl px-4 py-2 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">{streak}j</span>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/70">Aujourd&apos;hui</span>
          <span className="text-xs text-white/40">{todayCount}/{MAX_DAILY}</span>
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: MAX_DAILY }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-2 rounded-full transition-all duration-500',
                i < todayCount
                  ? 'bg-gradient-to-r from-pink-400 to-violet-400'
                  : 'bg-white/10'
              )}
            />
          ))}
        </div>
        {todayCount >= MAX_DAILY && (
          <p className="text-xs text-emerald-400 mt-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Bravo ! Tu as complete tes 3 gratitudes du jour.
          </p>
        )}
      </div>

      {/* Add entry */}
      {canAdd && (
        <AnimatePresence>
          {showInput ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-2xl p-5 border border-pink-500/20">
                <textarea
                  value={newEntry}
                  onChange={(e) => setNewEntry(e.target.value)}
                  placeholder="Je suis reconnaissant(e) pour..."
                  className="w-full bg-transparent text-white placeholder:text-white/30 resize-none focus:outline-none text-sm leading-relaxed min-h-[80px]"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-white/30">{newEntry.length}/500</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowInput(false); setNewEntry('') }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={!newEntry.trim() || submitting}
                      className="bg-gradient-to-r from-pink-500 to-violet-600"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Enregistrer
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <button
                onClick={() => setShowInput(true)}
                className="w-full glass rounded-2xl p-5 border border-dashed border-white/10 hover:border-pink-500/30 transition-all text-left group"
              >
                <div className="flex items-center gap-3 text-white/40 group-hover:text-white/60 transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-sm">Ajouter une gratitude...</span>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Entries list */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <EmptyState
            icon={BookHeart}
            title="Ton journal est vide"
            description="Commence par noter ce pour quoi tu es reconnaissant(e) aujourd'hui."
          />
        ) : (
          entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="glass hover:border-pink-500/20 transition-all">
                <CardContent className="p-5">
                  <p className="text-white/80 text-sm leading-relaxed">{entry.content}</p>
                  <p className="text-white/30 text-xs mt-3">
                    {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
