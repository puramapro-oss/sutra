'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface Theme {
  id: string
  theme: string
  description: string | null
  tone: string | null
  target_audience: string | null
  weight: number
  times_used: number
  is_active: boolean
}

export default function ThemesPage() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [theme, setTheme] = useState('')
  const [description, setDescription] = useState('')
  const [tone, setTone] = useState('')
  const [audience, setAudience] = useState('')
  const [weight, setWeight] = useState(1)

  const fetchThemes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto/themes')
      const json = await res.json()
      setThemes(json.themes ?? [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchThemes() }, [fetchThemes])

  const handleCreate = useCallback(async () => {
    if (!theme.trim()) {
      toast.error('Donne un nom au theme')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/auto/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: theme.trim(),
          description: description.trim() || null,
          tone: tone.trim() || null,
          target_audience: audience.trim() || null,
          weight,
        }),
      })
      const json = await res.json()
      if (json.theme) {
        toast.success('Theme cree')
        setTheme('')
        setDescription('')
        setTone('')
        setAudience('')
        setWeight(1)
        setShowForm(false)
        fetchThemes()
      } else {
        toast.error(json.error ?? 'Erreur')
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }, [theme, description, tone, audience, weight, fetchThemes])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/auto/themes/${id}`, { method: 'DELETE' })
      setThemes((prev) => prev.filter((t) => t.id !== id))
      toast.success('Theme supprime')
    } catch {
      toast.error('Erreur suppression')
    }
  }, [])

  if (loading) return <Skeleton width="100%" height={300} rounded="xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{themes.length} theme(s) configure(s)</p>
        <Button onClick={() => setShowForm(true)} data-testid="theme-add">
          <Plus className="h-4 w-4" /> Nouveau theme
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <Input
              label="Theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex: Motivation fitness"
              data-testid="theme-name"
            />
            <Input
              label="Description (guide pour l'IA)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Conseils, transformations, citations inspirantes..."
            />
            <Input
              label="Ton"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Motivant, calme, educatif..."
            />
            <Input
              label="Audience cible"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Hommes 25-35 sportifs..."
            />
            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">
                Poids dans la rotation: {weight}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={handleCreate} loading={saving} data-testid="theme-save">
                Creer le theme
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {themes.length === 0 && !showForm ? (
        <EmptyState
          icon={Tag}
          title="Aucun theme"
          description="Definis les sujets que SUTRA doit traiter en mode autonome."
          action={{ label: 'Creer un theme', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((t) => (
            <Card key={t.id} hover data-testid={`theme-${t.id}`}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">{t.theme}</h3>
                    {t.description && (
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {t.tone && <Badge variant="info" size="sm">{t.tone}</Badge>}
                      {t.target_audience && (
                        <Badge variant="default" size="sm">{t.target_audience}</Badge>
                      )}
                      <Badge variant="premium" size="sm">poids {t.weight}</Badge>
                      <span className="text-xs text-white/30">{t.times_used}x utilise</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    data-testid={`theme-delete-${t.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
