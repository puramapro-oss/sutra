import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { createHash } from 'node:crypto'
import { downloadVideoBytes } from '@/lib/media-download'
import { verifyVideoBytes, type VerifiedVideo } from '@/lib/media-probe'
import { uploadToStorage } from '@/lib/storage'

export type ShotstackFormat = '9:16' | '16:9' | '1:1'
export type ShotstackQuality = 'sd' | 'hd' | '1080' | '4k'
export interface AssembleClip {
  url: string
  type: 'ia' | 'stock'
  kind?: 'video' | 'photo'
  duration?: number
}
interface SubtitleEntry { text: string; start: number; end: number }
interface AssembleParams {
  clips: AssembleClip[]
  voiceUrl: string
  musicUrl: string
  musicVolume: number
  subtitles: SubtitleEntry[]
  transitions: string
  format: string
  quality: string
  brandKit?: { intro_template?: string; outro_template?: string; logo_url?: string } | null
  /** Persist the submission intent and remote ID before starting the long poll. */
  renderJob?: {
    id?: string
    onSubmitting?: () => Promise<void>
    onSubmitted?: (id: string) => Promise<void>
  }
}
export interface AssembleResult {
  url: string
  timeline: Record<string, unknown>
  duration: number
  /** Requested output preset, NOT a measurement of the delivered file. */
  outputQuality: ShotstackQuality
  /** Expected dimensions. Verify the file before certifying a final export. */
  outputSize: { width: number; height: number }
  outputVerified: boolean
  verification?: VerifiedVideo & { sha256: string; url: string }
}

/** Verification and durable copy are distinct from the chargeable render.
 * Retrying this operation never submits a new Shotstack job. */
export async function verifyAndStoreRenderedVideo(
  rendered: AssembleResult,
  owner: { userId: string; mediaId: string; requireAudio: boolean },
  providers = { download: downloadVideoBytes, verify: verifyVideoBytes, upload: uploadToStorage },
): Promise<AssembleResult> {
  if (rendered.outputVerified) return rendered
  if (!owner.userId || !owner.mediaId) throw new Error('SUTRA_MEDIA_OWNER_REQUIRED')
  const bytes = await providers.download(rendered.url)
  const measured = await providers.verify(bytes, {
    ...rendered.outputSize, duration: rendered.duration, fps: 30, requireAudio: owner.requireAudio,
  })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const objectId = createHash('sha256').update(owner.mediaId).digest('hex')
  const url = await providers.upload(`final/${encodeURIComponent(owner.userId)}/${objectId}/${sha256}.mp4`, bytes, 'video/mp4')
  if (!url) throw new Error('SUTRA_MEDIA_PERSISTENCE_FAILED')
  const verification = { ...measured, sha256, url }
  return { ...rendered, url, duration: measured.duration, outputSize: { width: measured.width, height: measured.height },
    outputVerified: true, verification, timeline: { ...rendered.timeline, sutraVerification: verification } }
}

/** Reuse the remote render after an interruption; never resubmit an unknown one. */
export function durableRenderJob(
  steps: Record<string, unknown>,
  checkpoint?: (key: string, value: unknown) => Promise<void>,
): NonNullable<AssembleParams['renderJob']> {
  const id = steps.assembly_render_id
  if (steps.assembly_submission_started && (typeof id !== 'string' || !id.trim())) {
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: rendu soumis sans identifiant confirme')
  }
  const save = async (key: string, value: unknown) => {
    await checkpoint?.(key, value)
    steps[key] = value
  }
  return {
    id: typeof id === 'string' ? id : undefined,
    onSubmitting: () => save('assembly_submission_started', true),
    onSubmitted: (renderId) => save('assembly_render_id', renderId),
  }
}

function baseUrl(): string {
  const stage = process.env.SHOTSTACK_ENV?.trim() || 'stage'
  if (stage !== 'stage' && stage !== 'v1') throw new Error('SUTRA_SHOTSTACK_INVALID_ENV')
  return `https://api.shotstack.io/edit/${stage}`
}
function qualityFor(requested: string): '720p' | '1080p' | '4k' {
  const value = requested.trim().toLowerCase()
  if (value === 'uhd') return '4k'
  if (value === '720p' || value === '1080p' || value === '4k') return value
  throw new Error('SUTRA_SHOTSTACK_UNSUPPORTED_QUALITY')
}
function formatFor(value: string): ShotstackFormat {
  if (value === '16:9' || value === '9:16' || value === '1:1') return value
  throw new Error('SUTRA_SHOTSTACK_UNSUPPORTED_FORMAT')
}

