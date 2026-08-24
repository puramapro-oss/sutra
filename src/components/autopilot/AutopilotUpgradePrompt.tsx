'use client'

import { motion } from 'framer-motion'
import { Crown, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'

export default function AutopilotUpgradePrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="text-center py-16">
        <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
          <Crown className="h-7 w-7 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2" data-testid="autopilot-upgrade-title">
          Autopilot est disponible a partir du plan Creator
        </h1>
        <p className="text-sm text-white/40 max-w-md mx-auto mb-6">
          Programme des series de videos automatiques qui se publient toutes seules sur tes reseaux.
        </p>
        <Button
          onClick={() => window.location.assign('/pricing')}
          data-testid="autopilot-upgrade"
        >
          <Crown className="h-4 w-4" />
          Passer a Creator
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}
