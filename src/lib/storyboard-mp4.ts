import { drawStoryboardFrame } from '../../public/motion/storyboard-frame.mjs'
import type { CinemaProject } from './cinema-project'
import { makeMotionData } from './remotion-export'

const MAX_SECONDS = 120
const BITRATE = 4_000_000

/** Bounded, local H.264 preview; no model, remote media or account is involved. */
export async function renderStoryboardMp4(
  project: CinemaProject,
  signal: AbortSignal,
  onProgress: (percent: number) => void
): Promise<Blob> {
  const data = makeMotionData(project)
  if (project.timeline.durationSeconds > MAX_SECONDS) {
    throw new Error('Le rendu sur cet appareil est limité à deux minutes. Exporte la composition Remotion pour rendre ce storyboard en entier.')
  }
  const unsupported = 'Cet appareil ne propose pas l’encodage MP4 H.264 dans ce navigateur. Le bouton « Exporter pour Remotion » garde les mêmes plans et durées.'
  signal.throwIfAborted()
  if (!globalThis.isSecureContext || typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error(unsupported)
  }
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } = await import('mediabunny')
  const fps = data.fps.numerator / data.fps.denominator
  if (!await canEncodeVideo('avc', { width: data.width, height: data.height, frameRate: fps, bitrate: BITRATE })) {
    throw new Error(unsupported)
  }
  signal.throwIfAborted()
  const surface = document.createElement('canvas')
  surface.width = data.width
  surface.height = data.height
  const context = surface.getContext('2d', { alpha: false })
  if (!context) throw new Error('Le dessin vidéo est indisponible dans ce navigateur. Tu peux exporter la composition Remotion.')

  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat(), target })
  const source = new CanvasSource(surface, { codec: 'avc', bitrate: BITRATE })
  output.addVideoTrack(source, { frameRate: fps })
  let cancellation: Promise<void> | undefined
  const cancel = () => {
    if (!cancellation && (output.state === 'started' || output.state === 'pending')) cancellation = output.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    await output.start()
    let written = 0
    let lastPercent = 0
    for (const [index, scene] of data.scenes.entries()) {
      for (let frame = 0; frame < scene.frames; frame++) {
        signal.throwIfAborted()
        drawStoryboardFrame(context, data, scene, index, frame)
        await source.add(written / fps, 1 / fps)
        written++
        const percent = Math.min(99, Math.floor(written / project.timeline.totalFrames * 100))
        if (percent !== lastPercent) {
          lastPercent = percent
          onProgress(percent)
        }
        if (written % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0))
      }
    }
    signal.throwIfAborted()
    source.close()
    await output.finalize()
    signal.throwIfAborted()
    if (!target.buffer?.byteLength) throw new Error('Le navigateur a renvoyé une vidéo vide.')
    return new Blob([target.buffer], { type: 'video/mp4' })
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    await cancellation
    surface.width = surface.height = 0
  }
}