/** Backward-compatible label mapping; not proof of native detail or file size. */
export function actualQualityFor(_requested: string, outputQuality: ShotstackQuality): string {
  const labels = { sd: '576p', hd: '720p', '1080': '1080p', '4k': '4k' }
  if (!Object.prototype.hasOwnProperty.call(labels, outputQuality)) throw new Error('SUTRA_SHOTSTACK_UNKNOWN_OUTPUT')
  return labels[outputQuality]
}

function outputFor(format: ShotstackFormat, quality: '720p' | '1080p' | '4k') {
  const short = quality === '4k' ? 2160 : quality === '1080p' ? 1080 : 720
  const long = short * 16 / 9
  const size = format === '16:9' ? { width: long, height: short }
    : format === '9:16' ? { width: short, height: long } : { width: short, height: short }
  const outputQuality: ShotstackQuality = quality === '4k' ? '4k' : quality === '1080p' ? '1080' : 'hd'
  if (quality === '4k') {
    // Official custom VIDEO size limit is 1920. Do not invent a 2160px square.
    // The 4k preset needs provider account entitlement; disabled unless confirmed.
    if (format === '1:1' || process.env.SHOTSTACK_4K_ENABLED !== 'true') {
      throw new Error('SUTRA_SHOTSTACK_4K_UNAVAILABLE: aucun rendu inferieur soumis')
    }
    return { size, outputQuality, output: { format: 'mp4', resolution: '4k', aspectRatio: format, fps: 30 } }
  }
  // Official API: custom size must OMIT resolution AND aspectRatio.
  return { size, outputQuality, output: { format: 'mp4', size, fps: 30 } }
}
function validUrl(value: string): string {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('SUTRA_SHOTSTACK_INVALID_MEDIA_URL')
  return url.href
}
function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`SUTRA_SHOTSTACK_INVALID_${label}`)
  return value
}
function buildTracks(params: AssembleParams) {
  if (!Array.isArray(params.clips) || !params.clips.length) throw new Error('SUTRA_SHOTSTACK_EMPTY_CLIPS')
  if (!Number.isFinite(params.musicVolume) || params.musicVolume < 0 || params.musicVolume > 1) throw new Error('SUTRA_SHOTSTACK_INVALID_VOLUME')
  const visual: Array<Record<string, unknown>> = []
  const intro = params.brandKit?.intro_template ? 3 : 0
  if (intro) visual.push({asset:{type:'video',src:validUrl(params.brandKit!.intro_template!)},start:0,length:intro,transition:{in:'fade',out:'fade'}})
  let cursor = intro
  const fade = ['fade','crossfade','fondu'].includes(params.transitions.trim().toLowerCase())
  for (const clip of params.clips) {
    const length = positive(clip.duration ?? 5, 'CLIP_DURATION')
    const url = validUrl(clip.url)
    const kind = clip.kind ?? (/\.(jpe?g|png|webp|avif|gif)$/i.test(new URL(url).pathname) ? 'photo' : 'video')
    if (kind !== 'video' && kind !== 'photo') throw new Error('SUTRA_SHOTSTACK_INVALID_MEDIA_KIND')
    visual.push({asset:{type:kind==='photo'?'image':'video',src:url},start:cursor,length,transition:{in:fade?'fade':'none'}})
    cursor += length
    if (!Number.isFinite(cursor) || cursor > 86_400) throw new Error('SUTRA_SHOTSTACK_TIMELINE_TOO_LONG')
  }
  const bodyEnd = cursor
  if (params.brandKit?.outro_template) visual.push({asset:{type:'video',src:validUrl(params.brandKit.outro_template)},start:cursor,length:3,transition:{in:'fade'}})
  const subtitles: Array<Record<string, unknown>> = []
  for (const sub of params.subtitles) {
    if (!Number.isFinite(sub.start) || !Number.isFinite(sub.end) || sub.start < 0 || sub.end <= sub.start) throw new Error('SUTRA_SHOTSTACK_INVALID_SUBTITLE')
    const start = intro + sub.start
    const end = Math.min(intro + sub.end, bodyEnd)
    if (!sub.text.trim() || end <= start) continue
    subtitles.push({asset:{type:'title',text:sub.text,style:'subtitle',size:'small'},start,length:end-start,position:'bottom'})
  }
  const voice = params.voiceUrl.trim() ? [{asset:{type:'audio',src:validUrl(params.voiceUrl)},start:intro,length:bodyEnd-intro}] : []
  // Shotstack track zero is the top layer: subtitles must precede video.
  const logo = params.brandKit?.logo_url
    ? [{clips:[{asset:{type:'image',src:validUrl(params.brandKit.logo_url)},start:0,length:cursor + (params.brandKit.outro_template ? 3 : 0),position:'topRight',scale:0.15}]}]
    : []
  return [ ...(subtitles.length ? [{clips:subtitles}] : []), ...logo, {clips:visual}, ...(voice.length ? [{clips:voice}] : []) ]
}

