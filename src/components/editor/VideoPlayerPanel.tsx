import { RefObject } from 'react'
import { Play, Pause, Film, Volume2, VolumeX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/editor-utils'
import { SPEED_OPTIONS } from '@/types/editor'

interface VideoPlayerPanelProps {
  video: { video_url?: string | null }
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
                <p className="text-sm text-white/40">Apercu non disponible</p>
                <p className="text-xs text-white/25 mt-1">La video est en cours de generation</p>
              </div>
            </div>
          )}

          {/* Play overlay */}
          {video.video_url && !isPlaying && (
            <button
              onClick={onTogglePlay}
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
            onClick={onTogglePlay}
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
            onChange={(e) => onSeek(Number(e.target.value))}
            data-testid="editor-seek"
            className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
          />

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
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
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              data-testid="editor-volume"
              className="w-20 h-1 rounded-full appearance-none bg-white/10 accent-violet-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
            />
          </div>

          {/* Speed */}
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
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
  )
}
