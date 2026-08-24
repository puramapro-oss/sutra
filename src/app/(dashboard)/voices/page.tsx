'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Upload, Plus, Crown, X, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useVoices } from '@/hooks/useVoices'
import { cn } from '@/lib/utils'
import { PLAN_LIMITS, VOICE_STYLES } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { VoiceCard } from '@/components/voices/VoiceCard'

export default function VoicesPage() {
  const router = useRouter()
  const { profile, plan, loading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { clonedVoices, setClonedVoices, loading, playingId, playPreview, deleteVoice, fetchVoices } =
    useVoices(profile?.id)

  const [showCloneForm, setShowCloneForm] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneFile, setCloneFile] = useState<File | null>(null)
  const [cloning, setCloning] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const limits = PLAN_LIMITS[plan]
  const canClone = limits.voices > 0
  const hasReachedLimit = clonedVoices.length >= limits.voices

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

  const handleClone = useCallback(async () => {
    if (!cloneName.trim() || !cloneFile || hasReachedLimit) {
      toast.error(!cloneName.trim() ? 'Donne un nom a ta voix' : !cloneFile ? 'Ajoute un fichier audio' : 'Limite atteinte')
      return
    }

    setCloning(true)
    try {
      const formData = new FormData()
      formData.append('audio', cloneFile)
      formData.append('name', cloneName.trim())

      const res = await fetch('/api/voices/clone', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()

      const { voice } = await res.json()
      setClonedVoices((prev) => [voice, ...prev])
      setShowCloneForm(false)
      setCloneName('')
      setCloneFile(null)
      toast.success('Voix clonée avec succès')
    } catch {
      toast.error('Erreur lors du clonage')
    } finally {
      setCloning(false)
    }
  }, [cloneName, cloneFile, hasReachedLimit, setClonedVoices])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    await deleteVoice(id)
    setDeletingId(null)
  }, [deleteVoice])

  const voicesSkeleton = (
    <div className="space-y-6">
      <Skeleton width={200} height={36} rounded="lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={180} rounded="xl" />
        ))}
      </div>
    </div>
  )

  if (authLoading) return voicesSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchVoices} skeleton={voicesSkeleton}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Voix</h1>
            <p className="text-sm text-white/40 mt-1">Clone ta voix ou utilise nos {VOICE_STYLES.length} voix IA ultra-réalistes</p>
          </div>
          {canClone && (
            <Button onClick={() => setShowCloneForm(true)} disabled={hasReachedLimit}>
              <Plus className="h-4 w-4" />
              Cloner ma voix
              {!hasReachedLimit && <Badge variant="success" size="sm" className="ml-2">{clonedVoices.length}/{limits.voices}</Badge>}
            </Button>
          )}
        </div>

        {!canClone && (
          <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/90">Clonage de voix réservé aux abonnés Premium</p>
                  <p className="text-xs text-white/40 mt-1">Passe Premium pour cloner ta voix et créer des vidéos ultra-personnalisées</p>
                </div>
                <Button size="sm" onClick={() => router.push('/pricing')}>Voir Premium <ArrowRight className="h-3.5 w-3.5" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section>
          <h2 className="text-sm font-semibold text-white/70 mb-4">Mes voix clonées</h2>
          {clonedVoices.length === 0 ? (
            <EmptyState icon={Mic} title="Aucune voix clonée" description="Clone ta voix pour créer des vidéos avec ta propre voix" action={canClone ? { label: 'Cloner ma voix', onClick: () => setShowCloneForm(true) } : undefined} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clonedVoices.map((voice, i) => (
                <VoiceCard key={voice.id} voice={voice} index={i} isPremium={plan !== 'free'} isPlaying={playingId === voice.id} isDeleting={deletingId === voice.id} onPlay={playPreview} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>

        <AnimatePresence>
          {showCloneForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !cloning && setShowCloneForm(false)}>
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Cloner ma voix</h3>
                      <button onClick={() => !cloning && setShowCloneForm(false)} className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
                    </div>
                    <Input label="Nom de la voix" value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="Ma voix" disabled={cloning} />
                    <div onDrop={handleFileDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} className={cn("mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors", dragOver ? "border-violet-500/50 bg-violet-500/5" : "border-white/10 hover:border-white/20")} onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-8 w-8 text-white/30 mx-auto mb-2" />
                      <p className="text-sm text-white/60">{cloneFile ? cloneFile.name : "Dépose un fichier audio ou clique pour sélectionner"}</p>
                      <p className="text-xs text-white/30 mt-1">MP3, WAV</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav" onChange={handleFileSelect} className="hidden" />
                    <div className="flex gap-3 mt-6">
                      <Button variant="secondary" onClick={() => setShowCloneForm(false)} disabled={cloning} className="flex-1">Annuler</Button>
                      <Button onClick={handleClone} disabled={cloning || !cloneName.trim() || !cloneFile} className="flex-1">{cloning ? <><Loader2 className="h-4 w-4 animate-spin" /> Clonage...</> : 'Cloner'}</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </LoadingTimeout>
  )
}
