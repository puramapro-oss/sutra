'use client'

import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MUSIC_STYLES } from '@/lib/production-constants'
import SectionCard from './SectionCard'
import StepGenerateCard from './StepGenerateCard'

interface MusicStepProps {
  musicStyle: string
  setMusicStyle: (style: string) => void
  status: string
  isGenerating: boolean
  onGenerate: () => void
  generatedData: Record<string, unknown>
}

export default function MusicStep({
  musicStyle,
  setMusicStyle,
  status,
  isGenerating,
  onGenerate,
  generatedData,
}: MusicStepProps) {
  return (
    <div className="space-y-6">
      <SectionCard title="Style musical">
        <div className="flex flex-wrap gap-2">
          {MUSIC_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setMusicStyle(s)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 capitalize',
                musicStyle === s
                  ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </SectionCard>
      <StepGenerateCard
        title="Musique Suno"
        description="Generation de musique de fond instrumentale."
        status={status}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        buttonLabel="Generer la musique"
        buttonIcon={Music}
        disabled={false}
        data={generatedData.music}
      />
    </div>
  )
}
