import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import BatchTableRow from './BatchTableRow'
import type { BatchItem } from '@/types/batch'

interface BatchPreviewTableProps {
  items: BatchItem[]
  totalItems: number
  doneItems: number
  errorItems: number
  completedCount: number
  isProcessing: boolean
  maxItems: number
  editingId: string | null
  editValue: string
  setEditValue: (value: string) => void
  addRow: () => void
  deleteRow: (id: string) => void
  startEdit: (item: BatchItem) => void
  saveEdit: (id: string) => void
  cancelEdit: () => void
}

export default function BatchPreviewTable({
  items,
  totalItems,
  doneItems,
  errorItems,
  completedCount,
  isProcessing,
  maxItems,
  editingId,
  editValue,
  setEditValue,
  addRow,
  deleteRow,
  startEdit,
  saveEdit,
  cancelEdit,
}: BatchPreviewTableProps) {
  if (items.length === 0) return null

  return (
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
            {items.map((item, idx) => (
              <BatchTableRow
                key={item.id}
                item={item}
                idx={idx}
                editingId={editingId}
                editValue={editValue}
                setEditValue={setEditValue}
                startEdit={startEdit}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                deleteRow={deleteRow}
                isProcessing={isProcessing}
              />
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
