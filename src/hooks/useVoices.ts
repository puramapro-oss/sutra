import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { ClonedVoice } from '@/types'

const supabase = createClient()

export function useVoices(profileId?: string) {
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pending = useRef<AbortController | null>(null)
  const [loadedProfile, setLoadedProfile] = useState<string | undefined>()

  const loadVoices = useCallback(() => {
    if (!profileId) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const current = () => pending.current === controller && !controller.signal.aborted
    return Promise.resolve(supabase
        .from('cloned_voices')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)).then(({ data, error }) => {
      if (!current()) return
      if (error) throw error
      if (data) setClonedVoices(data as ClonedVoice[])
    }).catch(() => {
      if (!current()) return
      setClonedVoices([])
    }).finally(() => {
      if (!current()) return
      setLoadedProfile(profileId)
      setLoading(false)
      pending.current = null
    })
  }, [profileId])

  const fetchVoices = useCallback(() => {
    if (!profileId) return
    setLoading(true)
    return loadVoices()
  }, [profileId, loadVoices])

  useEffect(() => {
    void loadVoices()
    return () => { pending.current?.abort(); pending.current = null }
  }, [loadVoices])

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
  }, [profileId])

  const playPreview = useCallback(
    (id: string, url: string) => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.onended = null
        audioRef.current.onerror = null
        audioRef.current = null
      }

      if (playingId === id) {
        setPlayingId(null)
        return
      }

      const audio = new Audio(url)
      audio.onended = () => { if (audioRef.current === audio) setPlayingId(null) }
      audio.onerror = () => {
        if (audioRef.current !== audio) return
        setPlayingId(null)
        toast.error('Impossible de lire cet audio')
      }
      audioRef.current = audio
      setPlayingId(id)
      void audio.play().catch(() => {
        if (audioRef.current !== audio) return
        setPlayingId(null)
        toast.error('Impossible de lire cet audio')
      })
    },
    [playingId]
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
    clonedVoices: loadedProfile === profileId ? clonedVoices : [],
    setClonedVoices,
    loading: !!profileId && (loading || loadedProfile !== profileId),
    playingId: loadedProfile === profileId ? playingId : null,
    playPreview,
    deleteVoice,
    fetchVoices,
  }
}
