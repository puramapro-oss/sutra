'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ListVideo,
  FileSpreadsheet,
  Type,
  Plus,
  Trash2,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Pencil,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PLAN_LIMITS, VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Plan } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InputMode = 'text' | 'csv'
type BatchItemStatus = 'pending' | 'generating' | 'done' | 'error'

interface BatchItem {
  id: string
  topic: string
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  style: string
  status: BatchItemStatus
  videoId?: string
  error?: string
}

interface GlobalConfig {
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  voice: string
  engine: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_LIMITS: Record<Plan, number> = {
  free: 2,
  starter: 5,
  creator: 20,
  empire: 9999,
  enterprise: 9999,
  admin: 9999,
}

const FORMATS: { value: '16:9' | '9:16' | '1:1'; label: string }[] = [
  { value: '16:9', label: '16:9 Paysage' },
  { value: '9:16', label: '9:16 Portrait' },
  { value: '1:1', label: '1:1 Carre' },
]

const QUALITIES: { value: '720p' | '1080p' | '4k'; label: string; minPlan: Plan }[] = [
  { value: '720p', label: '720p', minPlan: 'free' },
  { value: '1080p', label: '1080p', minPlan: 'creator' },
  { value: '4k', label: '4K', minPlan: 'empire' },
]

const PLAN_ORDER: Plan[] = ['free', 'starter', 'creator', 'empire', 'enterprise', 'admin']

function planAtLeast(userPlan: Plan, minPlan: Plan): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(minPlan)
}

function generateId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseCSV(text: string): Partial<BatchItem>[] {
  const lines = text.trim().split('\n').filter(Boolean)
  return lines.map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    const item: Partial<BatchItem> = { topic: cols[0] ?? '' }
    if (cols[1] && ['16:9', '9:16', '1:1'].includes(cols[1])) {
      item.format = cols[1] as BatchItem['format']
    }
    if (cols[2] && ['720p', '1080p', '4k'].includes(cols[2])) {
      item.quality = cols[2] as BatchItem['quality']
    }
    if (cols[3]) item.style = cols[3]
    return item
  })
}

