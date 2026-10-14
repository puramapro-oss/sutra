import { timingSafeEqual } from 'node:crypto'
import { saladWorkerConfig } from './config'
import { PROTOCOL, MODEL, SaladError, sha256, submissionSchema, jobSchema,
  type Capabilities, type DurableJournal, type Job, type VideoInput } from './contracts'
import { boundedJson, json } from './http'
import type { createComfyBridge } from './engine'

/** Read real artifacts/hardware, not configuration echoes. Bound by the dedicated Salad host. */
export interface RuntimeInspection {
  platform: string; architecture: string; image: string; cuda: string; gpu: string
  vramMiB: number; freeVramMiB: number; modelSha256: string; encoderSha256: string; vaeSha256: string
  state: 'idle' | 'cold' | 'interrupted' | 'busy'
}
export interface ArtifactStore {
  // Durable, immutable put-if-absent. Return only after bytes+hash have been persisted and checked.
  put(id: string, bytes: Uint8Array, digest: string): Promise<void>
  get(id: string): Promise<Uint8Array | null>
}
export interface WorkerPorts {
  journal: DurableJournal
  artifacts: ArtifactStore
  inspect(): Promise<RuntimeInspection>
  bridge: ReturnType<typeof createComfyBridge>
}

/** No listener or provisioning side effect. Host must stay alive and await drain on shutdown.
 * The only compute entry is a NEW atomic durable claim; GET/restart never starts computation.
 */
