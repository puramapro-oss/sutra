'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  Download,
  FileText,
  Film,
  Music,
  Subtitles,
  Palette,
  GripVertical,
  Trash2,
  Plus,
  Clock,
  ChevronDown,
  Keyboard,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDate } from '@/lib/utils'
import { PLAN_LIMITS } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Video, VideoVersion, Scene } from '@/types'

const supabase = createClient()

interface SubtitleEntry {
  id: string
  text: string
  start: number
  end: number
}

interface HistoryState {
  script: string
  scenes: Scene[]
  subtitles: SubtitleEntry[]
  voiceVolume: number
  musicVolume: number
}

const QUALITY_OPTIONS = [
  { value: '720p', label: '720p HD', minPlan: 'free' as const },
  { value: '1080p', label: '1080p Full HD', minPlan: 'creator' as const },
  { value: '4k', label: '4K Ultra HD', minPlan: 'empire' as const },
]

const SPEED_OPTIONS = [0.5, 1, 1.5, 2]

const SIDE_TABS = [
  { id: 'script', label: 'Script', icon: FileText },
  { id: 'scenes', label: 'Scenes', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'subtitles', label: 'Sous-titres', icon: Subtitles },
  { id: 'brandkit', label: 'Brand Kit', icon: Palette },
] as const

type SideTab = (typeof SIDE_TABS)[number]['id']

const MAX_HISTORY = 50

