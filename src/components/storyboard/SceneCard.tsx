'use client'

import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, X, Clock, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
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
  const promptId = useId()
  const [preview, setPreview] = useState<{ prompt: string; format: VideoFormat } | null>(null)
  const [previewFailed, setPreviewFailed] = useState(false)
  const previewCurrent = preview?.prompt === scene.visual_prompt && preview.format === format

  const requestPreview = () => {
    setPreviewFailed(false)
    setPreview({ prompt: scene.visual_prompt, format })
  }

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
      <div className="px-4 py-2 space-y-2">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
          {previewCurrent && !previewFailed ? (
            <Image
              src={getPollinationsUrl(preview.prompt, preview.format)}
              alt={scene.description || `Scene ${index + 1}`}
              fill
              className="object-cover"
              unoptimized
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-sm text-white/65">
              <ImageIcon className="h-7 w-7" aria-hidden="true" />
              <span>Aperçu du plan</span>
            </div>
          )}
        </div>
        <p className="text-xs text-white/65">Le texte visuel du plan sera envoyé à Pollinations à ta demande.</p>
        <Button onClick={requestPreview} variant="secondary" size="sm" aria-label={`Générer un aperçu du plan ${index + 1}`}>
          Générer un aperçu
        </Button>
        {previewCurrent && previewFailed && <p role="alert" className="text-xs text-red-300">Aperçu indisponible. Tu peux continuer à modifier et exporter ce plan.</p>}
      </div>

      <div className="px-4 pb-2 space-y-1">
        <label htmlFor={promptId} className="block text-xs font-medium text-white/75">Instruction visuelle</label>
        <textarea
          id={promptId}
          value={scene.visual_prompt}
          aria-label={`Instruction visuelle du plan ${index + 1}`}
          onChange={(e) => onUpdate(scene.id, { visual_prompt: e.target.value })}
          rows={3}
          placeholder="Sujet, action, décor, cadrage, lumière…"
          className={cn(
            'w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-white/40 resize-none',
            'focus:outline-none focus:ring-1 focus:ring-violet-500/40',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Description */}
      <div className="px-4 pb-2">
        <textarea
          value={scene.description}
          aria-label={`Description du plan ${index + 1}`}
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
            aria-label={`Durée du plan ${index + 1} en secondes`}
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
          aria-label={`Transition du plan ${index + 1}`}
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
