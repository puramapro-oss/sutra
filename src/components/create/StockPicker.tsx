'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, RefreshCw, ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StockResult {
  id: string
  source: 'pexels' | 'unsplash' | 'coverr'
  type: 'video' | 'photo'
  url: string
  thumbnail: string
  width: number
  height: number
  quality: '1080p' | '4k'
  duration?: number
  author?: string
  pageUrl?: string
}

export interface SceneSelection {
  sceneIndex: number
  sceneText: string
  selected: StockResult | null
  fallbackToAI: boolean
}

interface SceneStockPickerProps {
  sceneIndex: number
  sceneText: string
  keywords: string[]
  orientation: 'landscape' | 'portrait' | 'square'
  selected: StockResult | null
  fallbackToAI: boolean
  onSelect: (result: StockResult | null) => void
  onFallbackAI: () => void
  allowFallback: boolean
}

export function SceneStockPicker({
  sceneIndex,
  sceneText,
  keywords,
  orientation,
  selected,
  fallbackToAI,
  onSelect,
  onFallbackAI,
  allowFallback,
}: SceneStockPickerProps) {
  const [results, setResults] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(keywords.join(' '))

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const res = await fetch('/api/stock/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, orientation, type: 'any' }),
        })
        const data = await res.json()
        const list = (data.results ?? []) as StockResult[]
        setResults(list)
        // Auto-select first 4K if nothing selected yet
        if (!selected && !fallbackToAI && list.length > 0) {
          const first4k = list.find((r) => r.quality === '4k') ?? list[0]
          onSelect(first4k)
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orientation]
  )

  useEffect(() => {
    void search(keywords.join(' '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords.join('|'), orientation])

  return (
    <div
      data-testid={`scene-picker-${sceneIndex}`}
      className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wide">
            Scene {sceneIndex + 1}
          </p>
          <p className="text-sm text-white/80 line-clamp-2 mt-0.5">{sceneText}</p>
        </div>
        {allowFallback && (
          <button
            type="button"
            onClick={onFallbackAI}
            data-testid={`fallback-ai-${sceneIndex}`}
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              fallbackToAI
                ? 'bg-violet-600/25 border-violet-500/50 text-violet-200'
                : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:border-white/[0.15]'
            )}
          >
            <Sparkles className="h-3 w-3" />
            {fallbackToAI ? 'IA active' : 'Generer IA'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void search(query)
            }
          }}
          placeholder="Mots-cles (EN)"
          className="flex-1 px-3 py-2 rounded-lg text-xs text-white/90 bg-white/[0.04] border border-white/[0.06] focus:border-violet-500/50 outline-none"
        />
        <button
          type="button"
          onClick={() => void search(query)}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.15] text-white/70"
          aria-label="Rechercher"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {fallbackToAI ? (
        <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-6 text-center">
          <Sparkles className="h-5 w-5 mx-auto text-violet-300 mb-2" />
          <p className="text-sm text-violet-200">
            Cette scene sera generee par l&apos;IA.
          </p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video rounded-lg bg-white/[0.03] border border-white/[0.04] animate-pulse flex items-center justify-center"
            >
              <Loader2 className="h-4 w-4 text-white/20 animate-spin" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-5 text-center space-y-2">
          <ImageOff className="h-5 w-5 mx-auto text-amber-300" />
          <p className="text-sm text-amber-200">
            Aucun media reel ≥1080p trouve pour cette scene.
          </p>
          {allowFallback && (
            <button
              type="button"
              onClick={onFallbackAI}
              className="text-xs text-violet-300 hover:text-violet-200 underline"
            >
              Generer cette scene en IA
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {results.map((r) => {
            const isSel = selected?.id === r.id
            return (
              <motion.button
                key={r.id}
                type="button"
                data-testid={`stock-item-${r.id}`}
                onClick={() => onSelect(r)}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  'group relative aspect-video rounded-lg overflow-hidden border-2 transition-all',
                  isSel
                    ? 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]'
                    : 'border-transparent hover:border-white/30'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbnail}
                  alt={r.author ?? 'stock'}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-1 flex items-end justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent">
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded',
                      r.quality === '4k'
                        ? 'bg-amber-400 text-black'
                        : 'bg-white/80 text-black'
                    )}
                  >
                    {r.quality.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-white/80 capitalize">{r.source}</span>
                </div>
                {r.type === 'video' && r.duration && (
                  <span className="absolute top-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded">
                    {Math.round(r.duration)}s
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
