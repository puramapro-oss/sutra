import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { ClonedVoice } from '@/types'

const supabase = createClient()

export function useVoices(profileId?: string) {
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

  const fetchVoices = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })

      if (data) setClonedVoices(data as ClonedVoice[])
    } catch {
      setClonedVoices([])
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    if (profileId) fetchVoices()
  }, [profileId, fetchVoices])

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

  const deleteVoice = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('cloned_voices').delete().eq('id', id)
      if (error) throw error
      setClonedVoices((prev) => prev.filter((v) => v.id !== id))
      toast.success('Voix supprimée')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }, [])

  return {
    clonedVoices,
    setClonedVoices,
    loading,
    playingId,
    playPreview,
    deleteVoice,
    fetchVoices,
  }
}
