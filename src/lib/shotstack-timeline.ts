import type { AssembleParams } from './shotstack'
import { compositionPlan, type CompositionContract } from './composition-contract'
export function shotstackContract(params: AssembleParams): CompositionContract {
  return { ...params, clips: params.clips.map(c => ({ ...c, durationSeconds: c.duration })),
    watermarkUrl: params.watermarkUrl ?? params.brandKit?.logo_url, introUrl: params.brandKit?.intro_template, outroUrl: params.brandKit?.outro_template }
}

/** URL qui finit par une extension d'image → asset image, pas vidéo. */
function looksLikePhoto(url: string): boolean {
  return /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url)
}

/** Transitions normalisées : 'fade'/'crossfade' → fade, tout le reste → none. */
function transitionFor(requested: string): { in: string; out?: string } {
  const norm = requested.toLowerCase()
  if (norm === 'fade' || norm === 'crossfade' || norm === 'fondu') {
    return { in: 'fade' }
  }
  return { in: 'none' }
}

function clipAsset(clip: AssembleParams['clips'][number]): { type: string; src: string; volume?: number } {
  const kind = clip.kind ?? (looksLikePhoto(clip.url) ? 'photo' : 'video')
  // Une photo devient un asset IMAGE (durée portée par le clip) — jamais un
  // asset vidéo (audit #5 : le type du média doit survivre jusqu'au montage).
  return { type: kind === 'photo' ? 'image' : 'video', src: clip.url, ...(kind === 'photo' ? {} : { volume: 0 }) }
}

/**
 * Horloge de montage commune (audit #4) :
 *   - chaque clip dure SA durée réelle (duration par clip, 5s par défaut)
 *   - l'intro décale voix ET sous-titres de sa longueur
 *   - la piste voix couvre seulement le corps du montage
 *   - les sous-titres sont relatifs au corps et décalés après l'intro
 */
export function buildTracks(params: AssembleParams, musicDurationSeconds?: number) {
  const plan = compositionPlan(shotstackContract(params))
  const videoClips: Array<Record<string, unknown>> = []
  let introLength = 0

  if (params.brandKit?.intro_template) {
    introLength = plan.intro
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.intro_template, volume: 0 },
      start: 0,
      length: introLength,
      transition: { in: 'fade', out: 'fade' },
    })
  }

  let cursor = introLength
  for (const [index, clip] of params.clips.entries()) {
    const length = plan.durations[index]
    videoClips.push({
      asset: clipAsset(clip),
      start: cursor,
      length,
      transition: transitionFor(params.transitions),
    })
    cursor += length
  }

  if (params.brandKit?.outro_template) {
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.outro_template, volume: 0 },
      start: cursor,
      length: plan.outro,
      transition: { in: 'fade' },
    })
    cursor += plan.outro
  }

  const totalLength = cursor

  // La voix est OPTIONNELLE (montage musique/watermark/intro/outro seul,
  // sans narration) — un asset audio avec src vide ferait échouer Shotstack.
  const voiceTrack = params.voiceUrl
    ? [
        {
          // La voix démarre APRÈS l'intro et couvre tout le corps du montage.
          asset: { type: 'audio', src: params.voiceUrl, volume: params.voiceVolume ?? 1 },
          start: introLength,
          length: plan.body,
        },
      ]
    : []

  const watermarkClips = params.watermarkUrl
    ? [
        {
          asset: { type: 'image', src: params.watermarkUrl },
          start: 0,
          length: totalLength,
          position: 'bottomRight',
          offset: { x: -0.04, y: -0.04 },
          scale: 0.12,
          opacity: 0.85,
        },
      ]
    : []

  const subtitleClips = plan.subtitles.map(sub => ({
    asset: { type: 'title', text: sub.text, style: 'subtitle', size: 'small' },
    start: sub.start, length: sub.end - sub.start, position: 'bottom',
  }))
  const textClips = !params.watermarkUrl && params.watermarkText ? [{
    asset: { type: 'title', text: params.watermarkText, style: 'minimal', size: 'small' },
    start: 0, length: totalLength, position: 'bottomRight', opacity: 0.7,
  }] : []
  // Shotstack's FIRST track is on top. Empty tracks are not submitted.
  const musicClips: Array<Record<string, unknown>> = []
  if (params.musicUrl) {
    const duration = musicDurationSeconds ?? plan.total
    if (!Number.isFinite(duration) || duration <= 0 || plan.total / duration > 10000) throw new Error('Duree musique invalide')
    for (let start = 0; start < plan.total - 0.0001; start += duration) {
      musicClips.push({ asset: { type: 'audio', src: params.musicUrl, volume: params.musicVolume },
        start, length: Math.min(duration, plan.total - start) })
    }
  }
  const tracks = [subtitleClips, watermarkClips, textClips, voiceTrack, musicClips, videoClips]
    .filter(clips => clips.length).map(clips => ({ clips }))
  return tracks
}
