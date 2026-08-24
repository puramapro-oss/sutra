import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

interface BatchSummaryProps {
  isProcessing: boolean
  doneItems: number
  errorItems: number
}

export default function BatchSummary({
  isProcessing,
  doneItems,
  errorItems,
}: BatchSummaryProps) {
  if (isProcessing || doneItems === 0) return null

  return (
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
  )
}
