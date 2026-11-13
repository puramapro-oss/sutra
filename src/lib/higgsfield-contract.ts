import { z } from 'zod'

// Public REST contract checked 2026-11-11. CLI job types are NOT REST paths.
// https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate
export const HIGGSFIELD_CINEMA_ENDPOINT = 'higgsfield/cinema-studio/4.0' as const
export const HIGGSFIELD_CAPABILITIES = {
  checkedAt: '2026-11-11',
  source: 'https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate',
  endpoint: HIGGSFIELD_CINEMA_ENDPOINT,
  routed: false,
  rest3D: false,
  editing: false,
  extension: false,
  webhookImplemented: false,
} as const

export class HiggsfieldError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  readonly httpStatus: number | null
  readonly submissionUncertain: boolean
  readonly requestId: string | null
  readonly retryAfterSeconds: number | null

  constructor(
    readonly code: string,
    details: {
      httpStatus?: number
      submissionUncertain?: boolean
      requestId?: string
      retryAfterSeconds?: number
    } = {},
  ) {
    // Never attach provider bodies, input URLs, credentials, or original causes.
    super(code)
    this.name = 'HiggsfieldError'
    this.httpStatus = details.httpStatus ?? null
    this.submissionUncertain = details.submissionUncertain ?? false
    this.requestId = details.requestId ?? null
    this.retryAfterSeconds = details.retryAfterSeconds ?? null
  }
}

export const HIGGSFIELD_CINEMA_ENUMS = {
  era: ['1960s', '1980s', '1990s', '2000s', '2020s'],
  genre: ['epic', 'drama', 'noir', 'comedy', 'horror', 'action'],
  light: ['silhouette', 'practicals', 'window', 'overhead-fall', 'contre-jour', 'soft-cross'],
  pacing: ['chaotic', 'dynamic', 'calm', 'single-shot'],
  resolution: ['480p', '720p'],
  aspect_ratio: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
  camera_lens: ['clean-sharp', 'anamorphic', 'vintage-anamorphic', 'warm-vintage', 'halation-vintage'],
  camera_model: ['modern', '35mm-film', '8mm-film', 'dv-camcorder'],
  camera_aperture: ['f14-wide-open', 'f4-moderate', 'f11-deep-focus'],
  camera_movement: [
    'snorricam', 'robot-arm', 'tilt-up', 'rack-focus', 'tilt-down', 'pov',
    'pan-left', 'crane-up', 'pan-right', 'crane-down', 'side-tracking',
    'pedestal-up', 'pedestal-down', 'handheld', 'tracking', 'drone-orbit',
    'dolly-zoom', 'aerial-pullback', 'static-shot', 'bullet-time', 'whip-pan',
    'slow-zoom-in', 'arc-left', 'slow-zoom-out', 'arc-right', 'truck-right',
    'dolly-in', 'truck-left', 'dolly-out', 'slider-right', 'crush-zoom',
    'slider-left', 'helicopter-shot',
  ],
  color_palette: [
    'static-noon', 'twilight-fable', 'back-row-kissing-seats',
    'on-the-other-side-of-the-porthole', 'the-emerald-ambush', 'highway-standoff',
    'the-faded-fresco', 'oil-ochre', 'the-mountain-convent', 'ghost-in-the-code',
    'pink-velvet', 'two-days-to-the-horizon', 'industrial-fog', 'stairs-go-up',
    'field-post', 'home-is-the-next-gas-station', 'glossy-flesh',
    'the-crimson-ballet', 'neon-rain-at-midnight', 'the-morning-after-rain',
    'the-iron-borough', 'the-ground', 'the-investigation', 'turquoise-mirage',
    'a-dream-in-color', 'breakfast-on-schedule', 'favela-gold', 'a-hotel-for-one',
    'after-dark', 'crimson-vigi', 'the-neighbors-saw-everything', 'the-grey-channel',
    'mirage-at-noon', 'bubblegum-boulevard', 'yellow-room',
    'the-earth-keeps-things-reluctantly', 'tropic-fever-dream',
    'bioluminescent-night', 'dont-turn-it-off-im-watching', 'the-silk-curtain-falls',
    'the-butterfly', 'playtime', 'wallpaper-romance', 'overtime',
    'the-way-home-is-longer', 'everyone-speaks-in-whispers', 'runaway-summer',
    'amber-wasteland', 'the-circus', 'gasoline-sunset',
  ],
} as const

export function isHiggsfieldHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
  } catch { return false }
}