const statusConfig: Record<BatchItemStatus, { icon: React.ElementType; label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  pending: { icon: Clock, label: 'En attente', variant: 'default' },
  generating: { icon: Loader2, label: 'Generation...', variant: 'warning' },
  done: { icon: CheckCircle2, label: 'Termine', variant: 'success' },
  error: { icon: XCircle, label: 'Erreur', variant: 'error' },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BatchPage() {
  const { profile, loading: authLoading } = useAuth()
  const userPlan: Plan = profile?.plan ?? 'free'
  const maxItems = BATCH_LIMITS[userPlan]

  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [items, setItems] = useState<BatchItem[]>([])
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    format: '16:9',
    quality: '720p',
    voice: VOICE_STYLES[0].id,
    engine: VIDEO_ENGINES[2].id, // wan-classic (free)
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [completedCount, setCompletedCount] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  // Parse text input into items
  const parseTextInput = useCallback(() => {
    const lines = textInput.trim().split('\n').filter(Boolean)
    const newItems: BatchItem[] = lines.slice(0, maxItems).map((line) => ({
      id: generateId(),
      topic: line.trim(),
      format: globalConfig.format,
      quality: globalConfig.quality,
      style: '',
      status: 'pending' as const,
    }))
    setItems(newItems)
  }, [textInput, globalConfig.format, globalConfig.quality, maxItems])

  // Handle CSV file
  const handleCSVUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result
        if (typeof text !== 'string') return
        const parsed = parseCSV(text)
        const newItems: BatchItem[] = parsed.slice(0, maxItems).map((p) => ({
          id: generateId(),
          topic: p.topic ?? '',
          format: p.format ?? globalConfig.format,
          quality: p.quality ?? globalConfig.quality,
          style: p.style ?? '',
          status: 'pending' as const,
        }))
        setItems(newItems)
      }
      reader.readAsText(file)
      // Reset input so same file can be re-uploaded
      e.target.value = ''
    },
    [globalConfig.format, globalConfig.quality, maxItems]
  )

  // Add empty row
  const addRow = useCallback(() => {
    if (items.length >= maxItems) return
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        topic: '',
        format: globalConfig.format,
        quality: globalConfig.quality,
        style: '',
        status: 'pending',
      },
    ])
  }, [items.length, maxItems, globalConfig.format, globalConfig.quality])

  // Delete row
  const deleteRow = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  // Start inline editing
  const startEdit = useCallback((item: BatchItem) => {
    setEditingId(item.id)
    setEditValue(item.topic)
  }, [])

  // Save inline edit
  const saveEdit = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, topic: editValue } : it))
    )
    setEditingId(null)
    setEditValue('')
  }, [editValue])

  // Process queue sequentially
  const processQueue = useCallback(async () => {
    const validItems = items.filter((it) => it.topic.trim() && it.status !== 'done')
    if (validItems.length === 0) return

    setIsProcessing(true)
    setCompletedCount(0)
    abortRef.current = false

    // Reset statuses
    setItems((prev) =>
      prev.map((it) =>
        it.status === 'done' ? it : { ...it, status: 'pending' as const, error: undefined }
      )
    )

    for (let i = 0; i < validItems.length; i++) {
      if (abortRef.current) break
      const item = validItems[i]
      setCurrentIndex(i)

      // Mark generating
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'generating' as const } : it
        )
      )

      try {
        const res = await fetch('/api/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: item.topic,
            format: item.format,
            quality: item.quality,
            style: item.style || undefined,
            voice: globalConfig.voice,
            engine: globalConfig.engine,
            source: 'batch',
          }),
        })

        if (!res.ok) {
          const err = await res.text().catch(() => 'Erreur serveur')
          throw new Error(err)
        }

        const data = await res.json()

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: 'done' as const, videoId: data?.id ?? data?.videoId }
              : it
          )
        )
        setCompletedCount((prev) => prev + 1)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue'
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'error' as const, error: message } : it
          )
        )
        setCompletedCount((prev) => prev + 1)
      }
    }

    setIsProcessing(false)
    setCurrentIndex(-1)
  }, [items, globalConfig.voice, globalConfig.engine])

  // Stop processing
  const stopProcessing = useCallback(() => {
    abortRef.current = true
  }, [])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const totalItems = items.filter((it) => it.topic.trim()).length
  const doneItems = items.filter((it) => it.status === 'done').length
  const errorItems = items.filter((it) => it.status === 'error').length

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="batch-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <ListVideo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white font-display tracking-tight">
              Generation par lot
            </h1>
            <p className="text-sm text-white/50">
              Genere plusieurs videos d&apos;un coup
            </p>
          </div>
        </div>
        <div className="mt-3">
          <Badge variant="premium" size="sm">
            {userPlan === 'free' ? 'Max 2 videos' : userPlan === 'starter' ? 'Max 5 videos' : userPlan === 'creator' ? 'Max 20 videos' : 'Illimite'}
          </Badge>
        </div>
      </motion.div>

      {/* Input Mode Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setInputMode('text')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              inputMode === 'text'
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'
            )}
            data-testid="batch-mode-text"
          >
            <Type className="w-4 h-4" />
            Mode texte
          </button>
          <button
            onClick={() => setInputMode('csv')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              inputMode === 'csv'
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'
            )}
            data-testid="batch-mode-csv"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Mode CSV
          </button>
        </div>

        <AnimatePresence mode="wait">
          {inputMode === 'text' ? (
            <motion.div
              key="text"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
            >
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Un sujet par ligne (max ${maxItems}):\n\nLes bienfaits de la meditation\nComment investir en bourse en 2026\n5 astuces productivite`}
                className="w-full h-40 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 resize-none"
                data-testid="batch-text-input"
                disabled={isProcessing}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/40">
                  {textInput.trim().split('\n').filter(Boolean).length} / {maxItems} lignes
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={parseTextInput}
                  disabled={!textInput.trim() || isProcessing}
                  data-testid="batch-parse-text"
                >
                  Charger les sujets
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="csv"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 text-white/40 hover:text-white/60 hover:border-violet-500/30 transition-all group"
                disabled={isProcessing}
                data-testid="batch-csv-upload"
              >
                <Upload className="w-8 h-8 group-hover:text-violet-400 transition-colors" />
                <span className="text-sm font-medium">Cliquer pour importer un fichier .csv</span>
                <span className="text-xs text-white/30">
                  Colonnes : sujet, format, qualite, style
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCSVUpload}
                className="hidden"
                data-testid="batch-csv-file-input"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Batch Config */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
      >
        <h2 className="text-sm font-semibold text-white/70 mb-4">Configuration globale</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Format */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Format</label>
            <select
              value={globalConfig.format}
              onChange={(e) =>
                setGlobalConfig((prev) => ({ ...prev, format: e.target.value as GlobalConfig['format'] }))
              }
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
              disabled={isProcessing}
              data-testid="batch-config-format"
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Qualite</label>
            <select
              value={globalConfig.quality}
              onChange={(e) =>
                setGlobalConfig((prev) => ({ ...prev, quality: e.target.value as GlobalConfig['quality'] }))
              }
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
              disabled={isProcessing}
              data-testid="batch-config-quality"
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value} disabled={!planAtLeast(userPlan, q.minPlan)}>
                  {q.label}
                  {!planAtLeast(userPlan, q.minPlan) ? ` (${q.minPlan}+)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Voice */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Voix</label>
            <select
              value={globalConfig.voice}
              onChange={(e) =>
                setGlobalConfig((prev) => ({ ...prev, voice: e.target.value }))
              }
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
              disabled={isProcessing}
              data-testid="batch-config-voice"
            >
              {VOICE_STYLES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.gender === 'male' ? 'M' : 'F'})
                </option>
              ))}
            </select>
          </div>

          {/* Engine */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Moteur video</label>
            <select
              value={globalConfig.engine}
              onChange={(e) =>
                setGlobalConfig((prev) => ({ ...prev, engine: e.target.value }))
              }
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
              disabled={isProcessing}
              data-testid="batch-config-engine"
            >
              {VIDEO_ENGINES.map((eng) => (
                <option
                  key={eng.id}
                  value={eng.id}
                  disabled={!planAtLeast(userPlan, eng.minPlan)}
                >
                  {eng.icon} {eng.label}
                  {!planAtLeast(userPlan, eng.minPlan) ? ` (${eng.minPlan}+)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* Preview Table */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">
              {totalItems} video{totalItems > 1 ? 's' : ''} a generer
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={addRow}
              disabled={items.length >= maxItems || isProcessing}
              data-testid="batch-add-row"
            >
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50">
                  {completedCount} / {totalItems} traites
                </span>
                <span className="text-xs text-white/50">
                  {doneItems} reussi{doneItems > 1 ? 's' : ''}{errorItems > 0 ? `, ${errorItems} erreur${errorItems > 1 ? 's' : ''}` : ''}
                </span>
              </div>
              <ProgressBar
                value={completedCount}
                max={totalItems}
                size="sm"
                data-testid="batch-progress"
              />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="batch-table">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/40">
                  <th className="text-left py-2.5 px-4 font-medium w-10">#</th>
                  <th className="text-left py-2.5 px-4 font-medium">Sujet</th>
                  <th className="text-left py-2.5 px-4 font-medium w-24">Format</th>
                  <th className="text-left py-2.5 px-4 font-medium w-24">Qualite</th>
                  <th className="text-left py-2.5 px-4 font-medium w-28">Statut</th>
                  <th className="py-2.5 px-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const sc = statusConfig[item.status]
                  const StatusIcon = sc.icon

                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        'border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors',
                        item.status === 'generating' && 'bg-violet-500/[0.04]'
                      )}
                    >
                      <td className="py-2.5 px-4 text-white/30 tabular-nums">{idx + 1}</td>
                      <td className="py-2.5 px-4">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(item.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="flex-1 bg-white/[0.05] border border-violet-500/30 rounded-lg px-2 py-1 text-sm text-white/90 focus:outline-none"
                              autoFocus
                              data-testid={`batch-edit-input-${idx}`}
                            />
                            <button
                              onClick={() => saveEdit(item.id)}
                              className="text-violet-400 hover:text-violet-300"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-white/30 hover:text-white/60"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            className="flex items-center gap-2 text-left text-white/80 hover:text-white group w-full"
                            disabled={isProcessing}
                          >
                            <span className="truncate max-w-xs">
                              {item.topic || <span className="text-white/25 italic">Cliquer pour editer</span>}
                            </span>
                            <Pencil className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </button>
                        )}
                        {item.error && (
                          <p className="text-xs text-red-400/70 mt-1 truncate max-w-sm">{item.error}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-white/50">{item.format}</td>
                      <td className="py-2.5 px-4 text-white/50">{item.quality}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant={sc.variant} size="sm">
                          <StatusIcon
                            className={cn(
                              'w-3 h-3 mr-1 inline-block',
                              item.status === 'generating' && 'animate-spin'
                            )}
                          />
                          {sc.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => deleteRow(item.id)}
                          className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-30"
                          disabled={isProcessing}
                          data-testid={`batch-delete-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex items-center justify-between gap-4"
      >
        <Button
          variant="secondary"
          size="md"
          onClick={addRow}
          disabled={items.length >= maxItems || isProcessing}
          data-testid="batch-add-row-bottom"
        >
          <Plus className="w-4 h-4" />
          Ajouter une ligne
        </Button>

        <div className="flex items-center gap-3">
          {isProcessing && (
            <Button
              variant="danger"
              size="md"
              onClick={stopProcessing}
              data-testid="batch-stop"
            >
              Arreter
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={processQueue}
            disabled={totalItems === 0 || isProcessing}
            loading={isProcessing}
            data-testid="batch-generate-all"
          >
            <Play className="w-4 h-4" />
            {isProcessing
              ? `Generation ${completedCount}/${totalItems}...`
              : `Tout generer (${totalItems})`}
          </Button>
        </div>
      </motion.div>

      {/* Summary when done */}
      {!isProcessing && doneItems > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-5 text-center"
          data-testid="batch-summary"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-white/80 font-medium">
            {doneItems} video{doneItems > 1 ? 's' : ''} genere{doneItems > 1 ? 'es' : 'e'} avec succes
            {errorItems > 0 && (
              <span className="text-red-400 ml-1">
                ({errorItems} erreur{errorItems > 1 ? 's' : ''})
              </span>
            )}
          </p>
          <p className="text-xs text-white/40 mt-1">
            Retrouvez vos videos dans la bibliotheque
          </p>
        </motion.div>
      )}
    </div>
  )
}
