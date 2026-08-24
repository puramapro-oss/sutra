import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Scene, VideoVersion } from '@/types'
import type { SubtitleEntry, HistoryState } from '@/types/editor'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'

type VideoPlayerReturn = ReturnType<typeof useVideoPlayer>

interface EditorHandlersProps {
  videoId: string
  script: string
  scenes: Scene[]
  subtitles: SubtitleEntry[]
  voiceVolume: number
  musicVolume: number
  exportQuality: string
  dragIndex: number | null
  player: VideoPlayerReturn
  setScript: (s: string) => void
  setScenes: (s: Scene[]) => void
  setSubtitles: (s: SubtitleEntry[] | ((prev: SubtitleEntry[]) => SubtitleEntry[])) => void
  setVoiceVolume: (v: number) => void
  setMusicVolume: (v: number) => void
  setDragIndex: (i: number | null) => void
  setExporting: (e: boolean) => void
  pushHistory: (state: HistoryState) => void
}

export function useEditorHandlers({
  videoId,
  script,
  scenes,
  subtitles,
  voiceVolume,
  musicVolume,
  exportQuality,
  dragIndex,
  player,
  setScript,
  setScenes,
  setSubtitles,
  setVoiceVolume,
  setMusicVolume,
  setDragIndex,
  setExporting,
  pushHistory,
}: EditorHandlersProps) {
  // Script changes
  const handleScriptChange = useCallback(
    (value: string) => {
      setScript(value)
      pushHistory({ script: value, scenes, subtitles, voiceVolume, musicVolume })
    },
    [scenes, subtitles, voiceVolume, musicVolume, pushHistory, setScript]
  )

  // Scene reorder
  const handleDragStart = useCallback(
    (index: number) => {
      setDragIndex(index)
    },
    [setDragIndex]
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      if (dragIndex === null || dragIndex === index) return
      const newScenes = [...scenes]
      const [moved] = newScenes.splice(dragIndex, 1)
      newScenes.splice(index, 0, moved)
      setScenes(newScenes)
      setDragIndex(index)
    },
    [dragIndex, scenes, setScenes, setDragIndex]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    pushHistory({ script, scenes, subtitles, voiceVolume, musicVolume })
  }, [script, scenes, subtitles, voiceVolume, musicVolume, pushHistory, setDragIndex])

  // Subtitle editing
  const updateSubtitle = useCallback(
    (id: string, field: 'text' | 'start' | 'end', value: string | number) => {
      setSubtitles((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      )
    },
    [setSubtitles]
  )

  const addSubtitle = useCallback(() => {
    const lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 0
    setSubtitles((prev) => [
      ...prev,
      {
        id: `sub-${Date.now()}`,
        text: '',
        start: lastEnd,
        end: lastEnd + 3,
      },
    ])
  }, [subtitles, setSubtitles])

  const removeSubtitle = useCallback(
    (id: string) => {
      setSubtitles((prev) => prev.filter((s) => s.id !== id))
    },
    [setSubtitles]
  )

  // Export
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/video/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          quality: exportQuality,
          script,
          scenes,
          subtitles,
          voiceVolume,
          musicVolume,
        }),
      })

      if (!res.ok) throw new Error('Export failed')
      toast.success('Export lance avec succes ! Tu seras notifie quand la video sera prete.')
    } catch {
      toast.error("Erreur lors de l&apos;export. Reessaie.")
    } finally {
      setExporting(false)
    }
  }, [videoId, exportQuality, script, scenes, subtitles, voiceVolume, musicVolume, setExporting])

  // Load version
  const loadVersion = useCallback(
    (version: VideoVersion) => {
      toast.success(`Version ${version.version_number} chargee`)
    },
    []
  )

  // Volume handlers
  const handleVoiceVolumeChange = useCallback(
    (v: number) => {
      setVoiceVolume(v)
      pushHistory({ script, scenes, subtitles, voiceVolume: v, musicVolume })
    },
    [script, scenes, subtitles, musicVolume, pushHistory, setVoiceVolume]
  )

  const handleMusicVolumeChange = useCallback(
    (v: number) => {
      setMusicVolume(v)
      pushHistory({ script, scenes, subtitles, voiceVolume, musicVolume: v })
    },
    [script, scenes, subtitles, voiceVolume, pushHistory, setMusicVolume]
  )

  // Scene click handler
  const handleSceneClick = useCallback(
    (index: number) => {
      const offset = scenes.slice(0, index).reduce((a, s) => a + s.duration_seconds, 0)
      player.seekTo(offset)
    },
    [scenes, player]
  )

  return {
    handleScriptChange,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    updateSubtitle,
    addSubtitle,
    removeSubtitle,
    handleExport,
    loadVersion,
    handleVoiceVolumeChange,
    handleMusicVolumeChange,
    handleSceneClick,
  }
}
