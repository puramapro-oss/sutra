'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Undo2,
  Redo2,
  Download,
  Clock,
  ChevronDown,
  Keyboard,
  ArrowLeft,
  X,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Video, VideoVersion } from '@/types'
import { QUALITY_OPTIONS } from '@/types/editor'
import { canUseQuality } from '@/lib/editor-utils'

interface EditorHeaderProps {
  video: Video
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  versions: VideoVersion[]
  onLoadVersion: (v: VideoVersion) => void
  exportQuality: string
  onExportQualityChange: (q: string) => void
  exporting: boolean
  onExport: () => void
  plan: string
}

export function EditorHeader({
  video,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  versions,
  onLoadVersion,
  exportQuality,
  onExportQualityChange,
  exporting,
  onExport,
  plan,
}: EditorHeaderProps) {
  const router = useRouter()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  return (
    <>
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
          <button
            onClick={onUndo}
            disabled={!canUndo}
            data-testid="editor-undo"
            className={cn(
              'p-2 rounded-xl border border-white/[0.06] transition-colors',
              canUndo
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-white/20 cursor-not-allowed'
            )}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            data-testid="editor-redo"
            className={cn(
              'p-2 rounded-xl border border-white/[0.06] transition-colors',
              canRedo
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-white/20 cursor-not-allowed'
            )}
            title="Retablir (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>

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
                          onClick={() => onLoadVersion(v)}
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

          <button
            onClick={() => setShowShortcuts((prev) => !prev)}
            data-testid="editor-shortcuts"
            className="p-2 rounded-xl bg-white/5 border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Raccourcis clavier"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <select
              value={exportQuality}
              onChange={(e) => onExportQualityChange(e.target.value)}
              data-testid="editor-quality-select"
              className="px-3 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-sm text-white/80 outline-none appearance-none cursor-pointer"
            >
              {QUALITY_OPTIONS.map((q) => (
                <option
                  key={q.value}
                  value={q.value}
                  disabled={!canUseQuality(plan, q.minPlan)}
                  className="bg-[#0c0b14] text-white"
                >
                  {q.label} {!canUseQuality(plan, q.minPlan) ? `(${q.minPlan}+)` : ''}
                </option>
              ))}
            </select>
            <Button
              onClick={onExport}
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
    </>
  )
}
