import { motion } from 'framer-motion'
import { GripVertical, X, Clock } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Scene, TRANSITIONS, VideoFormat, getPollinationsUrl } from '@/lib/storyboard'

interface SceneCardProps {
  scene: Scene
  index: number
  format: VideoFormat
  dragIndex: number | null
  onDragStart: (idx: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (idx: number) => void
  onUpdate: (id: string, patch: Partial<Scene>) => void
  onDelete: (id: string) => void
}

export default function SceneCard({
  scene,
  index,
  format,
  dragIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onUpdate,
  onDelete,
}: SceneCardProps) {
  return (
    <motion.div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      className={cn(
        'bg-white/[0.02] border rounded-xl backdrop-blur-xl overflow-hidden',
        'transition-all duration-200 group',
        dragIndex === index
          ? 'border-violet-500/60 opacity-50 scale-95'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      layout
    >
      {/* Scene header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div
            className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors"
            title="Glisser pour reorganiser"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="bg-violet-500/20 text-violet-300 text-xs font-bold px-2.5 py-1 rounded-lg">
            Scene {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(scene.id)}
          className="text-white/20 hover:text-red-400 transition-colors p-1"
          aria-label={`Supprimer scene ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview image */}
      <div className="px-4 py-2">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
          <Image
            src={getPollinationsUrl(scene.visual_prompt, format)}
            alt={scene.description || `Scene ${index + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pb-2">
        <textarea
          value={scene.description}
          onChange={(e) => onUpdate(scene.id, { description: e.target.value })}
          rows={2}
          className={cn(
            'w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-white/30 resize-none',
            'focus:outline-none focus:ring-1 focus:ring-violet-500/40',
            'transition-all duration-200'
          )}
          placeholder="Description de la scene..."
        />
      </div>

      {/* Duration + Transition */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-white/40" />
          <input
            type="number"
            min={1}
            max={120}
            value={scene.duration_seconds}
            onChange={(e) =>
              onUpdate(scene.id, {
                duration_seconds: Math.max(1, Math.min(120, parseInt(e.target.value) || 1)),
              })
            }
            className={cn(
              'w-14 bg-white/5 border border-white/[0.06] rounded-lg px-2 py-1',
              'text-xs text-white text-center',
              'focus:outline-none focus:ring-1 focus:ring-violet-500/40'
            )}
          />
          <span className="text-xs text-white/40">s</span>
        </div>

        <select
          value={scene.transition}
          onChange={(e) =>
            onUpdate(scene.id, {
              transition: e.target.value as Scene['transition'],
            })
          }
          className={cn(
            'bg-white/5 border border-white/[0.06] rounded-lg px-2 py-1',
            'text-xs text-white',
            'focus:outline-none focus:ring-1 focus:ring-violet-500/40',
            'appearance-none cursor-pointer'
          )}
        >
          {TRANSITIONS.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#1a1a2e] text-white">
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </motion.div>
  )
}
