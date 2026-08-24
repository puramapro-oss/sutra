import { VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { FORMAT_OPTIONS, QUALITY_OPTIONS } from '@/lib/create-constants'
import { cn } from '@/lib/utils'
import { OptionSection, OptionCard } from '../CreateHelpers'
import type { Plan, VideoFormat, VideoQuality } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

interface Props {
  format: VideoFormat
  setFormat: (v: VideoFormat) => void
  quality: VideoQuality
  setQuality: (v: VideoQuality) => void
  engine: VideoEngine
  setEngine: (v: VideoEngine) => void
  voice: string
  setVoice: (v: string) => void
  isQualityAvailable: (plan: Plan) => boolean
  isEngineAvailable: (plan: Plan) => boolean
}

export default function ManualFormStep4({
  format,
  setFormat,
  quality,
  setQuality,
  engine,
  setEngine,
  voice,
  setVoice,
  isQualityAvailable,
  isEngineAvailable,
}: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">Etape 5 — Options</h2>
      <OptionSection title="Format">
        <div className="grid grid-cols-3 gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <OptionCard key={opt.id} selected={format === opt.id} onClick={() => setFormat(opt.id)}>
              {opt.icon}
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-white/40">{opt.desc}</span>
            </OptionCard>
          ))}
        </div>
      </OptionSection>
      <OptionSection title="Qualite">
        <div className="grid grid-cols-3 gap-3">
          {QUALITY_OPTIONS.map((opt) => {
            const available = isQualityAvailable(opt.minPlan)
            return (
              <OptionCard key={opt.id} selected={quality === opt.id} onClick={() => available && setQuality(opt.id)} disabled={!available}>
                <span className="text-sm font-semibold">{opt.label}</span>
                {!available && <span className="text-[10px] text-violet-400">Plan {opt.minPlan}+</span>}
              </OptionCard>
            )
          })}
        </div>
      </OptionSection>
      <OptionSection title="Moteur video">
        <div className="grid grid-cols-3 gap-3">
          {VIDEO_ENGINES.map((eng) => {
            const available = isEngineAvailable(eng.minPlan)
            return (
              <OptionCard key={eng.id} selected={engine === eng.id} onClick={() => available && setEngine(eng.id as VideoEngine)} disabled={!available}>
                <span className="text-lg">{eng.icon}</span>
                <span className="text-sm font-semibold">{eng.label}</span>
                {!available && <span className="text-[10px] text-violet-400">Plan {eng.minPlan}+</span>}
              </OptionCard>
            )
          })}
        </div>
      </OptionSection>
      <OptionSection title="Voix">
        <select value={voice} onChange={(e) => setVoice(e.target.value)} className={cn('w-full px-4 py-3 rounded-xl text-sm text-white/90', 'bg-white/[0.03] border border-white/[0.06]', 'focus:border-violet-500/60 outline-none transition-all duration-200', 'appearance-none cursor-pointer')}>
          {VOICE_STYLES.map((v) => (
            <option key={v.id} value={v.id} className="bg-[#0c0b14]">{v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})</option>
          ))}
        </select>
      </OptionSection>
    </div>
  )
}
