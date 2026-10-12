import type { Scene } from '@/types'

/** Recover only an unambiguous, persisted source list; a final movie is never a source scene. */
export function editorScenes(scenes: Scene[], timeline: Record<string, unknown> | null): Scene[] {
  const saved = timeline?.sutraEditorClips
  let clips: unknown[] = Array.isArray(saved) ? saved : []
  if (!Array.isArray(saved)) {
    const tracks = (timeline?.timeline as { tracks?: Array<{ clips?: Array<{ asset?: { type?: string; src?: string }; start?: number; length?: number }> }> } | undefined)?.tracks ?? []
    const candidates = tracks.filter(track => track.clips?.length === scenes.length && track.clips.every(c => ['video', 'image'].includes(c.asset?.type ?? '')))
    if (candidates.length === 1) clips = [...candidates[0].clips!].sort((a, b) => (a.start ?? 0) - (b.start ?? 0)).map(c => ({ url: c.asset?.src, duration: c.length, kind: c.asset?.type === 'image' ? 'photo' : 'video' }))
  }
  if (clips.length !== scenes.length) return scenes.map(({ export_media: _media, ...scene }) => scene)
  return scenes.map((scene, i) => {
    const clip = clips[i] as { url?: unknown; duration?: unknown; type?: unknown; kind?: unknown }
    if (typeof clip?.url !== 'string' || !/^https?:\/\//.test(clip.url)) return scene
    return { ...scene, duration_seconds: typeof clip.duration === 'number' ? clip.duration : scene.duration_seconds,
      export_media: { url: clip.url, type: clip.type === 'stock' || scene.use_stock ? 'stock' : 'ia', kind: clip.kind === 'photo' ? 'photo' : 'video' } }
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
