import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createCinemaProject } from '@/lib/cinema-project'
import type { Scene, VideoFormat } from '@/lib/storyboard'

interface StoryboardProps { format: VideoFormat; scenes: Scene[] }
interface VideoMetadata { width: number; height: number; duration: number }

const seconds = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })

function RenderPreview({ file, format, scenes }: StoryboardProps & { file: File }) {
  const playerRef = useRef<HTMLVideoElement>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [failed, setFailed] = useState(false)
  const project = useMemo(() => {
    if (!scenes.length) return null
    try {
      return createCinemaProject({ title: 'Relecture', scenes, format })
    } catch {
      return null
    }
  }, [format, scenes])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    const url = URL.createObjectURL(file)
    player.src = url
    return () => {
      player.removeAttribute('src')
      player.load()
      URL.revokeObjectURL(url)
    }
  }, [file])

  const [w, h] = format.split(':').map(Number)
  // Encoders can round a display dimension to the nearest whole pixel.
  const sameFormat = metadata && Math.abs(metadata.width - metadata.height * w / h) <= 1

  return (
    <div className="space-y-2">
      <video ref={playerRef} controls playsInline preload="metadata"
        aria-label={`Relecture de ${file.name}`}
        className="max-h-[65vh] w-full rounded-xl bg-black object-contain"
        onLoadedMetadata={({ currentTarget: player }) => {
          if (!player.videoWidth || !player.videoHeight || !Number.isFinite(player.duration) || player.duration <= 0) {
            setFailed(true)
            return
          }
          setMetadata({ width: player.videoWidth, height: player.videoHeight, duration: player.duration })
        }}
        onError={() => setFailed(true)}
      />
      {failed ? <p role="alert" className="text-sm text-amber-200">
        Le navigateur ne peut pas lire la piste vidéo de ce fichier. Choisis un autre export MP4.
      </p> : metadata && (
        <>
          <p role="status" className="break-words text-sm text-white/80">
            {file.name} · {metadata.width} × {metadata.height} px · {seconds.format(metadata.duration)} s.
            {' '}{sameFormat ? `Le cadrage correspond au format ${format}.` : `Le storyboard prévoit un autre cadrage (${format}).`}
            {project && ` Le montage prévoit ${seconds.format(project.timeline.durationSeconds)} s.`}
          </p>
          {project && (
            <label className="block text-sm text-white/80">
              Aller au début d’un plan
              <select value="" onChange={event => {
                if (playerRef.current && event.target.value) playerRef.current.currentTime = Number(event.target.value)
              }} className="mt-1 block w-full rounded-lg border border-white/15 bg-neutral-900 p-2 text-white">
                <option value="" disabled>Choisir un plan</option>
                {project.scenes.map((scene, index) => {
                  const start = scene.timeline.startFrame * project.fps.denominator / project.fps.numerator
                  return <option key={scene.id} value={start} disabled={start >= metadata.duration}>
                    Plan {index + 1} · {seconds.format(start)} s{start >= metadata.duration ? ' · hors du rendu' : ''}
                  </option>
                })}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  )
}

export default function StoryboardRenderReview({ format, scenes }: StoryboardProps) {
  const heading = useId()
  const [selection, setSelection] = useState<{ file: File; revision: number } | null>(null)
  const [error, setError] = useState('')

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const mp4 = ['video/mp4', 'application/mp4', 'video/x-m4v'].includes(file.type) ||
      ((!file.type || file.type === 'application/octet-stream') && /\.mp4$/i.test(file.name))
    if (!mp4 || !file.size) {
      setError('Choisis un fichier vidéo MP4 contenant des données.')
      return
    }
    setError('')
    setSelection(previous => ({ file, revision: (previous?.revision ?? 0) + 1 }))
  }

  return (
    <section aria-labelledby={heading} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 id={heading} className="font-semibold text-white">Relire le rendu MP4</h3>
      <p className="text-sm text-white/75">Compare ton export MotionLab, Remotion ou autre au storyboard. Le fichier s’ouvre uniquement sur cet appareil.</p>
      <label className="block text-sm text-white/80">
        Choisir un MP4 local
        <input type="file" accept="video/mp4,.mp4" onChange={selectFile}
          className="mt-1 block w-full rounded-lg text-sm file:mr-2 file:rounded-md file:border-0 file:bg-violet-700 file:px-3 file:py-2 file:text-white" />
      </label>
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {selection && <RenderPreview key={selection.revision} file={selection.file} format={format} scenes={scenes} />}
    </section>
  )
}
