/**
 * Fonctions pures (aucune IO) utilisees par ffmpeg-compositor.ts : filtres
 * FFmpeg, resolution, generation SRT. Separees dans leur propre fichier pour
 * rester sous la limite de 300 lignes et pour un test unitaire isole, rapide,
 * sans spawn de process.
 *
 * Duplique volontairement ltx-utils.ts::RESOLUTION_MAP/getResolution et
 * subtitles.ts::generateSRT (fonctions pures, stables) — ce fichier n'importe
 * que des modules relatifs/npm pour rester testable sous `node --test` sans
 * resolveur de chemins TS (l'alias `@/...` n'est resolu que par le bundler
 * Next.js, pas par Node directement) et portable vers un futur worker hors
 * app Next.js.
 */

export interface SubtitleEntry {
  text: string
  start: number
  end: number
}

const RESOLUTION_MAP: Record<string, Record<string, string>> = {
  '16:9': { '720p': '1280x720', '1080p': '1920x1080', '4k': '3840x2160' },
  '9:16': { '720p': '720x1280', '1080p': '1080x1920', '4k': '2160x3840' },
  '1:1': { '720p': '720x720', '1080p': '1080x1080', '4k': '2160x2160' },
}

export function getResolution(format: string, quality: string): string {
  return RESOLUTION_MAP[format]?.[quality] ?? RESOLUTION_MAP['16:9']['1080p']
}