export default function EditorPage() {
  const params = useParams()
  const router = useRouter()
  const { profile, plan, loading: authLoading } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoId = params?.id as string

  // Core state
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Player state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Editor state
  const [activeTab, setActiveTab] = useState<SideTab>('script')
  const [script, setScript] = useState('')
  const [scenes, setScenes] = useState<Scene[]>([])
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([])
  const [voiceVolume, setVoiceVolume] = useState(80)
  const [musicVolume, setMusicVolume] = useState(50)
  const [exportQuality, setExportQuality] = useState<string>('1080p')
  const [exporting, setExporting] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<VideoVersion[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // History (undo/redo)
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const pushHistory = useCallback(
    (state: HistoryState) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false
        return
      }
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(state)
        if (newHistory.length > MAX_HISTORY) newHistory.shift()
        return newHistory
      })
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1))
    },
    [historyIndex]
  )

  const undo = useCallback(() => {
    if (!canUndo) return
    isUndoRedoRef.current = true
    const prevState = history[historyIndex - 1]
    setScript(prevState.script)
    setScenes(prevState.scenes)
    setSubtitles(prevState.subtitles)
    setVoiceVolume(prevState.voiceVolume)
    setMusicVolume(prevState.musicVolume)
    setHistoryIndex((prev) => prev - 1)
  }, [canUndo, history, historyIndex])

  const redo = useCallback(() => {
    if (!canRedo) return
    isUndoRedoRef.current = true
    const nextState = history[historyIndex + 1]
    setScript(nextState.script)
    setScenes(nextState.scenes)
    setSubtitles(nextState.subtitles)
    setVoiceVolume(nextState.voiceVolume)
    setMusicVolume(nextState.musicVolume)
    setHistoryIndex((prev) => prev + 1)
  }, [canRedo, history, historyIndex])

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
      setDuration(v.duration ?? 0)

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
  }, [videoId, authLoading, plan, pushHistory])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey

      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (isMeta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === '?' && isMeta) {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Player controls
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((val: number) => {
    if (!videoRef.current) return
    videoRef.current.volume = val
    setVolume(val)
    setIsMuted(val === 0)
  }, [])

  const handleSpeedChange = useCallback((val: number) => {
    if (!videoRef.current) return
    videoRef.current.playbackRate = val
    setSpeed(val)
  }, [])

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
  }, [])

  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }, [])

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
      toast.error("Erreur lors de l'export. Reessaie.")
    } finally {
      setExporting(false)
    }
  }, [videoId, exportQuality, script, scenes, subtitles, voiceVolume, musicVolume])

  // Load version
  const loadVersion = useCallback(
    (version: VideoVersion) => {
      toast.success(`Version ${version.version_number} chargee`)
      setShowVersions(false)
    },
    []
  )

  // Format time mm:ss
  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  // Quality check for plan
  const canUseQuality = useCallback(
    (minPlan: string) => {
      const order = ['free', 'starter', 'creator', 'empire', 'admin']
      return order.indexOf(plan) >= order.indexOf(minPlan)
    },
    [plan]
  )

  // Timeline blocks
  const timelineBlocks = useMemo(() => {
    if (!scenes.length) return []
    const totalDur = scenes.reduce((acc, s) => acc + s.duration_seconds, 0) || 1
    return scenes.map((scene, i) => ({
      scene,
      index: i,
      widthPercent: (scene.duration_seconds / totalDur) * 100,
    }))
  }, [scenes])

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
          description="Cette video n'existe pas ou a ete supprimee."
          action={{
            label: 'Retour au dashboard',
            onClick: () => router.push('/dashboard'),
          }}
          data-testid="editor-not-found"
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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            data-testid="editor-back"
            className="p-2 rounded-xl bg-white/5 border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white" data-testid="editor-title">
              {video.title ?? 'Sans titre'}
            </h1>
            <p className="text-sm text-white/40">Sutra Studio</p>
          </div>
          <Badge variant={video.status === 'ready' ? 'success' : 'default'}>
            {video.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={!canUndo}
            data-testid="editor-undo"
            className={cn(
              'p-2 rounded-xl border border-white/[0.06] transition-colors',
              canUndo ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'
            )}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            data-testid="editor-redo"
            className={cn(
              'p-2 rounded-xl border border-white/[0.06] transition-colors',
              canRedo ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-white/20 cursor-not-allowed'
            )}
            title="Retablir (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          {/* Version history */}
          <div className="relative">
            <button
              onClick={() => setShowVersions((prev) => !prev)}
              data-testid="editor-versions"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Versions</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showVersions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl bg-[#0c0b14]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl overflow-hidden"
                >
                  <div className="p-3 border-b border-white/[0.06]">
                    <p className="text-xs font-medium text-white/50">Historique des versions</p>
                  </div>
                  {versions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-white/30">
                      Aucune version sauvegardee
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {versions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => loadVersion(v)}
                          data-testid={`version-${v.version_number}`}
                          className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/70 hover:bg-white/5 transition-colors"
                        >
                          <span>Version {v.version_number}</span>
                          <span className="text-xs text-white/30">{formatDate(v.created_at)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Shortcuts hint */}
          <button
            onClick={() => setShowShortcuts((prev) => !prev)}
            data-testid="editor-shortcuts"
            className="p-2 rounded-xl bg-white/5 border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Export */}
          <div className="flex items-center gap-2">
            <select
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value)}
              data-testid="editor-quality-select"
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer"
            >
              {QUALITY_OPTIONS.map((q) => (
                <option
                  key={q.value}
                  value={q.value}
                  disabled={!canUseQuality(q.minPlan)}
                  className="bg-[#0c0b14] text-white"
                >
                  {q.label} {!canUseQuality(q.minPlan) ? `(${q.minPlan}+)` : ''}
                </option>
              ))}
            </select>
            <Button
              onClick={handleExport}
              loading={exporting}
              data-testid="editor-export"
              size="md"
            >
              <Download className="h-4 w-4" />
              Exporter la video
            </Button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Raccourcis clavier</h3>
                  <button
                    onClick={() => setShowShortcuts(false)}
                    className="text-white/40 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {[
                    ['Espace', 'Lecture/Pause'],
                    ['Ctrl+Z', 'Annuler'],
                    ['Ctrl+Y', 'Retablir'],
                    ['Ctrl+?', 'Raccourcis'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center gap-2">
                      <kbd className="px-2 py-1 rounded bg-white/5 border border-white/[0.08] text-white/60 font-mono text-[10px]">
                        {key}
                      </kbd>
                      <span className="text-white/40">{desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Preview */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="relative aspect-video bg-black/50 rounded-t-2xl overflow-hidden">
            {video.video_url ? (
              <video
                ref={videoRef}
                src={video.video_url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                data-testid="editor-video"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Film className="h-12 w-12 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">Apercu non disponible</p>
                  <p className="text-xs text-white/25 mt-1">La video est en cours de generation</p>
                </div>
              </div>
            )}

            {/* Play overlay */}
            {video.video_url && !isPlaying && (
              <button
                onClick={togglePlay}
                data-testid="editor-play-overlay"
                className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
              >
                <div className="h-16 w-16 rounded-full bg-violet-600/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="h-7 w-7 text-white ml-1" />
                </div>
              </button>
            )}
          </div>

          {/* Controls bar */}
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-4 flex-wrap">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              data-testid="editor-play-pause"
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            {/* Time */}
            <span className="text-xs text-white/50 font-mono tabular-nums min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Seek bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              data-testid="editor-seek"
              className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
            />

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                data-testid="editor-mute"
                className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                data-testid="editor-volume"
                className="w-20 h-1 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
              />
            </div>

            {/* Speed */}
            <div className="flex items-center gap-1">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  data-testid={`editor-speed-${s}`}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-medium transition-colors',
                    speed === s
                      ? 'bg-violet-500/20 text-violet-400'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <Film className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-medium text-white/50">Timeline</span>
          </div>
          {scenes.length === 0 ? (
            <div className="h-12 flex items-center justify-center text-xs text-white/30">
              Aucune scene
            </div>
          ) : (
            <div className="flex gap-1 h-12 rounded-lg overflow-hidden" data-testid="editor-timeline">
              {timelineBlocks.map(({ scene, index, widthPercent }) => {
                const colors = [
                  'from-violet-600/40 to-violet-500/20',
                  'from-purple-600/40 to-purple-500/20',
                  'from-indigo-600/40 to-indigo-500/20',
                  'from-blue-600/40 to-blue-500/20',
                  'from-cyan-600/40 to-cyan-500/20',
                  'from-fuchsia-600/40 to-fuchsia-500/20',
                ]
                const color = colors[index % colors.length]
                return (
                  <button
                    key={index}
                    onClick={() => {
                      const offset = scenes.slice(0, index).reduce((a, s) => a + s.duration_seconds, 0)
                      seekTo(offset)
                    }}
                    data-testid={`timeline-block-${index}`}
                    className={cn(
                      'relative h-full rounded-md border border-white/[0.08] bg-gradient-to-r transition-all hover:brightness-125 group',
                      color,
                      dragIndex === index && 'ring-2 ring-violet-500'
                    )}
                    style={{ width: `${widthPercent}%`, minWidth: '24px' }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/60 font-mono truncate px-1">
                      {scene.duration_seconds}s
                    </span>
                  </button>
                )
              })}
              {/* Playhead */}
              {duration > 0 && (
                <div
                  className="absolute h-12 w-0.5 bg-violet-400 pointer-events-none z-10"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tabs */}
        <div className="lg:col-span-8">
          <Card>
            <div className="flex border-b border-white/[0.06] overflow-x-auto">
              {SIDE_TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`editor-tab-${tab.id}`}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                      activeTab === tab.id
                        ? 'text-violet-400 border-violet-500'
                        : 'text-white/40 border-transparent hover:text-white/60'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <CardContent>
              {/* Script tab */}
              {activeTab === 'script' && (
                <div data-testid="editor-panel-script">
                  <label className="text-sm font-medium text-white/60 mb-2 block">
                    Narration
                  </label>
                  <textarea
                    value={script}
                    onChange={(e) => handleScriptChange(e.target.value)}
                    data-testid="editor-script-textarea"
                    rows={12}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/90 placeholder-white/30 outline-none resize-y focus:border-violet-500/60 focus:shadow-[0_0_15px_rgba(139,92,246,0.15)] transition-all"
                    placeholder="Ecris ou modifie le script de la narration..."
                  />
                  <p className="text-xs text-white/30 mt-2">
                    {script.split(/\s+/).filter(Boolean).length} mots
                  </p>
                </div>
              )}

              {/* Scenes tab */}
              {activeTab === 'scenes' && (
                <div data-testid="editor-panel-scenes" className="space-y-3">
                  {scenes.length === 0 ? (
                    <div className="py-8 text-center text-sm text-white/30">
                      Aucune scene dans ce projet
                    </div>
                  ) : (
                    scenes.map((scene, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => handleDragStart(i)}
                        onDragOver={(e) => handleDragOver(e, i)}
                        onDragEnd={handleDragEnd}
                        data-testid={`editor-scene-${i}`}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-grab active:cursor-grabbing group',
                          dragIndex === i && 'opacity-50'
                        )}
                      >
                        <div className="flex items-center gap-2 mt-1">
                          <GripVertical className="h-4 w-4 text-white/20 group-hover:text-white/40" />
                          <div className="h-12 w-16 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xs text-white/30 font-mono shrink-0">
                            {i + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70 line-clamp-2">
                            {scene.visual_prompt}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-white/30">
                              {scene.duration_seconds}s
                            </span>
                            <Badge variant={scene.use_stock ? 'info' : 'premium'} size="sm">
                              {scene.use_stock ? 'Stock' : 'IA'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Audio tab */}
              {activeTab === 'audio' && (
                <div data-testid="editor-panel-audio" className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white/60">Volume voix</label>
                      <span className="text-xs text-white/40 font-mono">{voiceVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={voiceVolume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVoiceVolume(v)
                        pushHistory({ script, scenes, subtitles, voiceVolume: v, musicVolume })
                      }}
                      data-testid="editor-voice-volume"
                      className="w-full h-2 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                    />
                  </div>

                  <div className="border-t border-white/[0.06] pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-white/60">Volume musique</label>
                      <span className="text-xs text-white/40 font-mono">{musicVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={musicVolume}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setMusicVolume(v)
                        pushHistory({ script, scenes, subtitles, voiceVolume, musicVolume: v })
                      }}
                      data-testid="editor-music-volume"
                      className="w-full h-2 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Subtitles tab */}
              {activeTab === 'subtitles' && (
                <div data-testid="editor-panel-subtitles" className="space-y-3">
                  {subtitles.length === 0 ? (
                    <div className="py-8 text-center text-sm text-white/30">
                      Aucun sous-titre
                    </div>
                  ) : (
                    subtitles.map((sub) => (
                      <div
                        key={sub.id}
                        data-testid={`editor-subtitle-${sub.id}`}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
                      >
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <input
                            type="number"
                            value={sub.start}
                            onChange={(e) => updateSubtitle(sub.id, 'start', Number(e.target.value))}
                            step={0.1}
                            min={0}
                            className="w-16 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 font-mono outline-none text-center"
                            title="Debut (s)"
                          />
                          <input
                            type="number"
                            value={sub.end}
                            onChange={(e) => updateSubtitle(sub.id, 'end', Number(e.target.value))}
                            step={0.1}
                            min={0}
                            className="w-16 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 font-mono outline-none text-center"
                            title="Fin (s)"
                          />
                        </div>
                        <textarea
                          value={sub.text}
                          onChange={(e) => updateSubtitle(sub.id, 'text', e.target.value)}
                          rows={2}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/20 outline-none resize-none focus:border-violet-500/60 transition-colors"
                          placeholder="Texte du sous-titre..."
                        />
                        <button
                          onClick={() => removeSubtitle(sub.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={addSubtitle}
                    data-testid="editor-add-subtitle"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.08] text-sm text-white/40 hover:text-white/60 hover:border-white/[0.15] transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un sous-titre
                  </button>
                </div>
              )}

              {/* Brand Kit tab */}
              {activeTab === 'brandkit' && (
                <div data-testid="editor-panel-brandkit" className="space-y-4">
                  {profile?.brand_kit ? (
                    <>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        {profile.brand_kit.logo_url ? (
                          <img
                            src={profile.brand_kit.logo_url}
                            alt="Logo"
                            className="h-10 w-10 rounded-lg object-contain"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <Palette className="h-5 w-5 text-violet-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-white/70">Brand Kit actif</p>
                          <p className="text-xs text-white/30">
                            {profile.brand_kit.font ?? 'Police par defaut'}
                          </p>
                        </div>
                        <Badge variant="success" size="sm" className="ml-auto">
                          <Check className="h-3 w-3 mr-1" />
                          Applique
                        </Badge>
                      </div>
                      {profile.brand_kit.colors && (
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-lg border border-white/[0.08]"
                            style={{ backgroundColor: profile.brand_kit.colors.primary }}
                          />
                          <div
                            className="h-8 w-8 rounded-lg border border-white/[0.08]"
                            style={{ backgroundColor: profile.brand_kit.colors.secondary }}
                          />
                          <span className="text-xs text-white/40">Couleurs de marque</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center">
                      <Palette className="h-8 w-8 text-white/20 mx-auto mb-3" />
                      <p className="text-sm text-white/40 mb-3">Aucun Brand Kit configure</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        data-testid="editor-setup-brandkit"
                      >
                        Configurer dans les reglages
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-white mb-3">Informations</h3>
              <div className="space-y-3">
                {[
                  ['Format', video.format ?? '16:9'],
                  ['Qualite', video.quality ?? '1080p'],
                  ['Duree', duration > 0 ? `${Math.round(duration)}s` : '-'],
                  ['Scenes', `${scenes.length}`],
                  ['Statut', video.status],
                  ['Cree le', formatDate(video.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-white/40">{label}</span>
                    <span className="text-white/70">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold text-white mb-3">Export rapide</h3>
              <p className="text-xs text-white/40 mb-4">
                Qualite selectionnee : {exportQuality}
              </p>
              <Button
                onClick={handleExport}
                loading={exporting}
                className="w-full"
                data-testid="editor-export-sidebar"
              >
                <Download className="h-4 w-4" />
                Exporter la video
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
