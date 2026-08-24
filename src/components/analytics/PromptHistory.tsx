import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { formatRelativeDate } from '@/lib/utils'
import type { VideoRecord } from '@/lib/analytics'

interface PromptHistoryProps {
  videos: VideoRecord[]
  onReuse: (topic: string) => void
}

export default function PromptHistory({ videos, onReuse }: PromptHistoryProps) {
  const [promptSearch, setPromptSearch] = useState('')

  const filteredPrompts = useMemo(() => {
    const prompts = videos
      .map((v) => ({
        id: v.id,
        topic: v.script_data?.topic ?? v.script_data?.title ?? v.title ?? 'Sans titre',
        date: v.created_at,
      }))
      .slice(0, 20)

    if (!promptSearch.trim()) return prompts
    const q = promptSearch.toLowerCase()
    return prompts.filter((p) => p.topic.toLowerCase().includes(q))
  }, [videos, promptSearch])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.65, duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Historique de prompts</h2>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Rechercher un prompt..."
          value={promptSearch}
          onChange={(e) => setPromptSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition-all"
          data-testid="prompt-search"
        />
      </div>
      <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="prompt-history">
        <CardContent className="p-0 divide-y divide-white/[0.04]">
          {filteredPrompts.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              {promptSearch ? 'Aucun prompt correspondant' : 'Aucun prompt enregistre'}
            </p>
          ) : (
            filteredPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{prompt.topic}</p>
                  <p className="text-xs text-white/30 mt-0.5">{formatRelativeDate(prompt.date)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReuse(prompt.topic)}
                  data-testid={`reuse-prompt-${prompt.id}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reutiliser</span>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
