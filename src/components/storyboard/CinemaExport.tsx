'use client'

import { useId, useState } from 'react'
import { Download, FileJson, Film } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createCinemaProject, exportCinemaProjectJson } from '@/lib/cinema-project'
import { exportBlenderScript } from '@/lib/blender-export'
import { exportOtioProject } from '@/lib/otio-export'
import MotionExportControls from './MotionExportControls'
import { downloadText } from '@/lib/download-text'
import type { Scene, VideoFormat } from '@/lib/storyboard'

interface CinemaExportProps {
  title: string
  format: VideoFormat
  scenes: Scene[]
}

export default function CinemaExport({ title, format, scenes }: CinemaExportProps) {
  const headingId = useId()
  const descriptionId = useId()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleExport = (kind: 'blender' | 'json' | 'otio') => {
    setError(null)
    setNotice(null)
    try {
      const project = createCinemaProject({ title: title.trim() || 'Projet cinéma SUTRA', format, scenes })
      if (kind === 'blender') {
        downloadText(exportBlenderScript(project), 'sutra-cinema.blender.py', 'text/x-python;charset=utf-8')
        setNotice('Téléchargement du script Blender lancé.')
      } else if (kind === 'otio') {
        downloadText(exportOtioProject(project), 'sutra-storyboard.otio', 'application/json;charset=utf-8')
        setNotice('Téléchargement de la timeline lancé. Relie tes rushes dans le logiciel de montage.')
      } else {
        downloadText(exportCinemaProjectJson(project), 'sutra-cinema.project.json', 'application/json;charset=utf-8')
        setNotice('Téléchargement du projet JSON lancé.')
      }
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
        <Button onClick={() => handleExport('otio')} disabled={scenes.length === 0} variant="secondary" data-testid="export-otio-btn">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exporter pour DaVinci Resolve (.otio)
        </Button>
      </div>
      <p className="text-xs text-white/65">
        Dans Blender, ouvre le script dans l’espace Scripting, puis exécute-le pour créer la prévisualisation.
      </p>
      <MotionExportControls title={title} format={format} scenes={scenes} />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <p role="status" className="text-sm text-violet-200">{notice}</p>
    </section>
  )
}
