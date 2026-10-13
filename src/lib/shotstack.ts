import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { createHash } from 'node:crypto'
import { downloadVideoBytes } from '@/lib/media-download'
import { verifyVideoBytes, type VerifiedVideo } from '@/lib/media-probe'
import { uploadToStorage } from '@/lib/storage'
import { compositionPlan, type CompositionContract, type CompositionRequirements, type MediaLineage } from './composition-contract'
import { measureCompositionAudio, validateRenderedBuffer, type MediaValidation } from './media-validation'
import { buildTracks, shotstackContract } from './shotstack-timeline'
import { boundedProviderJson } from './provider-json'
import { resolveMediaTree } from './private-media'

export type ShotstackFormat = '9:16' | '16:9' | '1:1'
export type ShotstackQuality = 'sd' | 'hd' | '1080' | '4k'
export interface AssembleClip {
  url: string
  type: 'ia' | 'stock'
  kind?: 'video' | 'photo'
  duration?: number
  lineage?: MediaLineage
}
interface SubtitleEntry { text: string; start: number; end: number }
export interface AssembleParams {
  signal?: AbortSignal
  requirements?: CompositionRequirements
  watermarkText?: string | null
  watermarkUrl?: string | null
  introOutroDurationSeconds?: number
  clips: AssembleClip[]
  voiceUrl: string
  musicUrl: string
  voiceVolume?: number
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
  validation?: MediaValidation
  contract?: CompositionContract
  verification?: VerifiedVideo & { sha256: string; url: string }
}

/** Verification and durable copy are distinct from the chargeable render.
 * Retrying this operation never submits a new Shotstack job. */
export async function verifyAndStoreRenderedVideo(
  rendered: AssembleResult,
  owner: { userId: string; mediaId: string; requireAudio: boolean },
  providers = { download: downloadVideoBytes, verify: verifyVideoBytes, upload: uploadToStorage },
): Promise<AssembleResult> {
  // Only a complete receipt for the exact durable URL can be reused.
  if (rendered.outputVerified && rendered.verification?.url === rendered.url
    && /^[a-f0-9]{64}$/.test(rendered.verification.sha256)) return rendered
  if (!owner.userId || !owner.mediaId) throw new Error('SUTRA_MEDIA_OWNER_REQUIRED')
  const bytes = await providers.download(rendered.url)
  const measured = await providers.verify(bytes, {
    ...rendered.outputSize, duration: rendered.duration, fps: 30, requireAudio: owner.requireAudio,
  })
  const validation = rendered.contract ? await validateRenderedBuffer(bytes, rendered.contract) : undefined
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const objectId = createHash('sha256').update(owner.mediaId).digest('hex')
  const url = await providers.upload(`final/${encodeURIComponent(owner.userId)}/${objectId}/${sha256}.mp4`, bytes, 'video/mp4')
  if (!url) throw new Error('SUTRA_MEDIA_PERSISTENCE_FAILED')
  const verification = { ...measured, sha256, url }
  return { ...rendered, url, duration: measured.duration, outputSize: { width: measured.width, height: measured.height },
    outputVerified: true, verification, validation, timeline: { ...rendered.timeline, sutraVerification: verification } }
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

export async function assembleFinalVideo(params: AssembleParams, deps: { measureAudio?: typeof measureCompositionAudio } = {}): Promise<AssembleResult> {
  const format = formatFor(params.format)
  const quality = qualityFor(params.quality)
  const { size, outputQuality, output } = outputFor(format, quality)
  const contract = shotstackContract(params)
  const plan = compositionPlan(contract)
  params.signal?.throwIfAborted()
  // Bind the credential to the exact environment before resolving any media.
  // Never try the other environment's key after an authentication failure.
  const base = baseUrl()
  const apiKey = requireEnv(base.endsWith('/v1') ? 'SHOTSTACK_PRODUCTION_KEY' : 'SHOTSTACK_API_KEY', 'montage final Shotstack')
  const audio = await (deps.measureAudio ?? measureCompositionAudio)(contract, params.signal)
  const timeline: Record<string, unknown> = {background:'#000000',tracks:buildTracks({ ...params, watermarkUrl: contract.watermarkUrl }, audio.music?.duration)}
  const body = {timeline,output}
  let id: unknown = params.renderJob?.id
  if (id === undefined) {
    const transportBody = await resolveMediaTree(body)
    await params.renderJob?.onSubmitting?.()
    const res = await fetchWithRetry(`${base}/render`, {method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey},body:JSON.stringify(transportBody),signal:params.signal,redirect:'error'})
    if (!res.ok) throw new Error(`Shotstack: ${await httpErrorMessage(res)}`)
    const data = await boundedProviderJson(res) as { response?: { id?: unknown } }
    id = data?.response?.id
    if (typeof id !== 'string' || !id.trim() || id.length > 256) throw new Error('Shotstack: reponse invalide (id absent)')
    await params.renderJob?.onSubmitted?.(id)
  }
  if (typeof id !== 'string' || !id.trim() || id.length > 256) throw new Error('Shotstack: reponse invalide (id absent)')
  const result = await pollShotstackRender(id, apiKey, base, params.signal)
  return {url:result.url,timeline:{ ...body, sutraEditorClips: params.clips },duration:plan.total,outputQuality,outputSize:size,outputVerified:false,contract}
}
async function pollShotstackRender(renderId: string, apiKey: string, base: string, signal?: AbortSignal): Promise<{url:string;duration:number}> {
  const deadline = AbortSignal.any([AbortSignal.timeout(300_000), ...(signal ? [signal] : [])])
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
    const data = await boundedProviderJson(res) as {response?:{status?:string;url?:string;duration?:number}}
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
