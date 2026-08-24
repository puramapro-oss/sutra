'use client'

import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VOICE_STYLES } from '@/lib/constants'
import SectionCard from './SectionCard'
import StepGenerateCard from './StepGenerateCard'

interface VoiceStepProps {
  voice: string
  setVoice: (voice: string) => void
  status: string
  isGenerating: boolean
  onGenerate: () => void
  scriptStatus: string
  generatedData: Record<string, unknown>
}

export default function VoiceStep({
  voice,
  setVoice,
  status,
  isGenerating,
  onGenerate,
  scriptStatus,
  generatedData,
}: VoiceStepProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Voix de narration">
        <div className="mb-4">
          <select
            data-testid="prod-voice-select"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className={cn(
              'w-full px-4 py-3 rounded-xl text-sm text-white/90',
              'bg-white/[0.03] border border-white/[0.06]',
              'focus:border-violet-500/60 outline-none transition-all duration-200',
              'appearance-none cursor-pointer'
            )}
          >
            {VOICE_STYLES.map((v) => (
              <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                {v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})
              </option>
            ))}
          </select>
        </div>
      </SectionCard>
      <StepGenerateCard
        title="Narration ElevenLabs"
        description="Generation de la voix off a partir du script."
        status={status}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        buttonLabel="Generer la narration"
        buttonIcon={Mic}
        disabled={scriptStatus !== 'done'}
        disabledMessage="Genere le script d&apos;abord"
        data={generatedData.voice}
      />
    </div>
  )
}
