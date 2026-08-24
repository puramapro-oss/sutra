import { motion } from 'framer-motion'
import { Trash2, Pencil, CheckCircle2, XCircle, Clock, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import type { BatchItem, BatchItemStatus } from '@/types/batch'

const statusConfig: Record<BatchItemStatus, { icon: React.ComponentType<{ className?: string }>; label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  pending: { icon: Clock, label: 'En attente', variant: 'default' },
  generating: { icon: Loader2, label: 'Generation...', variant: 'warning' },
  done: { icon: CheckCircle2, label: 'Termine', variant: 'success' },
  error: { icon: XCircle, label: 'Erreur', variant: 'error' },
}

interface BatchTableRowProps {
  item: BatchItem
  idx: number
  editingId: string | null
  editValue: string
  setEditValue: (value: string) => void
  startEdit: (item: BatchItem) => void
  saveEdit: (id: string) => void
  cancelEdit: () => void
  deleteRow: (id: string) => void
  isProcessing: boolean
}

export default function BatchTableRow({
  item,
  idx,
  editingId,
  editValue,
  setEditValue,
  startEdit,
  saveEdit,
  cancelEdit,
  deleteRow,
  isProcessing,
}: BatchTableRowProps) {
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
                if (e.key === 'Escape') cancelEdit()
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
              onClick={cancelEdit}
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
}
