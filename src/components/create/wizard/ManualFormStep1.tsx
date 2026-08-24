import { NICHES } from '@/lib/constants'
import { NICHE_LABELS } from '@/lib/create-utils'
import { STYLE_OPTIONS } from '@/lib/create-constants'
import { cn } from '@/lib/utils'
import { OptionSection } from '../CreateHelpers'

interface Props {
  topic: string
  setTopic: (v: string) => void
  niche: string
  setNiche: (v: string) => void
  style: string
  setStyle: (v: string) => void
}

export default function ManualFormStep1({ topic, setTopic, niche, setNiche, style, setStyle }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">Etape 2 — Sujet</h2>
      <textarea data-testid="topic-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Decris le sujet de ta video..." rows={4} className={cn('w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/25', 'bg-white/[0.03] backdrop-blur-xl', 'border border-white/[0.06] hover:border-white/[0.12]', 'focus:border-violet-500/60 outline-none transition-all duration-200 resize-none')} />
      <OptionSection title="Niche">
        <select value={niche} onChange={(e) => setNiche(e.target.value)} className={cn('w-full px-4 py-3 rounded-xl text-sm text-white/90', 'bg-white/[0.03] border border-white/[0.06]', 'focus:border-violet-500/60 outline-none transition-all duration-200', 'appearance-none cursor-pointer')}>
          <option value="" className="bg-[#0c0b14]">Choisir une niche</option>
          {NICHES.map((n) => (<option key={n} value={n} className="bg-[#0c0b14]">{NICHE_LABELS[n] ?? n}</option>))}
        </select>
      </OptionSection>
      <OptionSection title="Style">
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => setStyle(style === opt.id ? '' : opt.id)} className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200', style === opt.id ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70')}>
              <span className="mr-1.5">{opt.emoji}</span>{opt.label}
            </button>
          ))}
        </div>
      </OptionSection>
    </div>
  )
}
