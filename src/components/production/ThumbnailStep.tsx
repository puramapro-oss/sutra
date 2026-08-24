'use client'

import { motion } from 'framer-motion'
import { ImageIcon, Play, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import StepGenerateCard from './StepGenerateCard'

interface ThumbnailStepProps {
  status: string
  isGenerating: boolean
  onGenerate: () => void
  assemblyStatus: string
  generatedData: Record<string, unknown>
  onViewLibrary: () => void
  onPublish: () => void
}

export default function ThumbnailStep({
  status,
  isGenerating,
  onGenerate,
  assemblyStatus,
  generatedData,
  onViewLibrary,
  onPublish,
}: ThumbnailStepProps) {
  return (
    <div className="space-y-6">
      <StepGenerateCard
        title="Miniature — Pollinations"
        description="Generation d&apos;une miniature attractive pour ta video."
        status={status}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        buttonLabel="Generer la miniature"
        buttonIcon={ImageIcon}
        disabled={assemblyStatus !== 'done'}
        disabledMessage="Assemble la video d&apos;abord"
        data={generatedData.thumbnail}
      />

      {status === 'done' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center pt-4"
        >
          <Button
            variant="primary"
            size="lg"
            onClick={onViewLibrary}
          >
            <Play className="h-4 w-4" />
            Voir dans ma bibliotheque
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onPublish}
          >
            <Download className="h-4 w-4" />
            Publier
          </Button>
        </motion.div>
      )}
    </div>
  )
}
