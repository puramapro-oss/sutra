import { useState, useCallback, useRef } from 'react'
import type { InputMode, BatchItem, GlobalConfig } from '@/types/batch'
import type { Plan } from '@/types'
import { BATCH_LIMITS, generateId, parseCSV } from '@/lib/batch-utils'
import { VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'

export function useBatch(userPlan: Plan) {
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
      e.target.value = ''
    },
    [globalConfig.format, globalConfig.quality, maxItems]
  )

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

  const deleteRow = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const startEdit = useCallback((item: BatchItem) => {
    setEditingId(item.id)
    setEditValue(item.topic)
  }, [])

  const saveEdit = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, topic: editValue } : it))
    )
    setEditingId(null)
    setEditValue('')
  }, [editValue])

  const processQueue = useCallback(async () => {
    const validItems = items.filter((it) => it.topic.trim() && it.status !== 'done')
    if (validItems.length === 0) return

    setIsProcessing(true)
    setCompletedCount(0)
    abortRef.current = false

    setItems((prev) =>
      prev.map((it) =>
        it.status === 'done' ? it : { ...it, status: 'pending' as const, error: undefined }
      )
    )

    for (let i = 0; i < validItems.length; i++) {
      if (abortRef.current) break
      const item = validItems[i]
      setCurrentIndex(i)

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

  const stopProcessing = useCallback(() => {
    abortRef.current = true
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValue('')
  }, [])

  return {
    inputMode,
    setInputMode,
    textInput,
    setTextInput,
    items,
    setItems,
    globalConfig,
    setGlobalConfig,
    isProcessing,
    currentIndex,
    completedCount,
    editingId,
    editValue,
    setEditValue,
    fileInputRef,
    maxItems,
    parseTextInput,
    handleCSVUpload,
    addRow,
    deleteRow,
    startEdit,
    saveEdit,
    cancelEdit,
    processQueue,
    stopProcessing,
  }
}