const mediaUrl = z.string().refine(isHiggsfieldHttpsUrl)
export const HIGGSFIELD_CINEMA_SCHEMA = z.object({
  prompt: z.string().min(1).regex(/\S/),
  duration: z.number().int().min(4).max(30).optional(),
  resolution: z.enum(HIGGSFIELD_CINEMA_ENUMS.resolution).optional(),
  aspect_ratio: z.enum(HIGGSFIELD_CINEMA_ENUMS.aspect_ratio).optional(),
  generate_audio: z.boolean().optional(),
  image_urls: z.array(mediaUrl).max(30).optional(),
  video_urls: z.array(mediaUrl).max(10).optional(),
  audio_urls: z.array(mediaUrl).max(10).optional(),
  era: z.enum(HIGGSFIELD_CINEMA_ENUMS.era).optional(),
  genre: z.enum(HIGGSFIELD_CINEMA_ENUMS.genre).optional(),
  light: z.enum(HIGGSFIELD_CINEMA_ENUMS.light).optional(),
  pacing: z.enum(HIGGSFIELD_CINEMA_ENUMS.pacing).optional(),
  camera_lens: z.enum(HIGGSFIELD_CINEMA_ENUMS.camera_lens).optional(),
  camera_model: z.enum(HIGGSFIELD_CINEMA_ENUMS.camera_model).optional(),
  camera_aperture: z.enum(HIGGSFIELD_CINEMA_ENUMS.camera_aperture).optional(),
  camera_movement: z.enum(HIGGSFIELD_CINEMA_ENUMS.camera_movement).optional(),
  color_palette: z.enum(HIGGSFIELD_CINEMA_ENUMS.color_palette).optional(),
}).strict().superRefine((body, ctx) => {
  const counts: Record<string, number> = {
    image: body.image_urls?.length ?? 0,
    video: body.video_urls?.length ?? 0,
    audio: body.audio_urls?.length ?? 0,
  }
  if (Object.values(counts).reduce((a, b) => a + b, 0) > 50) {
    ctx.addIssue({ code: 'custom', message: 'Invalid reference count' })
  }
  const remainder = body.prompt.replace(/<<<([\s\S]*?)>>>/g, (_token, content: string) => {
    const reference = /^(image|video|audio)_([1-9]\d*)$/.exec(content)
    if (!reference || !Number.isSafeInteger(Number(reference[2])) || Number(reference[2]) > counts[reference[1]]) {
      ctx.addIssue({ code: 'custom', message: 'Invalid reference token' })
    }
    return ''
  })
  if (remainder.includes('<<<') || remainder.includes('>>>')) {
    ctx.addIssue({ code: 'custom', message: 'Malformed reference token' })
  }
})

export type HiggsfieldCinemaRequest = z.infer<typeof HIGGSFIELD_CINEMA_SCHEMA>

export function validateHiggsfieldCinemaRequest(input: unknown): HiggsfieldCinemaRequest {
  try {
    const parsed = HIGGSFIELD_CINEMA_SCHEMA.safeParse(input)
    if (parsed.success) return parsed.data
  } catch { /* Untrusted input accessors must not leak their exceptions either. */ }
  throw new HiggsfieldError('HIGGSFIELD_INVALID_REQUEST')
}

export function validateHiggsfieldIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[!-~]{1,255}$/.test(value)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_IDEMPOTENCY_KEY')
  }
  return value
}

export const HIGGSFIELD_STATUSES = ['queued', 'in_progress', 'completed', 'failed', 'nsfw', 'canceled'] as const
export type HiggsfieldStatus = typeof HIGGSFIELD_STATUSES[number]

export interface HiggsfieldRequestOptions {
  expiresAfterSeconds?: number
}
export interface HiggsfieldCallOptions extends HiggsfieldRequestOptions {
  signal?: AbortSignal
}
export interface HiggsfieldEstimate {
  readonly kind: 'estimate'
  readonly currency: 'USD'
  readonly usd: string
  readonly fingerprint: string
  readonly issuedAtMs: number
  readonly expiresAtMs: number
  readonly actualUsd: null
}
export interface HiggsfieldSubmissionIntent {
  /** Supplied and durably persisted by the caller BEFORE submit. Never generated here. */
  readonly idempotencyKey: string
  readonly fingerprint: string
}
/** Approval ceiling for this request only; the caller must reserve its global quota. */
export type HiggsfieldBudget = { readonly approved: true; readonly maxUsd: string } | { readonly approved: false }
export interface HiggsfieldSubmissionOptions extends HiggsfieldCallOptions {
  estimate: HiggsfieldEstimate
  intent: HiggsfieldSubmissionIntent
  budget: HiggsfieldBudget
}
export interface HiggsfieldRequestHandle {
  readonly requestId: string
  readonly statusUrl: string
  readonly cancelUrl: string
}
export interface HiggsfieldSubmissionReceipt extends HiggsfieldRequestHandle {
  readonly status: HiggsfieldStatus
  readonly fingerprint: string
  readonly expiresAfterSeconds: number | null
}
export interface HiggsfieldPollResult {
  readonly requestId: string
  readonly status: HiggsfieldStatus
  readonly terminal: boolean
  readonly videoUrl: string | null
  readonly expiresAt: string | null
}

export function isHiggsfieldTerminalStatus(status: HiggsfieldStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'nsfw' || status === 'canceled'
}

/** Exact, nonnegative decimal USD; no exponent syntax or binary floating point. */
export function parseHiggsfieldUsd(value: unknown): string {
  if (typeof value !== 'string' || value.length > 256 || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_USD')
  }
  const [integer, fraction = ''] = value.split('.')
  const whole = integer.replace(/^0+(?=\d)/, '')
  const decimal = fraction.replace(/0+$/, '')
  return decimal ? whole + '.' + decimal : whole
}

export function compareHiggsfieldUsd(left: string, right: string): -1 | 0 | 1 {
  const [li, lf = ''] = parseHiggsfieldUsd(left).split('.')
  const [ri, rf = ''] = parseHiggsfieldUsd(right).split('.')
  if (li.length !== ri.length) return li.length < ri.length ? -1 : 1
  if (li !== ri) return li < ri ? -1 : 1
  const length = Math.max(lf.length, rf.length)
  const a = lf.padEnd(length, '0'), b = rf.padEnd(length, '0')
  return a === b ? 0 : a < b ? -1 : 1
}
