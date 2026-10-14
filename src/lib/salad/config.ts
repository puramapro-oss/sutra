import { z } from 'zod'
import { SaladError, qualificationSchema, quoteSchema } from './contracts'

const secret = z.string().min(32).max(512).regex(/^[A-Za-z0-9._~-]+$/)
const enabledSchema = z.object({
  enabled: z.literal(true), gatewayUrl: z.string(), gatewayApiKey: secret, workerToken: secret,
  qualification: qualificationSchema, quote: quoteSchema,
  requestTimeoutMs: z.number().int().min(100).max(90000),
  generationTimeoutMs: z.number().int().min(1000).max(1800000),
}).strict()
export type ActiveConfig = z.infer<typeof enabledSchema>
export type SaladConfig = { enabled: false } | ActiveConfig
const workerSchema = enabledSchema.omit({ gatewayUrl: true, gatewayApiKey: true }).strip()
export type WorkerConfig = { enabled: false } | z.infer<typeof workerSchema>

// Separate trust boundary: the remote GPU receives no account/gateway API key.
// Accepting the superset eases shared fixture use, but these fields are stripped.
export function saladWorkerConfig(raw?: unknown): WorkerConfig {
  if (typeof window !== 'undefined') throw new SaladError('SALAD_SERVER_ONLY')
  if (raw === undefined || (raw && typeof raw === 'object' && 'enabled' in raw && raw.enabled === false)) {
    return Object.freeze({ enabled: false })
  }
  const parsed = workerSchema.safeParse(raw)
  if (!parsed.success) throw new SaladError('SALAD_INVALID_WORKER_CONFIG')
  return Object.freeze(parsed.data)
}

export function saladWorkerEnvironmentConfig(values: Record<string, string | undefined> = process.env): WorkerConfig {
  if (values.SALAD_ENABLED !== 'true') return saladWorkerConfig()
  try {
    return saladWorkerConfig({ enabled: true, workerToken: values.SALAD_WORKER_TOKEN,
      qualification: JSON.parse(values.SALAD_QUALIFICATION_JSON ?? ''), quote: JSON.parse(values.SALAD_QUOTE_JSON ?? ''),
      requestTimeoutMs: Number(values.SALAD_REQUEST_TIMEOUT_MS), generationTimeoutMs: Number(values.SALAD_GENERATION_TIMEOUT_MS) })
  } catch { throw new SaladError('SALAD_INVALID_WORKER_CONFIG') }
}

// Explicit server injection only: no env read, no default activation, no client-side export barrel.
export function saladConfig(raw?: unknown): SaladConfig {
  if (typeof window !== 'undefined') throw new SaladError('SALAD_SERVER_ONLY')
  if (raw === undefined || (raw && typeof raw === 'object' && 'enabled' in raw && raw.enabled === false)) {
    return Object.freeze({ enabled: false })
  }
  const parsed = enabledSchema.safeParse(raw)
  if (!parsed.success) throw new SaladError('SALAD_INVALID_CONFIG')
  let url: URL
  try { url = new URL(parsed.data.gatewayUrl) } catch { throw new SaladError('SALAD_INVALID_GATEWAY') }
  // The integration must use the protected Container Gateway, never the management/provisioning API.
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.salad\.cloud$/.test(url.hostname)
    || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new SaladError('SALAD_INVALID_GATEWAY')
  }
  if (parsed.data.workerToken === parsed.data.gatewayApiKey) throw new SaladError('SALAD_DISTINCT_CREDENTIALS_REQUIRED')
  return Object.freeze({ ...parsed.data, gatewayUrl: url.origin })
}
export function requireActive(config: SaladConfig): ActiveConfig {
  if (!config.enabled) throw new SaladError('SALAD_DISABLED')
  return config
}
