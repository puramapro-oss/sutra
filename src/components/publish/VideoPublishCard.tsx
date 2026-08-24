'use client'

import {
  Send,
  Calendar,
  Clock,
  Video,
  Globe,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Video as VideoType } from '@/types'
import type { PublishResult } from '@/lib/zernio'
import type { PublishVideoState } from '@/hooks/usePublish'
import { PLATFORMS, type PlatformId } from './constants'

interface VideoPublishCardProps {
  video: VideoType
  state: PublishVideoState
  publishing: boolean
  zernioResults?: PublishResult[]
  onTogglePlatform: (platform: PlatformId) => void
  onSetScheduleDate: (date: string) => void
  onToggleZernio: () => void
  onSchedule: () => void
  onPublishNow: () => void
}

export default function VideoPublishCard({
  video,
  state,
  publishing,
  zernioResults,
  onTogglePlatform,
  onSetScheduleDate,
  onToggleZernio,
  onSchedule,
  onPublishNow,
}: VideoPublishCardProps) {
  return (
    <Card data-testid={`publish-video-${video.id}`}>
      <CardContent className="py-4">
        <div className="flex flex-col gap-4">
          {/* Top row: thumbnail + info + Zernio toggle */}
          <div className="flex items-center gap-3">
            <div className="h-14 w-20 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 overflow-hidden">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title ?? 'Video'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Video className="h-5 w-5 text-white/20" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {video.title ?? 'Sans titre'}
              </p>
              <p className="text-xs text-white/30">
                {video.duration ? `${Math.round(video.duration)}s` : ''} {video.quality}
              </p>
            </div>
            {/* Zernio toggle */}
            <button
              onClick={onToggleZernio}
              data-testid={`toggle-zernio-${video.id}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                state.useZernio
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Zernio
            </button>
          </div>

          {/* Platform toggles */}
          <div className="flex items-center gap-2 flex-wrap">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon
              const active = state.platforms[platform.id]
              return (
                <button
                  key={platform.id}
                  onClick={() => onTogglePlatform(platform.id)}
                  data-testid={`toggle-${platform.id}-${video.id}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    active
                      ? platform.color
                      : 'bg-white/[0.02] border-white/[0.06] text-white/30 hover:text-white/50'
                  )}
                >
                  <Icon />
                  <span className="hidden sm:inline">{platform.label}</span>
                </button>
              )
            })}
          </div>

          {/* Schedule date + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white/30" />
              <input
                type="datetime-local"
                value={state.scheduledAt}
                onChange={(e) => onSetScheduleDate(e.target.value)}
                data-testid={`schedule-date-${video.id}`}
                className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 outline-none focus:border-violet-500/60 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                variant="secondary"
                size="sm"
                onClick={onSchedule}
                disabled={publishing}
                data-testid={`schedule-btn-${video.id}`}
              >
                <Clock className="h-3.5 w-3.5" />
                Programmer
              </Button>
              <Button
                size="sm"
                onClick={onPublishNow}
                loading={publishing}
                data-testid={`publish-btn-${video.id}`}
              >
                <Send className="h-3.5 w-3.5" />
                Publier maintenant
              </Button>
            </div>
          </div>

          {/* Zernio results feedback */}
          {zernioResults && zernioResults.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {zernioResults.map((r, i) => (
                <Badge
                  key={`${r.platform}-${i}`}
                  variant={r.success ? 'success' : 'error'}
                  size="sm"
                >
                  {r.success ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {r.platform}
                  {r.postUrl && (
                    <a
                      href={r.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Voir
                    </a>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
