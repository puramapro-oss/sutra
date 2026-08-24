'use client'

import { Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import SectionCard from './SectionCard'

interface ScriptStepProps {
  status: string
  generatedData: Record<string, unknown>
  idea: string
  isGenerating: boolean
  onGenerate: () => void
  selectedTemplateName: string
}

export default function ScriptStep({
  status,
  generatedData,
  idea,
  isGenerating,
  onGenerate,
  selectedTemplateName,
}: ScriptStepProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Script genere par Claude">
        {status === 'done' && generatedData.script ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono">
                {typeof generatedData.script === 'object'
                  ? JSON.stringify(generatedData.script, null, 2)
                  : String(generatedData.script)}
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerate}
            >
              Regenerer le script
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-white/40 mb-4">
              Claude va ecrire un script complet base sur ton idee et le template {selectedTemplateName}.
            </p>
            <Button
              data-testid="generate-script"
              variant="primary"
              size="lg"
              disabled={!idea.trim() || isGenerating}
              onClick={onGenerate}
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generer le script
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
