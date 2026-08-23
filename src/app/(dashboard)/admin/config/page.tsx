'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import GoldCard from '@/components/admin/GoldCard'
import SaveButton from '@/components/admin/SaveButton'
import { DEFAULT_CONFIG } from './defaultConfig'
import type { ConfigSection } from './types'

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
