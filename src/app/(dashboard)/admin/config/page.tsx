'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Settings,
  Save,
  AlertTriangle,
  Type,
  DollarSign,
  Users,
  Trophy,
  Megaphone,
  Mail,
  Check,
  Loader2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ConfigSection {
  key: string
  label: string
  icon: typeof Settings
  fields: ConfigField[]
}

interface ConfigField {
  key: string
  label: string
  type: 'text' | 'number' | 'toggle'
  value: string | number | boolean
  placeholder?: string
  suffix?: string
}

function GoldCard({
  children,
  className,
  ...props
}: {
  children: React.ReactNode
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SaveButton({
  onClick,
  loading,
  saved,
  testId,
}: {
  onClick: () => void
  loading: boolean
  saved: boolean
  testId: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      data-testid={testId}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300',
        saved
          ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400'
          : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
        'disabled:opacity-50'
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {saved ? 'Sauvegarde' : 'Sauvegarder'}
    </button>
  )
}

const DEFAULT_CONFIG: ConfigSection[] = [
  {
    key: 'landing',
    label: 'Page d\'accueil',
    icon: Type,
    fields: [
      { key: 'hero_title', label: 'Titre hero', type: 'text', value: 'Cree des videos virales avec l\'IA', placeholder: 'Titre principal de la landing...' },
      { key: 'hero_subtitle', label: 'Sous-titre hero', type: 'text', value: 'De l\'idee a la publication en 3 minutes', placeholder: 'Sous-titre accrocheur...' },
    ],
  },
  {
    key: 'plans',
    label: 'Prix des plans',
    icon: DollarSign,
    fields: [
      { key: 'starter_monthly', label: 'Starter (mensuel)', type: 'number', value: 9.99, suffix: 'EUR/mois' },
      { key: 'starter_yearly', label: 'Starter (annuel)', type: 'number', value: 6.69, suffix: 'EUR/mois' },
      { key: 'creator_monthly', label: 'Creator (mensuel)', type: 'number', value: 29.99, suffix: 'EUR/mois' },
      { key: 'creator_yearly', label: 'Creator (annuel)', type: 'number', value: 20.09, suffix: 'EUR/mois' },
      { key: 'empire_monthly', label: 'Empire (mensuel)', type: 'number', value: 79.99, suffix: 'EUR/mois' },
      { key: 'empire_yearly', label: 'Empire (annuel)', type: 'number', value: 53.59, suffix: 'EUR/mois' },
    ],
  },
  {
    key: 'limits',
    label: 'Limites par plan',
    icon: Users,
    fields: [
      { key: 'free_videos', label: 'Free (videos/mois)', type: 'number', value: 2 },
      { key: 'starter_videos', label: 'Starter (videos/mois)', type: 'number', value: 15 },
      { key: 'creator_videos', label: 'Creator (videos/mois)', type: 'number', value: 60 },
      { key: 'empire_videos', label: 'Empire (videos/mois)', type: 'number', value: 999 },
    ],
  },
  {
    key: 'referral',
    label: 'Commissions parrainage',
    icon: Users,
    fields: [
      { key: 'filleul_discount', label: 'Reduction filleul', type: 'number', value: 50, suffix: '%' },
      { key: 'first_payment_commission', label: 'Commission 1er paiement', type: 'number', value: 50, suffix: '%' },
      { key: 'recurring_commission', label: 'Commission recurrente', type: 'number', value: 10, suffix: '%' },
      { key: 'own_discount', label: 'Reduction propre abo', type: 'number', value: 10, suffix: '%' },
      { key: 'milestone_bonus', label: 'Bonus palier (/10)', type: 'number', value: 30, suffix: '%' },
    ],
  },
  {
    key: 'contest',
    label: 'Concours & Tirages',
    icon: Trophy,
    fields: [
      { key: 'weekly_prize_pool', label: 'Pool hebdo (% CA)', type: 'number', value: 2, suffix: '%' },
      { key: 'monthly_prize_pool', label: 'Pool mensuel (% CA)', type: 'number', value: 5, suffix: '%' },
    ],
  },
  {
    key: 'announcement',
    label: 'Banniere d\'annonce',
    icon: Megaphone,
    fields: [
      { key: 'banner_text', label: 'Texte de la banniere', type: 'text', value: '', placeholder: 'Annonce visible par tous les utilisateurs...' },
      { key: 'banner_active', label: 'Banniere active', type: 'toggle', value: false },
    ],
  },
  {
    key: 'emails',
    label: 'Sujets emails',
    icon: Mail,
    fields: [
      { key: 'email_welcome', label: 'Bienvenue', type: 'text', value: 'Bienvenue sur SUTRA !', placeholder: 'Sujet email...' },
      { key: 'email_subscription', label: 'Abonnement', type: 'text', value: 'Votre abonnement SUTRA est actif', placeholder: 'Sujet email...' },
      { key: 'email_commission', label: 'Commission', type: 'text', value: 'Nouvelle commission creditee', placeholder: 'Sujet email...' },
      { key: 'email_weekly_recap', label: 'Recap hebdo', type: 'text', value: 'Votre semaine SUTRA en resume', placeholder: 'Sujet email...' },
    ],
  },
]

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigSection[]>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/stats?type=config')

      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          setConfig((prev) =>
            prev.map((section) => {
              const serverSection = data.config[section.key]
              if (!serverSection) return section
              return {
                ...section,
                fields: section.fields.map((field) => ({
                  ...field,
                  value: serverSection[field.key] ?? field.value,
                })),
              }
            })
          )
        }
      }
      setError(null)
    } catch {
      // Fallback to default config
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const updateField = (sectionKey: string, fieldKey: string, value: string | number | boolean) => {
    setConfig((prev) =>
      prev.map((section) => {
        if (section.key !== sectionKey) return section
        return {
          ...section,
          fields: section.fields.map((field) => {
            if (field.key !== fieldKey) return field
            return { ...field, value }
          }),
        }
      })
    )
    if (savedSection === sectionKey) setSavedSection(null)
  }

  const saveSection = async (sectionKey: string) => {
    setSavingSection(sectionKey)
    try {
      const section = config.find((s) => s.key === sectionKey)
      if (!section) return

      const values: Record<string, string | number | boolean> = {}
      for (const field of section.fields) {
        values[field.key] = field.value
      }

      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_config', section: sectionKey, values }),
      })

      if (res.ok) {
        setSavedSection(sectionKey)
        toast.success('Configuration sauvegardee')
        setTimeout(() => setSavedSection(null), 3000)
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSavingSection(null)
    }
  }

  if (error && !config.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-config-page">
      <div>
        <h2 className="text-xl font-bold text-white">Configuration rapide</h2>
        <p className="text-sm text-white/40 mt-0.5">Modifier les parametres de l&apos;application</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={200} width="100%" rounded="xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {config.map((section, sIdx) => {
            const SectionIcon = section.icon
            return (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sIdx * 0.05 }}
              >
                <GoldCard className="p-5" data-testid={`admin-config-section-${section.key}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                        {section.label}
                      </h3>
                    </div>
                    <SaveButton
                      onClick={() => saveSection(section.key)}
                      loading={savingSection === section.key}
                      saved={savedSection === section.key}
                      testId={`admin-config-save-${section.key}`}
                    />
                  </div>

                  <div className="space-y-3">
                    {section.fields.map((field) => (
                      <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-sm text-white/50 sm:w-48 shrink-0">
                          {field.label}
                        </label>

                        {field.type === 'toggle' ? (
                          <button
                            onClick={() => updateField(section.key, field.key, !field.value)}
                            className={cn(
                              'relative h-6 w-11 rounded-full transition-colors duration-200',
                              field.value ? 'bg-amber-500' : 'bg-white/10'
                            )}
                            data-testid={`admin-config-${field.key}`}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200',
                                field.value && 'translate-x-5'
                              )}
                            />
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type={field.type}
                              value={String(field.value)}
                              placeholder={field.placeholder}
                              onChange={(e) => {
                                const val = field.type === 'number'
                                  ? parseFloat(e.target.value) || 0
                                  : e.target.value
                                updateField(section.key, field.key, val)
                              }}
                              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/90 placeholder-white/20 outline-none focus:border-amber-500/40 transition-colors"
                              data-testid={`admin-config-${field.key}`}
                            />
                            {field.suffix && (
                              <span className="text-xs text-white/30 shrink-0">{field.suffix}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GoldCard>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
