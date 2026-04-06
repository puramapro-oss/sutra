'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Brain } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

interface Memory {
  id: string
  memory_type: 'preference' | 'performance' | 'feedback' | 'trend' | 'learning'
  content: string
  importance: number
  created_at: string
  expires_at: string | null
}

const TYPE_META: Record<Memory['memory_type'], { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'premium' }> = {
  preference: { label: 'Preference', variant: 'info' },
  performance: { label: 'Performance', variant: 'success' },
  feedback: { label: 'Feedback', variant: 'warning' },
  trend: { label: 'Tendance', variant: 'premium' },
  learning: { label: 'Apprentissage', variant: 'success' },
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Memory['memory_type'] | 'all'>('all')
  const [content, setContent] = useState('')
  const [type, setType] = useState<Memory['memory_type']>('preference')
  const [adding, setAdding] = useState(false)

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === 'all' ? '/api/auto/memory' : `/api/auto/memory?type=${filter}`
      const res = await fetch(url)
      const json = await res.json()
      setMemories(json.memories ?? [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchMemories() }, [fetchMemories])

  const handleAdd = useCallback(async () => {
    if (!content.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/auto/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), memory_type: type }),
      })
      const json = await res.json()
      if (json.memory) {
        toast.success('Memoire ajoutee')
        setContent('')
        fetchMemories()
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setAdding(false)
    }
  }, [content, type, fetchMemories])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/auto/memory?id=${id}`, { method: 'DELETE' })
      setMemories((prev) => prev.filter((m) => m.id !== id))
      toast.success('Memoire supprimee')
    } catch {
      toast.error('Erreur')
    }
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Ajouter une preference</h3>
          <div className="flex flex-wrap gap-2">
            {(['preference', 'feedback'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs border transition-all',
                  type === t
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ex: J'aime les couleurs chaudes et les transitions rapides"
            data-testid="memory-input"
          />
          <Button onClick={handleAdd} loading={adding} data-testid="memory-add">
            <Plus className="h-4 w-4" /> Memoriser
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'preference', 'performance', 'feedback', 'trend', 'learning'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            data-testid={`memory-filter-${f}`}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              filter === f
                ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70'
            )}
          >
            {f === 'all' ? 'Toutes' : TYPE_META[f as Memory['memory_type']].label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton width="100%" height={300} rounded="xl" />
      ) : memories.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Aucune memoire"
          description="L'IA accumule ici ses observations, tes preferences et les tendances detectees."
        />
      ) : (
        <div className="space-y-2">
          {memories.map((m) => {
            const meta = TYPE_META[m.memory_type]
            return (
              <Card key={m.id} data-testid={`memory-${m.id}`}>
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                      <span className="text-xs text-white/30">
                        importance {Math.round(m.importance * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-white/80">{m.content}</p>
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(m.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(m.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
