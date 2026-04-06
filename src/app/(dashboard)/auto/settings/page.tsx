'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface AutoConfig {
  default_style: string
  default_duration: number
  default_aspect_ratio: string
  default_music_genre: string
  default_voice_enabled: boolean
  default_voice_id: string | null
  default_language: string
  publish_platforms: string[]
  auto_publish: boolean
  require_approval_before_publish: boolean
  preferred_model: string
  quality_level: string
}

const STYLES = ['cinematic', 'anime', 'realistic', 'abstract', 'minimal']
const RATIOS = ['9:16', '16:9', '1:1']
const MODELS = [
  { id: 'ltx-2-3-pro', label: 'LTX 2.3 Pro' },
  { id: 'ltx-2-3-fast', label: 'LTX 2.3 Fast' },
  { id: 'wan-2.2', label: 'WAN 2.2' },
]
const QUALITIES = ['draft', 'standard', 'high', 'ultra']
const PLATFORMS = [
  'youtube',
  'instagram',
  'tiktok',
  'facebook',
  'x',
  'linkedin',
  'pinterest',
  'threads',
]

export default function SettingsPage() {
  const [cfg, setCfg] = useState<AutoConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto/config')
      const json = await res.json()
      if (json.config) setCfg(json.config)
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const update = useCallback(<K extends keyof AutoConfig>(key: K, value: AutoConfig[K]) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const togglePlatform = useCallback((p: string) => {
    setCfg((prev) => {
      if (!prev) return prev
      const has = prev.publish_platforms.includes(p)
      return {
        ...prev,
        publish_platforms: has
          ? prev.publish_platforms.filter((x) => x !== p)
          : [...prev.publish_platforms, p],
      }
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const res = await fetch('/api/auto/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const json = await res.json()
      if (json.config) {
        toast.success('Reglages sauvegardes')
        setCfg(json.config)
      } else {
        toast.error(json.error ?? 'Erreur')
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }, [cfg])

  if (loading || !cfg) return <Skeleton width="100%" height={400} rounded="xl" />

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Style visuel par defaut</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => update('default_style', s)}
                data-testid={`style-${s}`}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border capitalize transition-all',
                  cfg.default_style === s
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Format & duree</h3>
          <div>
            <label className="text-xs text-white/60 mb-2 block">Format</label>
            <div className="flex gap-2">
              {RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => update('default_aspect_ratio', r)}
                  data-testid={`ratio-${r}`}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-medium border transition-all',
                    cfg.default_aspect_ratio === r
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-2 block">
              Duree: {cfg.default_duration}s
            </label>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={cfg.default_duration}
              onChange={(e) => update('default_duration', Number(e.target.value))}
              className="w-full accent-violet-500"
              data-testid="duration-slider"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Modele de generation</h3>
          <div className="flex gap-2 flex-wrap">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => update('preferred_model', m.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-xs font-medium border transition-all',
                  cfg.preferred_model === m.id
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-white/60 mb-2 block">Qualite</label>
            <div className="flex gap-2 flex-wrap">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => update('quality_level', q)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-medium border capitalize transition-all',
                    cfg.quality_level === q
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Plateformes de publication</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                data-testid={`platform-${p}`}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-medium border capitalize transition-all',
                  cfg.publish_platforms.includes(p)
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-semibold text-white">Mode de publication</h3>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">Publication automatique</p>
              <p className="text-xs text-white/40">SUTRA publie sans validation</p>
            </div>
            <input
              type="checkbox"
              checked={cfg.auto_publish}
              onChange={(e) => update('auto_publish', e.target.checked)}
              className="w-5 h-5 accent-violet-500"
              data-testid="auto-publish-toggle"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">Validation requise avant publication</p>
              <p className="text-xs text-white/40">Tu valides chaque video</p>
            </div>
            <input
              type="checkbox"
              checked={cfg.require_approval_before_publish}
              onChange={(e) => update('require_approval_before_publish', e.target.checked)}
              className="w-5 h-5 accent-violet-500"
              data-testid="approval-toggle"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className="text-sm text-white">Voix off (ElevenLabs)</p>
              <p className="text-xs text-white/40">Genere une voix off automatique</p>
            </div>
            <input
              type="checkbox"
              checked={cfg.default_voice_enabled}
              onChange={(e) => update('default_voice_enabled', e.target.checked)}
              className="w-5 h-5 accent-violet-500"
              data-testid="voice-toggle"
            />
          </label>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={handleSave} loading={saving} data-testid="settings-save">
          <Save className="h-4 w-4" /> Sauvegarder
        </Button>
      </div>
    </div>
  )
}
