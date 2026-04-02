'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Play,
  Pause,
  Trash2,
  Upload,
  Plus,
  Crown,
  ArrowRight,
  X,
  Loader2,
  Volume2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDate } from '@/lib/utils'
import { PLAN_LIMITS, VOICE_STYLES } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import type { ClonedVoice } from '@/types'

const supabase = createClient()

export default function VoicesPage() {
  const { profile, plan, loading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)
  const [showCloneForm, setShowCloneForm] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneFile, setCloneFile] = useState<File | null>(null)
  const [cloning, setCloning] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const limits = PLAN_LIMITS[plan]
  const canClone = limits.voices > 0
  const hasReachedLimit = clonedVoices.length >= limits.voices

  const fetchVoices = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (data) setClonedVoices(data as ClonedVoice[])
    } catch {
      setClonedVoices([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchVoices()
  }, [authLoading, profile?.id, fetchVoices])

  // Audio playback
  const playPreview = useCallback(
    (id: string, url: string) => {
      if (audioRef) {
        audioRef.pause()
        audioRef.currentTime = 0
      }

      if (playingId === id) {
        setPlayingId(null)
        return
      }

      const audio = new Audio(url)
      audio.onended = () => setPlayingId(null)
      audio.onerror = () => {
        setPlayingId(null)
        toast.error('Impossible de lire cet audio')
      }
      audio.play()
      setAudioRef(audio)
      setPlayingId(id)
    },
    [audioRef, playingId]
  )

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef) {
        audioRef.pause()
        audioRef.currentTime = 0
      }
    }
  }, [audioRef])

  // File handling
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('audio/') || file.name.endsWith('.wav') || file.name.endsWith('.mp3'))) {
      setCloneFile(file)
    } else {
      toast.error('Format non supporte. Utilise un fichier audio (MP3, WAV).')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setCloneFile(file)
  }, [])

  // Clone voice
  const handleClone = useCallback(async () => {
    if (!cloneName.trim()) {
      toast.error('Donne un nom a ta voix')
      return
    }
    if (!cloneFile) {
      toast.error('Ajoute un fichier audio')
      return
    }
    if (hasReachedLimit) {
      toast.error('Limite de voix clonees atteinte')
      return
    }

    setCloning(true)
    try {
      const formData = new FormData()
      formData.append('audio', cloneFile)
      formData.append('name', cloneName.trim())

      const res = await fetch('/api/voice/clone', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Clone failed')

      const data = await res.json()
      if (data.voice) {
        setClonedVoices((prev) => [data.voice as ClonedVoice, ...prev])
      }
      toast.success('Voix clonee avec succes !')
      setCloneName('')
      setCloneFile(null)
      setShowCloneForm(false)
    } catch {
      toast.error('Erreur lors du clonage vocal')
    } finally {
      setCloning(false)
    }
  }, [cloneName, cloneFile, hasReachedLimit])

  // Delete cloned voice
  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/voice/clone?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')

      setClonedVoices((prev) => prev.filter((v) => v.id !== id))
      toast.success('Voix supprimee')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }, [])

  const voicesSkeleton = (
    <div className="space-y-6" data-testid="voices-loading">
      <Skeleton width={200} height={32} rounded="lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={140} rounded="xl" />
        ))}
      </div>
    </div>
  )

  if (authLoading) return voicesSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchVoices} skeleton={voicesSkeleton}>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="voices-title">
            Voix
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Choisis une voix par defaut ou clone ta propre voix
          </p>
        </div>
        {canClone && (
          <Button
            onClick={() => setShowCloneForm(true)}
            disabled={hasReachedLimit}
            data-testid="voices-clone-btn"
          >
            <Plus className="h-4 w-4" />
            Cloner une voix
          </Button>
        )}
      </div>

      {/* Default voices */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Voix par defaut</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VOICE_STYLES.map((voice, i) => (
            <motion.div
              key={voice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card hover data-testid={`default-voice-${voice.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <Volume2 className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{voice.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="default" size="sm">{voice.lang.toUpperCase()}</Badge>
                        <span className="text-xs text-white/30 capitalize">{voice.gender === 'male' ? 'Homme' : 'Femme'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => playPreview(voice.id, `/api/voice/preview?id=${voice.id}`)}
                      data-testid={`play-default-${voice.id}`}
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center transition-colors',
                        playingId === voice.id
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                      )}
                    >
                      {playingId === voice.id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cloned voices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/60">
            Voix clonees
            {canClone && (
              <span className="text-white/30 font-normal ml-1">
                ({clonedVoices.length}/{limits.voices})
              </span>
            )}
          </h2>
        </div>

        {!canClone ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Crown className="h-8 w-8 text-amber-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">
                Clone vocal disponible a partir du plan Creator
              </h3>
              <p className="text-xs text-white/30 max-w-sm mx-auto mb-4">
                Clone ta propre voix pour des videos ultra-personnalisees. Jusqu a 3 voix avec Creator, illimite avec Empire.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.assign('/pricing')}
                data-testid="voices-upgrade"
              >
                <Crown className="h-3.5 w-3.5" />
                Passer a Creator
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ) : clonedVoices.length === 0 ? (
          <EmptyState
            icon={Mic}
            title="Aucune voix clonee"
            description="Clone ta voix pour personnaliser entierement tes videos."
            action={{ label: 'Cloner ma voix', onClick: () => setShowCloneForm(true) }}
            data-testid="voices-empty"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clonedVoices.map((voice, i) => (
              <motion.div
                key={voice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card hover data-testid={`cloned-voice-${voice.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{voice.name}</p>
                        <p className="text-xs text-white/30">{formatDate(voice.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (voice.preview_url) playPreview(voice.id, voice.preview_url)
                          }}
                          disabled={!voice.preview_url}
                          data-testid={`play-cloned-${voice.id}`}
                          className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center transition-colors',
                            !voice.preview_url
                              ? 'bg-white/[0.02] text-white/15 cursor-not-allowed'
                              : playingId === voice.id
                                ? 'bg-violet-500/20 text-violet-400'
                                : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                          )}
                        >
                          {playingId === voice.id ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5 ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(voice.id)}
                          disabled={deletingId === voice.id}
                          data-testid={`delete-cloned-${voice.id}`}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          {deletingId === voice.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Clone form modal */}
      <AnimatePresence>
        {showCloneForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCloneForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md bg-[#0c0b14]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <h2 className="text-lg font-semibold text-white">Cloner une voix</h2>
                <button
                  onClick={() => setShowCloneForm(false)}
                  data-testid="clone-modal-close"
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="px-6 pb-6 pt-2 space-y-5">
                {/* Name input */}
                <Input
                  label="Nom de la voix"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Ex: Ma voix pro"
                  data-testid="clone-name-input"
                />

                {/* Drag and drop zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="clone-dropzone"
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                    dragOver
                      ? 'border-violet-500/60 bg-violet-500/5'
                      : cloneFile
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {cloneFile ? (
                    <>
                      <Mic className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm text-emerald-400 font-medium">{cloneFile.name}</p>
                      <p className="text-xs text-white/30 mt-1">
                        {(cloneFile.size / 1024 / 1024).toFixed(1)} Mo
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-white/20 mx-auto mb-2" />
                      <p className="text-sm text-white/50">
                        Glisse un fichier audio ici
                      </p>
                      <p className="text-xs text-white/25 mt-1">
                        MP3, WAV, M4A - 30 secondes minimum
                      </p>
                    </>
                  )}
                </div>

                {cloneFile && (
                  <button
                    onClick={() => setCloneFile(null)}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Retirer le fichier
                  </button>
                )}

                <p className="text-xs text-white/25 leading-relaxed">
                  Pour un meilleur resultat, fournis un enregistrement clair de 30 secondes a 5 minutes sans bruit de fond.
                </p>

                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowCloneForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleClone}
                    loading={cloning}
                    disabled={!cloneName.trim() || !cloneFile}
                    data-testid="clone-submit"
                  >
                    <Mic className="h-4 w-4" />
                    Cloner
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </LoadingTimeout>
  )
}
