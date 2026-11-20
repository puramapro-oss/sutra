'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { createCinemaProject } from '@/lib/cinema-project'
import { downloadBlob, downloadText } from '@/lib/download-text'
import { exportRemotionProject, MOTION_DRAWING_PATH } from '@/lib/remotion-export'
import type { Scene, VideoFormat } from '@/lib/storyboard'

interface Inputs { title: string; format: VideoFormat; scenes: Scene[] }
interface RenderState extends Inputs {
  pending?: 'mp4' | 'remotion'
  progress?: number
  blob?: Blob
  notice?: string
  error?: string
}

export default function MotionExportControls({ title, format, scenes }: Inputs) {
  const [state, setState] = useState<RenderState | null>(null)
  const operation = useRef<AbortController | null>(null)
  useEffect(() => () => {
    operation.current?.abort()
    operation.current = null
  }, [title, format, scenes])
  const current = state?.title === title && state.format === format && state.scenes === scenes ? state : null

  async function start(kind: 'mp4' | 'remotion') {
    if (operation.current) return
    const job = new AbortController()
    operation.current = job
    const inputs = { title, format, scenes }
    setState({ ...inputs, pending: kind, progress: 0 })
    try {
      const project = createCinemaProject({ title: title.trim() || 'Projet cinéma SUTRA', format, scenes })
      if (kind === 'remotion') {
        const response = await fetch(MOTION_DRAWING_PATH, { signal: job.signal, mode: 'same-origin' })
        if (!response.ok) throw new Error('La composition Remotion est indisponible. Réessaie le téléchargement.')
        const source = exportRemotionProject(project, await response.text())
        if (operation.current !== job) return
        downloadText(source, 'sutra.remotion.jsx', 'text/plain;charset=utf-8')
        setState({ ...inputs, notice: 'Téléchargement de la composition lancé. Les premières lignes expliquent le rendu avec tes images, tes clips MotionLab ou ta voix off.' })
      } else {
        const { renderStoryboardMp4 } = await import('@/lib/storyboard-mp4')
        const blob = await renderStoryboardMp4(project, job.signal, progress => {
          if (operation.current === job) setState({ ...inputs, pending: kind, progress })
        })
        if (operation.current === job) setState({ ...inputs, blob, notice: 'Ton MP4 est prêt.' })
      }
    } catch (cause) {
      if (operation.current === job) {
        if (job.signal.aborted) setState({ ...inputs, notice: 'Rendu annulé.' })
        else setState({ ...inputs, error: cause instanceof Error ? cause.message : 'Le rendu a échoué. Tu peux exporter le projet Remotion.' })
      }
    } finally {
      if (operation.current === job) operation.current = null
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-white/75">
        Crée sur ton appareil un MP4 des textes animés, jusqu’à deux minutes. La composition Remotion permet d’ajouter des médias et une voix off ou de rendre un projet plus long.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => start('mp4')} disabled={!!current?.pending} variant="secondary" data-testid="render-storyboard-mp4">
          Rendre le MP4 sur cet appareil
        </Button>
        {current?.pending === 'mp4' && (
          <Button variant="secondary" onClick={() => operation.current?.abort()}>Annuler le rendu</Button>
        )}
        {current?.blob && (
          <Button onClick={() => { if (current.blob) downloadBlob(current.blob, 'sutra-storyboard.mp4') }} data-testid="download-storyboard-mp4">Télécharger le MP4</Button>
        )}
        <Button onClick={() => start('remotion')} disabled={!!current?.pending} variant="secondary" data-testid="export-remotion-btn">
          Exporter pour Remotion
        </Button>
      </div>
      {current?.pending === 'mp4' && (
        <progress value={current.progress} max={100} aria-label="Rendu du MP4" className="w-full" />
      )}
      {current?.error && <p role="alert" className="text-sm text-red-300">{current.error}</p>}
      <p role="status" className="text-sm text-violet-200">{current?.notice}</p>
    </div>
  )
}
