import { Film } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import type { Scene } from '@/types'

interface EditorTimelineProps {
  scenes: Scene[]
  currentTime: number
  duration: number
  dragIndex: number | null
  onSceneClick: (index: number) => void
}

export function EditorTimeline({
  scenes,
  currentTime,
  duration,
  dragIndex,
  onSceneClick,
}: EditorTimelineProps) {
  const timelineBlocks = scenes.length
    ? scenes.map((scene, i) => {
        const totalDur = scenes.reduce((acc, s) => acc + s.duration_seconds, 0) || 1
        return {
          scene,
          index: i,
          widthPercent: (scene.duration_seconds / totalDur) * 100,
        }
      })
    : []

  return (
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
          <div className="flex gap-1 h-12 rounded-lg overflow-hidden relative" data-testid="editor-timeline">
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
                  onClick={() => onSceneClick(index)}
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
  )
}