function formatSRTTime(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000)
  const h = Math.floor(milliseconds / 3600000)
  const m = Math.floor(milliseconds / 60000) % 60
  const s = Math.floor(milliseconds / 1000) % 60
  const ms = milliseconds % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function generateSRT(subtitles: SubtitleEntry[]): string {
  return subtitles
    .map((entry, index) => {
      const startTime = formatSRTTime(entry.start)
      const endTime = formatSRTTime(entry.end)
      return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}`
    })
    .join('\n\n')
}

const FADE_SECONDS = 0.3

export function buildNormalizeFilter(
  width: number,
  height: number,
  durationSeconds: number,
  transitions: 'fade' | 'none'
): string {
  const base = `scale=w='trunc(ih*dar/2)*2':h=ih,setsar=1,scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`
  if (transitions === 'none' || durationSeconds <= FADE_SECONDS * 2) return base
  const fadeOutStart = Math.max(0, durationSeconds - FADE_SECONDS)
  return `${base},fade=t=in:st=0:d=${FADE_SECONDS},fade=t=out:st=${fadeOutStart}:d=${FADE_SECONDS}`
}

/**
 * `baseLabel` est le label du flux video courant dans la chaine
 * filter_complex (ex: `[0:v]` ou `[sub]`), le watermark est toujours
 * attendu en entree `[1:v]`. `outputWidth` est la largeur reelle de la
 * sortie (px) : le logo est mis a l'echelle a ~12% de cette largeur quelle
 * que soit sa resolution source (sans ca, un logo source a resolution fixe
 * apparaissait disproportionne entre 720p et 4K). `opacity` (0..1) evite un
 * watermark trop agressif a 100% (defaut 0.85, aligne sur shotstack.ts).
 */
export function buildWatermarkOverlayFilter(
  baseLabel: string,
  outputWidth: number,
  opacity = 0.85,
  margin = 24
): string {
  const targetWidth = Math.max(1, Math.round(outputWidth * 0.12))
  return `[1:v]scale=${targetWidth}:-1,format=rgba,colorchannelmixer=aa=${opacity}[wm];${baseLabel}[wm]overlay=W-w-${margin}:H-h-${margin}[outv]`
}

/** `fontsize` en expression relative a `h` (hauteur de sortie) : lisible a 720p comme en 4K. */
export function buildWatermarkTextFilter(text: string, margin = 24, textFilePath?: string): string {
  const escaped = text.replace(/:/g, '\\:').replace(/'/g, "\\'")
  // Compositor passes a generated local text file: user punctuation never enters
  // the filter grammar, and percent expressions remain literal.
  const source = textFilePath ? `textfile='${textFilePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}'` : `text='${escaped}'`
  return `drawtext=${source}:expansion=none:fontcolor=white@0.7:fontsize=h*0.035:x=w-tw-${margin}:y=h-th-${margin}:box=1:boxcolor=black@0.35:boxborderw=8`
}

/**
 * `original_size` est OBLIGATOIRE pour un rendu previsible : sans lui,
 * libass deduit sa propre resolution de reference pour un SRT brut (brut =
 * sans script ASS explicite) de maniere non garantie, donc FontSize ne
 * produit pas la meme taille relative a 720p qu'a 4K. FontSize est calcule
 * proportionnellement a la hauteur reelle de sortie (~1/27e, convention
 * sous-titrage courante) au lieu d'une valeur fixe illisible en 4K ou trop
 * grande en 720p.
 */
export function buildSubtitlesFilter(srtPath: string, outputWidth: number, outputHeight: number): string {
  const escaped = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
  const fontSize = Math.max(12, Math.round(outputHeight / 27))
  return (
    `subtitles=${escaped}:original_size=${outputWidth}x${outputHeight}:` +
    `force_style='FontSize=${fontSize},PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Alignment=2,MarginV=60'`
  )
}

/** Construit les args ffmpeg de la passe audio (voix+musique mixees, ou silence). Pure. */
export function buildAudioArgs(params: {
  voicePath: string | null
  musicPath: string | null
  voiceVolume?: number
  musicVolume: number
  totalDurationSeconds: number
  outputPath: string
  voiceOffsetSeconds?: number
  bodyDurationSeconds?: number
}): string[] {
  const { voicePath, musicPath, musicVolume, totalDurationSeconds, outputPath } = params
  const fadeStart = Math.max(0, totalDurationSeconds - 2)
  const voiceFilter = `volume=${params.voiceVolume ?? 1},atrim=duration=${params.bodyDurationSeconds ?? totalDurationSeconds},asetpts=PTS-STARTPTS,adelay=${Math.round((params.voiceOffsetSeconds ?? 0) * 1000)}:all=1,apad`
  const audioFormat = ['-ar', '48000', '-ac', '2']

  if (voicePath && musicPath) {
    return [
      '-i', voicePath,
      '-stream_loop', '-1', '-i', musicPath,
      '-filter_complex',
      // normalize=0 : sans ca, amix divise automatiquement TOUS les flux par
      // 1/N (ici /2) pour eviter le clipping — la voix deja pleine echelle
      // se retrouverait inutilement attenuee de moitie en plus du ducking
      // deliberement applique a la musique via volume=${musicVolume}.
      `[1:a]volume=${musicVolume},afade=t=out:st=${fadeStart}:d=2[music];` +
        `[0:a]${voiceFilter}[voice];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=false:latency=true[aout]`,
      '-map', '[aout]',
      '-t', String(totalDurationSeconds),
      ...audioFormat, '-c:a', 'aac', '-b:a', '192k',
      outputPath,
    ]
  }
  if (voicePath) {
    return ['-i', voicePath, '-af', voiceFilter, '-t', String(totalDurationSeconds), ...audioFormat, '-c:a', 'aac', '-b:a', '192k', outputPath]
  }
  if (musicPath) {
    return [
      '-stream_loop', '-1', '-i', musicPath,
      '-af', `volume=${musicVolume},afade=t=out:st=${fadeStart}:d=2,apad`,
      '-t', String(totalDurationSeconds),
      ...audioFormat, '-c:a', 'aac', '-b:a', '192k',
      outputPath,
    ]
  }
  return [
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-t', String(totalDurationSeconds),
    ...audioFormat, '-c:a', 'aac', '-b:a', '128k',
    outputPath,
  ]
}
