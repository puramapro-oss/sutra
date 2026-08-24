'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { PlayCircle, Camera } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { NICHES } from '@/lib/constants'

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88A2.89 2.89 0 019.49 12.4v-3.5a6.37 6.37 0 00-6.38 6.38 6.37 6.37 0 006.38 6.38 6.37 6.37 0 006.38-6.38V9.42a8.16 8.16 0 004.72 1.49V7.46a4.85 4.85 0 01-1-.77z" />
  </svg>
)

const NETWORK_OPTIONS = [
  { id: 'youtube', label: 'YouTube', icon: PlayCircle },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { id: 'instagram', label: 'Instagram', icon: Camera },
] as const

interface AutopilotSeriesFormProps {
  show: boolean
  formName: string
  setFormName: (name: string) => void
  formNiche: string
  setFormNiche: (niche: string) => void
  formFrequency: 'daily' | 'weekly'
  setFormFrequency: (freq: 'daily' | 'weekly') => void
  formNetworks: string[]
  toggleNetwork: (id: string) => void
  formApproval: 'auto' | 'manual'
  setFormApproval: (mode: 'auto' | 'manual') => void
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export default function AutopilotSeriesForm({
  show,
  formName,
  setFormName,
  formNiche,
  setFormNiche,
  formFrequency,
  setFormFrequency,
  formNetworks,
  toggleNetwork,
  formApproval,
  setFormApproval,
  saving,
  onSave,
  onCancel,
}: AutopilotSeriesFormProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <Card>
            <CardContent className="space-y-5">
              <h2 className="text-lg font-semibold text-white">Nouvelle serie</h2>

              {/* Name */}
              <Input
                label="Nom de la serie"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Motivation quotidienne"
                data-testid="autopilot-name-input"
              />

              {/* Niche */}
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Niche</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {NICHES.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => setFormNiche(niche)}
                      data-testid={`niche-${niche}`}
                      className={cn(
                        'px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                        formNiche === niche
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                      )}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Frequence</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['daily', 'weekly'] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFormFrequency(freq)}
                      data-testid={`frequency-${freq}`}
                      className={cn(
                        'px-4 py-3 rounded-xl text-sm font-medium border transition-all',
                        formFrequency === freq
                          ? 'bg-violet-500/20 border-violet-500/40 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                      )}
                    >
                      {freq === 'daily' ? 'Quotidienne' : 'Hebdomadaire'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Networks */}
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Reseaux</label>
                <div className="grid grid-cols-3 gap-2">
                  {NETWORK_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const isSelected = formNetworks.includes(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleNetwork(id)}
                        data-testid={`network-${id}`}
                        className={cn(
                          'px-4 py-3 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2',
                          isSelected
                            ? 'bg-violet-500/20 border-violet-500/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                        )}
                      >
                        <Icon />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Approval */}
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Validation</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['manual', 'auto'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFormApproval(mode)}
                      data-testid={`approval-${mode}`}
                      className={cn(
                        'px-4 py-3 rounded-xl text-sm font-medium border transition-all',
                        formApproval === mode
                          ? 'bg-violet-500/20 border-violet-500/40 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                      )}
                    >
                      {mode === 'manual' ? 'Manuelle' : 'Automatique'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/30 mt-2">
                  {formApproval === 'manual'
                    ? 'Tu valideras chaque video avant publication'
                    : 'Les videos seront publiees automatiquement'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={onCancel} disabled={saving}>
                  Annuler
                </Button>
                <Button onClick={onSave} loading={saving} data-testid="autopilot-save">
                  Creer la serie
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
