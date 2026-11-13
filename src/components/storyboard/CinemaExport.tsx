'use client'

import { useId, useState } from 'react'
import { Download, FileJson, Film } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createCinemaProject, exportCinemaProjectJson } from '@/lib/cinema-project'
import { exportBlenderScript } from '@/lib/blender-export'
import type { Scene, VideoFormat } from '@/lib/storyboard'

interface CinemaExportProps {
  title: string
  format: VideoFormat
  scenes: Scene[]
}

function downloadText(content: string, filename: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement('a')
  try {
    anchor.href = url
    anchor.download = filename
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    anchor.remove()
    // Let the browser start reading the Blob before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export default function CinemaExport({ title, format, scenes }: CinemaExportProps) {
  const headingId = useId()
  const descriptionId = useId()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleExport = (kind: 'blender' | 'json') => {
    setError(null)
    setNotice(null)
    try {
      const project = createCinemaProject({ title: title.trim() || 'Projet cinéma SUTRA', format, scenes })
      if (kind === 'blender') {
        downloadText(exportBlenderScript(project), 'sutra-cinema.blender.py', 'text/x-python;charset=utf-8')
      } else {
        downloadText(exportCinemaProjectJson(project), 'sutra-cinema.project.json', 'application/json;charset=utf-8')
      }
      setNotice(kind === 'blender' ? 'Téléchargement du script Blender lancé.' : 'Téléchargement du projet JSON lancé.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de préparer cet export. Vérifie les plans et réessaie.')
    }
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-violet-400/25 bg-violet-500/5 p-4 space-y-3">
      <h3 id={headingId} className="flex items-center gap-2 font-semibold text-white">
        <Film className="h-5 w-5 text-violet-300" aria-hidden="true" />
        Projet cinéma
      </h3>
      <p id={descriptionId} className="text-sm text-white/75">
        Prévisualisation éditable : caméras, plans et durées.
      </p>
      {scenes.some(scene => scene.transition !== 'cut') && (
        <p className="text-xs text-white/65">Les transitions sont conservées dans le projet ; la prévisualisation Blender utilise des coupes.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleExport('blender')} disabled={scenes.length === 0} aria-describedby={descriptionId} data-testid="export-blender-btn">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exporter pour Blender
        </Button>
        <Button onClick={() => handleExport('json')} disabled={scenes.length === 0} variant="secondary" data-testid="export-cinema-json-btn">
          <FileJson className="h-4 w-4" aria-hidden="true" />
          Télécharger le projet JSON
        </Button>
      </div>
      <p className="text-xs text-white/65">
        Dans Blender, ouvre le script dans l’espace Scripting, puis exécute-le pour créer la prévisualisation.
      </p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p role="status" className="text-sm text-violet-200">{notice}</p>
    </section>
  )
}
