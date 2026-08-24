import { motion } from 'framer-motion'
import { Plus, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BatchActionsProps {
  totalItems: number
  completedCount: number
  isProcessing: boolean
  maxItems: number
  itemsLength: number
  addRow: () => void
  stopProcessing: () => void
  processQueue: () => void
}

export default function BatchActions({
  totalItems,
  completedCount,
  isProcessing,
  maxItems,
  itemsLength,
  addRow,
  stopProcessing,
  processQueue,
}: BatchActionsProps) {
  return (
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
        disabled={itemsLength >= maxItems || isProcessing}
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
  )
}