export function createSaladWorker(rawConfig: unknown, ports: WorkerPorts) {
  const config = saladWorkerConfig(rawConfig)
  if (ports.journal.kind !== 'exclusive-execution') throw new SaladError('SALAD_EXCLUSIVE_JOURNAL_REQUIRED')
  const pending = new Set<Promise<void>>()
  let persistenceFault = false
  let draining = false
  function authenticated(request: Request): boolean {
    if (!config.enabled) return false
    return timingSafeEqual(Buffer.from(sha256(request.headers.get('authorization') ?? '')),
      Buffer.from(sha256(`Bearer ${config.workerToken}`)))
  }
  async function capabilities(): Promise<Capabilities> {
    const result: Capabilities = { protocol: PROTOCOL, provider: 'salad', state: 'disabled',
      qualification: null, operations: ['text-to-video'], audio: false, native4k: false,
      maxConcurrent: 1, quotaRemaining: null, quote: null, generationTimeoutMs: null }
    if (!config.enabled) return result
    result.qualification = config.qualification
    result.quote = config.quote
    result.generationTimeoutMs = config.generationTimeoutMs
    if (persistenceFault || draining) return { ...result, state: 'interrupted' }
    if (pending.size) return { ...result, state: 'busy' }
    try {
      if (!ports.journal.readActive) return { ...result, state: 'interrupted' }
      const active = await ports.journal.readActive()
      if (active !== null) {
        const held = jobSchema.parse(active)
        return { ...result, state: held.status === 'running' && held.reconcileAfter > Date.now() ? 'busy' : 'interrupted' }
      }
      const runtime = await ports.inspect()
      if (runtime.state !== 'idle') return { ...result, state: runtime.state }
      const q = config.qualification
      if (runtime.platform !== 'linux' || runtime.architecture !== 'x64' || runtime.image !== q.image
        || runtime.cuda !== q.cuda || runtime.gpu !== q.gpu || runtime.vramMiB !== q.vramMiB
        || !Number.isFinite(runtime.freeVramMiB) || runtime.freeVramMiB < q.requiredFreeVramMiB
        || runtime.modelSha256 !== q.modelSha256 || runtime.encoderSha256 !== q.encoderSha256 || runtime.vaeSha256 !== q.vaeSha256
        || q.verifiedAt > Date.now()) return { ...result, state: 'incompatible' }
      return { ...result, state: await ports.bridge.health() ? 'ready' : 'cold' }
    } catch { return { ...result, state: 'interrupted' } }
  }
  async function execute(job: Job, input: VideoInput): Promise<void> {
    let next: Job
    try {
      const media = await ports.bridge.generate(input, job.timeoutMs)
      if (!media.bytes.length || media.bytes.length > 64 * 1024 * 1024 || media.sha256 !== sha256(media.bytes)) throw new SaladError('SALAD_INVALID_ARTIFACT')
      await ports.artifacts.put(job.id, media.bytes, media.sha256)
      next = { ...job, status: 'succeeded', revision: job.revision + 1,
        artifact: { key: job.id, sha256: media.sha256, bytes: media.bytes.length } }
    } catch { next = { ...job, status: 'unknown', revision: job.revision + 1 } }
    // Lost fencing/store acknowledgment keeps the original claim; never release/re-generate.
    if (!await ports.journal.compareAndSet(job, jobSchema.parse(next))) throw new SaladError('SALAD_JOURNAL_CONFLICT')
  }
  async function submit(request: Request): Promise<Response> {
    if (!config.enabled) return json({ error: 'SALAD_DISABLED' }, 503)
    const signal = AbortSignal.timeout(config.requestTimeoutMs)
    const parsed = submissionSchema.safeParse(await boundedJson(new Response(request.body, { headers: request.headers }), signal))
    if (!parsed.success) return json({ error: 'SALAD_INVALID_INPUT' }, 400)
    const data = parsed.data
    const q = config.qualification
    const expected = sha256(JSON.stringify([data.input.prompt, data.input.profile.width, data.input.profile.height,
      data.input.profile.num_frames, data.input.profile.fps, q.id]))
    if (data.fingerprint !== expected || data.qualificationId !== q.id) return json({ error: 'SALAD_IDEMPOTENCY_CONFLICT' }, 409)
    const prior = await ports.journal.load(data.id)
    if (prior) {
      if (prior.scope !== data.scope || prior.fingerprint !== data.fingerprint) return json({ error: 'SALAD_IDEMPOTENCY_CONFLICT' }, 409)
      return json(jobSchema.parse(prior))
    }
    const caps = await capabilities()
    if (caps.state !== 'ready') return json({ error: 'SALAD_NOT_READY' }, 503)
    const now = Date.now()
    if (config.quote.observedAt > now || config.quote.expiresAt <= now) return json({ error: 'SALAD_STALE_QUOTE' }, 409)
    if (!q.profiles.some(p => JSON.stringify(p) === JSON.stringify(data.input.profile))) return json({ error: 'SALAD_UNSUPPORTED_PROFILE' }, 422)
    const estimate = config.quote.hourlyRate * config.generationTimeoutMs / 3600000
    if (estimate > data.maxEstimatedComputeUsd) return json({ error: 'SALAD_ESTIMATE_EXCEEDS_BUDGET' }, 422)
    const job: Job = { protocol: PROTOCOL, id: data.id, scope: data.scope, fingerprint: data.fingerprint,
      revision: 0, status: 'running', submittedAt: now, reconcileAfter: now + config.generationTimeoutMs,
      provider: 'salad', model: MODEL, qualificationId: q.id, timeoutMs: config.generationTimeoutMs,
      estimatedComputeUsd: estimate, actualUsd: null, quotaRemaining: null,
      costBasis: 'approved-hourly-quote-times-timeout-excludes-idle-storage-network',
      quoteEvidenceSha256: config.quote.evidenceSha256, lastHttpStatus: null, artifact: null }
    const claim = await ports.journal.reserve(job)
    if (claim === 'busy') return json({ error: 'SALAD_ENGINE_BUSY' }, 409)
    if (claim === 'existing') {
      const stored = await ports.journal.load(job.id)
      if (!stored || stored.fingerprint !== job.fingerprint || stored.scope !== job.scope) return json({ error: 'SALAD_IDEMPOTENCY_CONFLICT' }, 409)
      return json(jobSchema.parse(stored))
    }
    const task = execute(job, data.input).catch(() => { persistenceFault = true })
    pending.add(task)
    void task.finally(() => { pending.delete(task) })
    return json(job, 202)
  }
  async function handle(request: Request): Promise<Response> {
    if (!config.enabled) return json({ error: 'SALAD_DISABLED' }, 503)
    if (!authenticated(request)) return json({ error: 'SALAD_UNAUTHORIZED' }, 401)
    try {
      const url = new URL(request.url)
      if (url.search || url.hash) return json({ error: 'SALAD_INVALID_ROUTE' }, 400)
      if (request.method === 'GET' && url.pathname === '/v1/capabilities') return json(await capabilities())
      if (request.method === 'GET' && url.pathname === '/health') {
        const caps = await capabilities()
        return json({ protocol: PROTOCOL, state: caps.state }, caps.state === 'ready' || caps.state === 'busy' ? 200 : 503)
      }
      if (request.method === 'POST' && url.pathname === '/v1/jobs') return await submit(request)
      const match = /^\/v1\/jobs\/([a-f0-9]{64})(\/media)?$/.exec(url.pathname)
      if (request.method !== 'GET' || !match) return json({ error: 'SALAD_UNSUPPORTED_ROUTE' }, 405)
      const stored = await ports.journal.load(match[1])
      if (!stored) return json({ error: 'SALAD_JOB_NOT_FOUND' }, 404)
      const job = jobSchema.parse(stored)
      if (match[2]) {
        if (!job.artifact || job.status !== 'succeeded') return json({ error: 'SALAD_MEDIA_UNAVAILABLE' }, 409)
        const bytes = await ports.artifacts.get(job.artifact.key)
        if (!bytes || bytes.length !== job.artifact.bytes || sha256(bytes) !== job.artifact.sha256) return json({ error: 'SALAD_MEDIA_UNVERIFIED' }, 503)
        return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'video/mp4',
          'Content-Length': String(bytes.length), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
      }
      return json(job.status === 'running' && Date.now() > job.reconcileAfter ? { ...job, status: 'unknown' } : job)
    } catch { return json({ error: 'SALAD_SAFE_FAILURE' }, 503) }
  }
  async function drain(): Promise<void> {
    draining = true
    await Promise.all(pending)
    if (persistenceFault) throw new SaladError('SALAD_PERSISTENCE_UNCERTAIN')
  }
  return { handle, drain }
}
