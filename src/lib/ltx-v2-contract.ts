import { z } from 'zod'

// Official API reference + models/ltx-2-3 + pricing, checked 2026-10-12.
// V2 is an API version, not a model. Keep the approved 2.3 routing/prices.
export const LTX_CAPABILITIES = {
  checkedAt: '2026-10-12',
  source: 'https://docs.ltx.io/async-jobs',
  webhook: false,
  remoteCancellation: false,
  arbitraryVideoToVideo: false,
  multiReference: false,
  firstAndLastFrame: true,
} as const

const uri = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}, 'An HTTPS media URL is required (upload data URIs first)')
const prompt = z.string().min(1).max(5000)
const model = z.enum(['ltx-2-3-fast', 'ltx-2-3-pro'])
const resolution = z.enum(['1280x720', '720x1280', '1920x1080', '1080x1920', '2560x1440', '1440x2560', '3840x2160', '2160x3840'])
const generation = {
  prompt, model, duration: z.number().int().positive(), resolution,
  fps: z.union([z.literal(24), z.literal(25), z.literal(48), z.literal(50)]).default(24),
  generate_audio: z.boolean().default(false),
  camera_motion: z.enum(['dolly_in', 'dolly_out', 'dolly_left', 'dolly_right', 'jib_up', 'jib_down', 'static', 'focus_shift']).optional(),
}
const reframeResolution = z.enum(['720x720', '1080x1080', '720x900', '1080x1350', '900x720', '1350x1080', '720x1280', '1080x1920', '1280x720', '1920x1080'])
export const LTX_REQUESTS = {
  'text-to-video': z.object(generation).strict(),
  'image-to-video': z.object({ ...generation, image_uri: uri, last_frame_uri: uri.optional() }).strict(),
  retake: z.object({
    video_uri: uri, start_time: z.number().nonnegative(), duration: z.number().min(2),
    prompt: prompt.optional(), model: z.literal('ltx-2-3-pro').default('ltx-2-3-pro'),
    resolution: z.enum(['1920x1080', '1080x1920']).optional(),
    mode: z.enum(['replace_audio', 'replace_video', 'replace_audio_and_video']).default('replace_audio_and_video'),
  }).strict(),
  extend: z.object({
    video_uri: uri, duration: z.number().min(2).max(20), prompt: prompt.optional(),
    mode: z.enum(['start', 'end']).default('end'),
    model: z.literal('ltx-2-3-pro').default('ltx-2-3-pro'),
    context: z.number().min(1).max(20).optional(),
  }).strict(),
  'video-to-video-hdr': z.object({ video_uri: uri }).strict(),
  'video-to-video-reframe': z.object({
    video_uri: uri, resolution: reframeResolution,
    placement: z.union([
      z.object({ anchor: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top_left', 'top_right', 'bottom_left', 'bottom_right']) }).strict(),
      z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1).optional(), height: z.number().positive().max(1).optional() }).strict().refine(p => p.width !== undefined || p.height !== undefined),
    ]).optional(),
  }).strict(),
} as const

export type LtxEndpoint = keyof typeof LTX_REQUESTS
export type LtxRequest<E extends LtxEndpoint> = z.input<(typeof LTX_REQUESTS)[E]>
export interface LtxInputMedia { durationSeconds: number; fps: number; width: number; height: number }
export interface LtxCost {
  currency: 'USD'
  estimated: number
  actual: null // V2 never reports a billed amount. Do not turn an estimate into an invoice.
  actualStatus: 'not_reported'
  basis: 'output_seconds' | 'input_seconds' | 'extension_and_context_upper_bound'
  source: string
  checkedAt: string
}

