import { motion } from 'framer-motion'
import { VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { FORMATS, QUALITIES, planAtLeast } from '@/lib/batch-utils'
import type { GlobalConfig } from '@/types/batch'
import type { Plan } from '@/types'

interface BatchGlobalConfigProps {
  globalConfig: GlobalConfig
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>
  userPlan: Plan
  isProcessing: boolean
}

export default function BatchGlobalConfig({
  globalConfig,
  setGlobalConfig,
  userPlan,
  isProcessing,
}: BatchGlobalConfigProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
    >
      <h2 className="text-sm font-semibold text-white/70 mb-4">Configuration globale</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5">Format</label>
          <select
            value={globalConfig.format}
            onChange={(e) =>
              setGlobalConfig((prev) => ({ ...prev, format: e.target.value as GlobalConfig['format'] }))
            }
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
            disabled={isProcessing}
            data-testid="batch-config-format"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1.5">Qualite</label>
          <select
            value={globalConfig.quality}
            onChange={(e) =>
              setGlobalConfig((prev) => ({ ...prev, quality: e.target.value as GlobalConfig['quality'] }))
            }
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
            disabled={isProcessing}
            data-testid="batch-config-quality"
          >
            {QUALITIES.map((q) => (
              <option key={q.value} value={q.value} disabled={!planAtLeast(userPlan, q.minPlan)}>
                {q.label}
                {!planAtLeast(userPlan, q.minPlan) ? ` (${q.minPlan}+)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1.5">Voix</label>
          <select
            value={globalConfig.voice}
            onChange={(e) =>
              setGlobalConfig((prev) => ({ ...prev, voice: e.target.value }))
            }
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
            disabled={isProcessing}
            data-testid="batch-config-voice"
          >
            {VOICE_STYLES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.gender === 'male' ? 'M' : 'F'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1.5">Moteur video</label>
          <select
            value={globalConfig.engine}
            onChange={(e) =>
              setGlobalConfig((prev) => ({ ...prev, engine: e.target.value }))
            }
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
            disabled={isProcessing}
            data-testid="batch-config-engine"
          >
            {VIDEO_ENGINES.map((eng) => (
              <option
                key={eng.id}
                value={eng.id}
                disabled={!planAtLeast(userPlan, eng.minPlan)}
              >
                {eng.icon} {eng.label}
                {!planAtLeast(userPlan, eng.minPlan) ? ` (${eng.minPlan}+)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  )
}
