import type { Scene } from '@/types'

interface LegacyClip {
  asset?: { type?: string; src?: string }
  start?: number
  length?: number
}

function isSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false
  try {
    return Boolean(new URL(value).hostname)
  } catch {
    return false
  }
}

/** Recover only an unambiguous, persisted source list; a final movie is never a source scene. */
export function editorScenes(scenes: Scene[], timeline: Record<string, unknown> | null): Scene[] {
  const saved = timeline?.sutraEditorClips
  let clips: unknown[] = Array.isArray(saved) ? saved : []
  const tracks = (timeline?.timeline as { tracks?: unknown } | undefined)?.tracks
  if (saved == null && Array.isArray(tracks)) {
    const candidates = tracks.map(track => track?.clips).filter((items): items is LegacyClip[] =>
      Array.isArray(items) && items.length === scenes.length &&
      items.every(clip => clip?.asset?.type === 'image' || clip?.asset?.type === 'video')
    )
    if (candidates.length === 1) {
      clips = [...candidates[0]].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)).map(clip => ({
        url: clip.asset?.src, duration: clip.length, kind: clip.asset?.type === 'image' ? 'photo' : 'video',
      }))
    }
  }
  return scenes.map((scene, i) => {
    const clip = clips[i] as { url?: unknown; duration?: unknown; type?: unknown; kind?: unknown }
    if (clips.length !== scenes.length || !isSourceUrl(clip?.url)) {
      const unlinked = { ...scene }
      delete unlinked.export_media
      return unlinked
    }
    const origin = clip.type === 'stock' || clip.type === 'ia' ? clip.type : scene.use_stock ? 'stock' : 'ia'
    return {
      ...scene,
      duration_seconds: typeof clip.duration === 'number' ? clip.duration : scene.duration_seconds,
      export_media: {
        url: clip.url,
        type: origin,
        kind: clip.kind === 'photo' || clip.kind === 'video' ? clip.kind : undefined,
      },
    }
  })
}

export function editorExportScenes(scenes: Scene[]) {
  if (!scenes.length || scenes.some(scene => !scene.export_media?.url)) {
    throw new Error('Les sources de ce montage sont indisponibles. Aucun export ne peut etre lance.')
  }
  return scenes.map(scene => ({ ...scene.export_media!, duration: scene.duration_seconds }))
}

export function editorVolume(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Volume invalide')
  return percent / 100
}