export async function assembleFinalVideo(params: AssembleParams): Promise<AssembleResult> {
  const format = formatFor(params.format)
  const quality = qualityFor(params.quality)
  const { size, outputQuality, output } = outputFor(format, quality)
  const timeline: Record<string, unknown> = {background:'#000000',tracks:buildTracks(params)}
  if (params.musicUrl.trim()) timeline.soundtrack = {src:validUrl(params.musicUrl),effect:'fadeOut',volume:params.musicVolume}
  const apiKey = requireEnv('SHOTSTACK_API_KEY', 'montage final Shotstack')
  const base = baseUrl()
  const body = {timeline,output}
  let id: unknown = params.renderJob?.id
  if (id === undefined) {
    await params.renderJob?.onSubmitting?.()
    const res = await fetchWithRetry(`${base}/render`, {method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(body)})
    if (!res.ok) throw new Error(`Shotstack: ${await httpErrorMessage(res)}`)
    const data = await res.json() as { response?: { id?: unknown } }
    id = data?.response?.id
    if (typeof id !== 'string' || !id.trim() || id.length > 256) throw new Error('Shotstack: reponse invalide (id absent)')
    await params.renderJob?.onSubmitted?.(id)
  }
  if (typeof id !== 'string' || !id.trim() || id.length > 256) throw new Error('Shotstack: reponse invalide (id absent)')
  const result = await pollShotstackRender(id, apiKey, base)
  const expectedDuration = params.clips.reduce((sum, clip) => sum + (clip.duration ?? 5), 0)
    + (params.brandKit?.intro_template ? 3 : 0) + (params.brandKit?.outro_template ? 3 : 0)
  return {url:result.url,timeline:body,duration:expectedDuration,outputQuality,outputSize:size,outputVerified:false}
}
async function pollShotstackRender(renderId: string, apiKey: string, base: string): Promise<{url:string;duration:number}> {
  const deadline = AbortSignal.timeout(300_000)
  const end = Date.now() + 300_000
  while (Date.now() < end) {
    deadline.throwIfAborted()
    const res = await fetch(`${base}/render/${encodeURIComponent(renderId)}`, {headers:{'x-api-key':apiKey},redirect:'error',signal:AbortSignal.any([deadline,AbortSignal.timeout(15_000)])})
    if (!res.ok) {
      if ([401,403,404].includes(res.status)) throw new Error(`Shotstack status: HTTP ${res.status}`)
      try { await res.body?.cancel() } catch { /* release unsuccessful poll */ }
      await sleep(5000, deadline)
      continue
    }
    const data = await res.json() as {response?:{status?:string;url?:string;duration?:number}}
    if (data?.response?.status === 'done') {
      if (!data.response.url) throw new Error('Shotstack: rendu termine sans URL')
      return {url:validUrl(data.response.url),duration:positive(data.response.duration ?? 0,'OUTPUT_DURATION')}
    }
    if (data?.response?.status === 'failed') throw new Error('Shotstack: rendu echoue')
    await sleep(5000, deadline)
  }
  throw new Error('Shotstack: timeout')
}

/** Approximate captions only; use audio alignment for an accurately timed release. */
export function generateSubtitlesFromScript(narration: string, scenes: Array<{duration_seconds:number}>): SubtitleEntry[] {
  const words = narration.trim().split(/\s+/).filter(Boolean)
  if (!words.length || !scenes.length) return []
  const total = scenes.reduce((sum,scene)=>sum+positive(scene.duration_seconds,'SCENE_DURATION'),0)
  positive(total,'TOTAL_DURATION')
  const result: SubtitleEntry[] = []
  for (let i=0;i<words.length;i+=8) {
    const start=i/words.length*total
    const end=Math.min(i+8,words.length)/words.length*total
    result.push({text:words.slice(i,i+8).join(' '),start,end})
  }
  return result
}
