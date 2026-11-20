import { AnimatePresence, motion } from 'framer-motion'
import { Zap, Check, MessageSquare, Hash, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { ToggleRow } from './ToggleRow'
import { AccountSelection } from './AccountSelection'
import { isAccountAvailable, type SocialAccount } from './accounts'

export interface AutopilotConfig {
  enabled: boolean
  default_platforms: string[]
  publish_account_ids: string[]
  auto_caption: boolean
  auto_hashtags: boolean
  caption_style: 'engaging' | 'professional' | 'casual' | 'educational' | 'humorous'
  max_hashtags: number
  include_cta: boolean
}

export interface AutopilotSectionProps {
  config: AutopilotConfig | null
  accounts: SocialAccount[]
  savingAutopilot: boolean
  onUpdateConfig: <K extends keyof AutopilotConfig>(key: K, value: AutopilotConfig[K]) => void
  onToggleAccount: (accountId: string) => void
  onSave: () => void
}

export function AutopilotSection({
  config,
  accounts,
  savingAutopilot,
  onUpdateConfig,
  onToggleAccount,
  onSave,
}: AutopilotSectionProps) {
  const unavailableSelection = config?.publish_account_ids.some(id => !accounts.some(account => account.id === id && isAccountAvailable(account))) ?? false
  const missingSelection = config?.enabled && config.publish_account_ids.length === 0
  return (
    <motion.div
      id="autopilot"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="mt-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Autopilot IA</h2>
            <p className="text-sm text-white/60">
              Publication automatique sur les comptes choisis, avec légendes et hashtags.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onUpdateConfig('enabled', !(config?.enabled ?? false))}
          data-testid="toggle-autopilot"
          disabled={!config || savingAutopilot}
          role="switch"
          aria-checked={config?.enabled ?? false}
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0',
            config?.enabled ? 'bg-violet-500' : 'bg-white/10'
          )}
          aria-label="Activer l’autopilot"
        >
          <motion.span
            animate={{ x: config?.enabled ? 22 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {config?.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <fieldset disabled={savingAutopilot} className="min-w-0 space-y-6 pt-2">
              <legend className="sr-only">Réglages de l’autopilot</legend>
              <div>
                <h3 className="block text-sm font-semibold text-white mb-3">Comptes de publication</h3>
                <AccountSelection accounts={accounts} selectedAccountIds={config.publish_account_ids}
                  onToggle={onToggleAccount} disabled={savingAutopilot} testIdPrefix="autopilot-account" />
                {missingSelection && <p role="status" className="mt-3 text-sm text-amber-200">Choisis au moins un compte pour activer la publication automatique.</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ToggleRow
                  label="Auto-caption"
                  icon={<MessageSquare className="w-4 h-4" />}
                  checked={config.auto_caption}
                  onChange={(v) => onUpdateConfig('auto_caption', v)}
                  testId="toggle-auto-caption"
                />
                <ToggleRow
                  label="Auto-hashtags"
                  icon={<Hash className="w-4 h-4" />}
                  checked={config.auto_hashtags}
                  onChange={(v) => onUpdateConfig('auto_hashtags', v)}
                  testId="toggle-auto-hashtags"
                />
                <ToggleRow
                  label="Inclure CTA"
                  icon={<Sparkles className="w-4 h-4" />}
                  checked={config.include_cta}
                  onChange={(v) => onUpdateConfig('include_cta', v)}
                  testId="toggle-include-cta"
                />
              </div>

              <div>
                <label htmlFor="caption-style" className="block text-sm font-semibold text-white mb-2">
                  Style de caption
                </label>
                <select
                  id="caption-style"
                  data-testid="select-caption-style"
                  value={config.caption_style}
                  onChange={(e) =>
                    onUpdateConfig('caption_style', e.target.value as AutopilotConfig['caption_style'])
                  }
                  className="w-full sm:w-auto bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="engaging">Engageant</option>
                  <option value="professional">Professionnel</option>
                  <option value="casual">Decontracte</option>
                  <option value="educational">Educatif</option>
                  <option value="humorous">Humoristique</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="max-hashtags" className="text-sm font-semibold text-white">
                    Nombre max de hashtags
                  </label>
                  <span className="text-sm font-mono text-violet-300">{config.max_hashtags}</span>
                </div>
                <input
                  id="max-hashtags"
                  type="range"
                  min={0}
                  max={30}
                  value={config.max_hashtags}
                  onChange={(e) => onUpdateConfig('max_hashtags', Number(e.target.value))}
                  data-testid="slider-max-hashtags"
                  className="w-full accent-violet-500"
                />
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end mt-8">
        <Button
          variant="primary"
          size="md"
          loading={savingAutopilot}
          onClick={onSave}
          disabled={!config || savingAutopilot || !!missingSelection || (config.enabled && unavailableSelection)}
          data-testid="save-autopilot"
        >
          <Check className="w-4 h-4" />
          Enregistrer l&apos;autopilot
        </Button>
      </div>
    </motion.div>
  )
}
