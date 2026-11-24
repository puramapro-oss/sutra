import { RefObject, useEffect, useRef, useState } from 'react'
import { Play, Pause, Film, Volume2, VolumeX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/editor-utils'
import { SPEED_OPTIONS } from '@/types/editor'
import type { Video } from '@/types'

interface VideoPlayerPanelProps {
  video: Pick<Video, 'video_url' | 'status' | 'shotstack_json'>
  videoRef: RefObject<HTMLVideoElement | null>
  isPlaying: boolean
  isMuted: boolean
  volume: number
  speed: number
  currentTime: number
  duration: number
  onTogglePlay: () => void
  onToggleMute: () => void
  onVolumeChange: (val: number) => void
  onSpeedChange: (val: number) => void
  onTimeUpdate: () => void
  onLoadedMetadata: () => void
  onSeek: (time: number) => void
  setIsPlaying: (playing: boolean) => void
}

export function VideoPlayerPanel({
  video,
  videoRef,
  isPlaying,
  isMuted,
  volume,
  speed,
  currentTime,
  duration,
  onTogglePlay,
  onToggleMute,
  onVolumeChange,
  onSpeedChange,
  onTimeUpdate,
  onLoadedMetadata,
  onSeek,
  setIsPlaying,
}: VideoPlayerPanelProps) {
  const downloadController = useRef<AbortController | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  useEffect(() => () => downloadController.current?.abort(), [video.video_url])
  const hasMedia = Boolean(video.video_url)
  // Presentation of the persisted server receipt only; this grants no publication rights.
  const proof = video.shotstack_json?.sutraVerification as { url?: unknown; sha256?: unknown } | undefined
  const verified = ['ready', 'published'].includes(video.status) && hasMedia &&
    proof?.url === video.video_url && typeof proof?.sha256 === 'string' && /^[a-f\d]{64}$/.test(proof.sha256)
  const downloadUrl = verified && /^https?:\/\//.test(video.video_url!) ? video.video_url : null
  async function handleDownload() {
    if (!downloadUrl || downloadController.current) return
    const controller = new AbortController()
    downloadController.current = controller
    setDownloading(true)
    setDownloadError(null)
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(downloadUrl, { signal: controller.signal, credentials: 'same-origin' })
      if (!response.ok) throw new Error('download failed')
      const blob = await response.blob()
      if (!blob.size || !blob.type.startsWith('video/')) throw new Error('invalid media')
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
      const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      if (sha256 !== proof?.sha256 || controller.signal.aborted) throw new Error('invalid receipt')
      const url = URL.createObjectURL(blob)
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = 'sutra-video.mp4'
        document.body.appendChild(link)
        link.click()
        link.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      setDownloadError('Téléchargement indisponible ou fichier non validé. Réessaie dans un instant.')
    } finally {
      clearTimeout(timeout)
      downloadController.current = null
      setDownloading(false)
    }
  }
  const unavailable = video.status === 'generating'
    ? 'La video est en cours de generation'
    : video.status === 'failed'
      ? 'La génération a échoué. Aucun fichier final disponible.'
      : video.status === 'draft'
        ? 'Ce brouillon ne contient pas encore de vidéo.'
        : 'Le fichier final est indisponible. Vérifie la bibliothèque ou contacte le support.'
  return (
    <Card>
      <CardContent className="p-0 overflow-hidden">
        <div className="relative aspect-video bg-black/50 rounded-t-2xl overflow-hidden">
          {video.video_url ? (
            <video
              ref={videoRef}
              src={video.video_url}
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={onLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              data-testid="editor-video"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Film className="h-12 w-12 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/70">Apercu non disponible</p>
                <p role="status" className="text-xs text-white/70 mt-1">{unavailable}</p>
              </div>
            </div>
          )}

          {/* Play overlay */}
          {video.video_url && !isPlaying && (
            <button
              onClick={onTogglePlay}
              data-testid="editor-play-overlay"
            aria-label="Lire la vidéo"
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
            disabled={!hasMedia}
            onClick={onTogglePlay}
            data-testid="editor-play-pause"
            aria-label={isPlaying ? "Mettre en pause" : "Lire la vidéo"}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Time */}
          <span className="text-xs text-white/70 font-mono tabular-nums min-w-[80px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Seek bar */}
          <input
            disabled={!hasMedia}
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            data-testid="editor-seek"
            aria-label="Position de lecture"
            className="min-w-0 flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
          />

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              disabled={!hasMedia}
              onClick={onToggleMute}
              data-testid="editor-mute"
              aria-label={isMuted ? "Activer le son" : "Couper le son"}
              className="p-1.5 rounded-lg text-white/70 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              disabled={!hasMedia}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              data-testid="editor-volume"
            aria-label="Volume du lecteur"
              className="w-20 h-1 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
            />
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                disabled={!hasMedia}
                key={s}
                onClick={() => onSpeedChange(s)}
                data-testid={`editor-speed-${s}`}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium transition-colors',
                  speed === s
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-white/70 hover:text-white/70 hover:bg-white/5'
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        {hasMedia && (
          <div className="px-4 pb-4 text-sm text-white/70">
            {downloadUrl ? (
              <button type="button" onClick={handleDownload} disabled={downloading} aria-busy={downloading} data-testid="editor-download"
                className="inline-flex min-h-11 items-center rounded-lg underline underline-offset-4 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
                {downloading ? 'Téléchargement…' : 'Télécharger le fichier'}
              </button>
            ) : <p role="status">Résultat non validé : téléchargement indisponible. Vérifie la bibliothèque ou contacte le support.</p>}
          </div>
            )}
            {downloadError && <p role="alert" className="mt-2">{downloadError}</p>}
      </CardContent>
    </Card>
  )
}