export function validateLtxRequest(endpoint: LtxEndpoint, input: unknown, media?: LtxInputMedia) {
  if (!Object.prototype.hasOwnProperty.call(LTX_REQUESTS, endpoint)) throw new Error('LTX_UNSUPPORTED_CAPABILITY')
  const parsed = LTX_REQUESTS[endpoint].safeParse(input)
  // Do not include inputs or signed media URLs in errors/logs.
  if (!parsed.success) throw new Error('LTX_INVALID_REQUEST: unsupported fields or values')
  const body = parsed.data as Record<string, unknown>
  let seconds: number
  let rate: number
  let basis: LtxCost['basis'] = 'output_seconds'
  if (endpoint === 'text-to-video' || endpoint === 'image-to-video') {
    const short = Math.min(...String(body.resolution).split('x').map(Number))
    const long = body.model === 'ltx-2-3-fast' && short <= 1080 && Number(body.fps) <= 25
    const durations = long ? [6, 8, 10, 12, 14, 16, 18, 20] : [6, 8, 10]
    if (!durations.includes(Number(body.duration))) throw new Error('LTX_INVALID_DURATION')
    seconds = Number(body.duration)
    const rates = body.model === 'ltx-2-3-fast' ? [0.03, 0.06, 0.12, 0.24] : [0.04, 0.08, 0.16, 0.32]
    rate = rates[[720, 1080, 1440, 2160].indexOf(short)]
  } else {
    if (!media || ![media.durationSeconds, media.fps, media.width, media.height].every(n => Number.isFinite(n) && n > 0) || !Number.isInteger(media.width) || !Number.isInteger(media.height)) throw new Error('LTX_INPUT_METADATA_REQUIRED')
    const { durationSeconds, fps, width, height } = media
    const frames = durationSeconds * fps
    const pixels = width * height
    if (pixels > 3840 * 2160) throw new Error('LTX_INPUT_RESOLUTION_UNSUPPORTED')
    seconds = durationSeconds
    basis = 'input_seconds'
    if (endpoint === 'retake' || endpoint === 'extend') {
      if (frames < 73) throw new Error('LTX_INPUT_TOO_SHORT')
      rate = 0.10
      if (endpoint === 'retake' && Number(body.start_time) >= durationSeconds) throw new Error('LTX_INVALID_RETAKE_RANGE')
      if (endpoint === 'extend') {
        // Only 1080p extend is publicly priced. Do not invent a 4K rate.
        if (!['1920x1080', '1080x1920'].includes(`${width}x${height}`)) throw new Error('LTX_EXTEND_PRICE_UNVERIFIED')
        const context = body.context === undefined ? Math.min(20, durationSeconds, 505 / fps - Number(body.duration)) : Number(body.context)
        if (context < 1 || context > durationSeconds || (context + Number(body.duration)) * fps > 505 + 1e-8) throw new Error('LTX_INVALID_EXTEND_CONTEXT')
        seconds = Number(body.duration) + context
        basis = 'extension_and_context_upper_bound'
      }
    } else if (endpoint === 'video-to-video-hdr') {
      const tier = pixels <= 1920 * 1080 ? 0 : pixels <= 2560 * 1440 ? 1 : 2
      if (frames > [181, 101, 41][tier]) throw new Error('LTX_HDR_INPUT_TOO_LONG')
      rate = [0.20, 0.40, 0.80][tier]
    } else {
      if (durationSeconds > 60 || frames > 1800) throw new Error('LTX_REFRAME_INPUT_TOO_LONG')
      rate = String(body.resolution).includes('1080') || String(body.resolution).includes('1350') ? 0.20 : 0.10
      const p = body.placement as { x?: number; y?: number; width?: number; height?: number; anchor?: string } | undefined
      if (p && !p.anchor) {
        const [ow, oh] = String(body.resolution).split('x').map(Number)
        const w = p.width === undefined ? p.height! * oh * width / height : p.width * ow
        const h = p.height === undefined ? w * height / width : p.height * oh
        if (Math.abs(w / h - width / height) * h > 1 || w < 1 || h < 1 || w > width * 2 || h > height * 2 || p.x! * ow + w > ow || p.y! * oh + h > oh) throw new Error('LTX_INVALID_PLACEMENT')
      }
    }
  }
  const cost: LtxCost = { currency: 'USD', estimated: Number((seconds * rate).toFixed(6)), actual: null, actualStatus: 'not_reported', basis, source: 'https://docs.ltx.io/pricing', checkedAt: LTX_CAPABILITIES.checkedAt }
  return { body, cost }
}
