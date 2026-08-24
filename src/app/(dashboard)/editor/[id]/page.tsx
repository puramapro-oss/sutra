'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useVideoPlayer } from '@/hooks/useVideoPlayer'
import { useEditorHandlers } from '@/hooks/useEditorHandlers'
import { PLAN_LIMITS } from '@/lib/constants'
import { EditorLoadingState, EditorNotFoundState } from '@/components/editor/EditorStates'
import { EditorHeader } from '@/components/editor/EditorHeader'
import { VideoPlayerPanel } from '@/components/editor/VideoPlayerPanel'
import { EditorTimeline } from '@/components/editor/EditorTimeline'
import { EditorTabs } from '@/components/editor/EditorTabs'
import { EditorSidebar } from '@/components/editor/EditorSidebar'
import type { Video, VideoVersion, Scene } from '@/types'
import { type SubtitleEntry, type SideTab, type HistoryState } from '@/types/editor'

const supabase = createClient()

export default function EditorPage() {
  const params = useParams()
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

  // Editor handlers (hook)
  const handlers = useEditorHandlers({
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
  })

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


  // Loading state
  if (loading || authLoading) {
    return <EditorLoadingState />
  }

  // Not found
  if (notFound || !video) {
    return <EditorNotFoundState />
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
        onLoadVersion={handlers.loadVersion}
        exportQuality={exportQuality}
        onExportQualityChange={setExportQuality}
        exporting={exporting}
        onExport={handlers.handleExport}
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
        onSceneClick={handlers.handleSceneClick}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <EditorTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          script={script}
          onScriptChange={handlers.handleScriptChange}
          scenes={scenes}
          dragIndex={dragIndex}
          onDragStart={handlers.handleDragStart}
          onDragOver={handlers.handleDragOver}
          onDragEnd={handlers.handleDragEnd}
          subtitles={subtitles}
          onUpdateSubtitle={handlers.updateSubtitle}
          onAddSubtitle={handlers.addSubtitle}
          onRemoveSubtitle={handlers.removeSubtitle}
          voiceVolume={voiceVolume}
          musicVolume={musicVolume}
          onVoiceVolumeChange={handlers.handleVoiceVolumeChange}
          onMusicVolumeChange={handlers.handleMusicVolumeChange}
          profile={profile}
        />

        <EditorSidebar
          video={video}
          scenes={scenes}
          duration={player.duration}
          exportQuality={exportQuality}
          exporting={exporting}
          onExport={handlers.handleExport}
        />
      </div>
    </motion.div>
  )
}
