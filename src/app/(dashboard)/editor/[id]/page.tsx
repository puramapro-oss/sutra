'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Film, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import { cn, formatDate } from '@/lib/utils'
import { PLAN_LIMITS } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { VideoPlayerPanel } from '@/components/editor/VideoPlayerPanel'
import { EditorTimeline } from '@/components/editor/EditorTimeline'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import type { Video, VideoVersion, Scene } from '@/types'
import {
  type SubtitleEntry,
  type SideTab,
  type HistoryState,
  QUALITY_OPTIONS,
  SPEED_OPTIONS,
  SIDE_TABS,
} from '@/types/editor'
import { formatTime, canUseQuality } from '@/lib/editor-utils'

const supabase = createClient()

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const { profile, plan, loading: authLoading } = useAuth()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoId = params?.id as string

  // Core state
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Player controls (hook)
  const player = useVideoPlayer(videoRef)

  // Editor state
  const [activeTab, setActiveTab] = useState<SideTab>('script')
  const [script, setScript] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([])
  const [voiceVolume, setVoiceVolume] = useState(80)
  const [musicVolume, setMusicVolume] = useState(50)
  const [exportQuality, setExportQuality] = useState<string>('1080p')
  const [exporting, setExporting] = useState(false)
  const [versions, setVersions] = useState<VideoVersion[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // History (undo/redo) (hook)
  const { pushHistory, undo, redo, canUndo, canRedo } = useEditorHistory()

  // Apply undo/redo state
  const applyHistoryState = useCallback(
    (state: HistoryState | null) => {
      if (!state) return
      setScript(state.script)
      setScenes(state.scenes)
      setSubtitles(state.subtitles)
      setVoiceVolume(state.voiceVolume)
      setMusicVolume(state.musicVolume)
    },
    []
  )

  const handleUndo = useCallback(() => {
    const prevState = undo()
    applyHistoryState(prevState)
  }, [undo, applyHistoryState])

  const handleRedo = useCallback(() => {
    const nextState = redo()
    applyHistoryState(nextState)
  }, [redo, applyHistoryState])

  // Fetch video
  useEffect(() => {
    if (!videoId || authLoading) return

    async function fetchVideo() {
      setLoading(true)
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const v = data as Video
      setVideo(v)
      setScript(v.script_data?.narration ?? '')
      setScenes(v.script_data?.scenes ?? [])
      player.setDuration(v.duration ?? 0)

      // Generate subtitle entries from narration
      const narration = v.script_data?.narration ?? ''
      if (narration) {
        const sentences = narration.split(/[.!?]+/).filter((s) => s.trim())
        const totalDur = v.duration ?? sentences.length * 4
        const perSentence = totalDur / Math.max(sentences.length, 1)
        setSubtitles(
          sentences.map((s, i) => ({
            id: `sub-${i}`,
            text: s.trim(),
            start: Math.round(i * perSentence * 10) / 10,
            end: Math.round((i + 1) * perSentence * 10) / 10,
          }))
        )
      }

      // Determine max quality for plan
      const limits = PLAN_LIMITS[plan]
      if (limits.quality === '720p') setExportQuality('720p')
      else if (limits.quality === '1080p') setExportQuality('1080p')
      else setExportQuality('4k')

      // Push initial history
      pushHistory({
        script: v.script_data?.narration ?? '',
        scenes: v.script_data?.scenes ?? [],
        subtitles: [],
        voiceVolume: 80,
        musicVolume: 50,
      })

      // Fetch versions
      const { data: vData } = await supabase
        .from('video_versions')
        .select('*')
        .eq('video_id', videoId)
        .order('version_number', { ascending: false })

      if (vData) setVersions(vData as VideoVersion[])
      setLoading(false)
    }

    fetchVideo()
  }, [videoId, authLoading, plan, pushHistory, player])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if (isMeta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        player.togglePlay()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo, player])

  // Script changes
  const handleScriptChange = useCallback(
    (value: string) => {
      setScript(value)
      pushHistory({ script: value, scenes, subtitles, voiceVolume, musicVolume })
    },
    [scenes, subtitles, voiceVolume, musicVolume, pushHistory]
  )

  // Scene reorder (basic drag)
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index)
  }, [])

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
    [dragIndex, scenes]
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    pushHistory({ script, scenes, subtitles, voiceVolume, musicVolume })
  }, [script, scenes, subtitles, voiceVolume, musicVolume, pushHistory])

  // Subtitle editing
  const updateSubtitle = useCallback(
    (id: string, field: 'text' | 'start' | 'end', value: string | number) => {
      setSubtitles((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
      )
    },
    []
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
  }, [subtitles])

  const removeSubtitle = useCallback((id: string) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id))
  }, [])

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
  }, [videoId, exportQuality, script, scenes, subtitles, voiceVolume, musicVolume])

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
    [script, scenes, subtitles, musicVolume, pushHistory]
  )

  const handleMusicVolumeChange = useCallback(
    (v: number) => {
      setMusicVolume(v)
      pushHistory({ script, scenes, subtitles, voiceVolume, musicVolume: v })
    },
    [script, scenes, subtitles, voiceVolume, pushHistory]
  )

  // Scene click handler
  const handleSceneClick = useCallback(
    (index: number) => {
      const offset = scenes.slice(0, index).reduce((a, s) => a + s.duration_seconds, 0)
      player.seekTo(offset)
    },
    [scenes, player]
  )

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="space-y-6" data-testid="editor-loading">
        <div className="flex items-center gap-4">
          <Skeleton width={40} height={40} rounded="lg" />
          <Skeleton width={300} height={28} rounded="lg" />
        </div>
        <Skeleton width="100%" height={400} rounded="xl" />
        <Skeleton width="100%" height={80} rounded="xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton width="100%" height={300} rounded="xl" />
          </div>
          <Skeleton width="100%" height={300} rounded="xl" />
        </div>
      </div>
    )
  }

  // Not found
  if (notFound || !video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={AlertCircle}
          title="Video introuvable"
          description="Cette video n&apos;existe pas ou a ete supprimee."
          action={{
            label: 'Retour au dashboard',
            onClick: () => router.push('/dashboard'),
          }}
        />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-[1600px] mx-auto"
    >
      <EditorHeader
        video={video}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        versions={versions}
        onLoadVersion={loadVersion}
        exportQuality={exportQuality}
        onExportQualityChange={setExportQuality}
        exporting={exporting}
        onExport={handleExport}
        plan={plan}
      />

      <VideoPlayerPanel
        video={video}
        videoRef={videoRef}
        isPlaying={player.isPlaying}
        isMuted={player.isMuted}
        volume={player.volume}
        speed={player.speed}
        currentTime={player.currentTime}
        duration={player.duration}
        onTogglePlay={player.togglePlay}
        onToggleMute={player.toggleMute}
        onVolumeChange={player.handleVolumeChange}
        onSpeedChange={player.handleSpeedChange}
        onTimeUpdate={player.handleTimeUpdate}
        onLoadedMetadata={player.handleLoadedMetadata}
        onSeek={player.seekTo}
        setIsPlaying={player.setIsPlaying}
      />

      <EditorTimeline
        scenes={scenes}
        currentTime={player.currentTime}
        duration={player.duration}
        dragIndex={dragIndex}
        onSceneClick={handleSceneClick}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <EditorTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          script={script}
          onScriptChange={handleScriptChange}
          scenes={scenes}
          dragIndex={dragIndex}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          subtitles={subtitles}
          onUpdateSubtitle={updateSubtitle}
          onAddSubtitle={addSubtitle}
          onRemoveSubtitle={removeSubtitle}
          voiceVolume={voiceVolume}
          musicVolume={musicVolume}
          onVoiceVolumeChange={handleVoiceVolumeChange}
          onMusicVolumeChange={handleMusicVolumeChange}
          profile={profile}
        />

        <EditorSidebar
          video={video}
          scenes={scenes}
          duration={player.duration}
          exportQuality={exportQuality}
          exporting={exporting}
          onExport={handleExport}
        />
      </div>
    </motion.div>
  )
}
