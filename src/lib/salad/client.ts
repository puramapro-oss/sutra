import { verifyVideoBytes } from '../media-probe'
import { saladConfig, requireActive } from './config'
import { boundedBytes, boundedJson, type Fetcher } from './http'
import { PROTOCOL, MODEL, SaladError, capabilitiesSchema, identity, inputSchema, jobSchema,
  sha256, type DurableJournal, type Job, type VideoInput } from './contracts'

export function createSaladClient(rawConfig: unknown, journal: DurableJournal, fetcher: Fetcher = fetch) {
  const config = saladConfig(rawConfig)
  if (journal.kind !== 'submission-intent') throw new SaladError('SALAD_INTENT_JOURNAL_REQUIRED')
  async function request(path: string, method: 'GET' | 'POST', body?: unknown) {
    const active = requireActive(config)
    const signal = AbortSignal.timeout(active.requestTimeoutMs)
    const response = await fetcher(`${active.gatewayUrl}${path}`, {
      method, signal, redirect: 'error', cache: 'no-store',
      headers: { 'Authorization': `Bearer ${active.workerToken}`, 'Salad-Api-Key': active.gatewayApiKey,
        'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { response, signal }
  }
  async function save(previous: Job, next: Job): Promise<Job> {
    const checked = jobSchema.parse({ ...next, revision: previous.revision + 1 })
    if (!await journal.compareAndSet(previous, checked)) throw new SaladError('SALAD_JOURNAL_CONFLICT')
    return checked
  }
  function matchRemote(previous: Job, data: unknown): Job {
    const parsed = jobSchema.safeParse(data)
    if (!parsed.success) throw new SaladError('SALAD_INVALID_JOB')
    const remote = parsed.data
    if (remote.id !== previous.id || remote.scope !== previous.scope || remote.fingerprint !== previous.fingerprint
      || remote.qualificationId !== previous.qualificationId || remote.status === 'submitting'
      || remote.quoteEvidenceSha256 !== previous.quoteEvidenceSha256 || remote.timeoutMs !== previous.timeoutMs
      || remote.estimatedComputeUsd !== previous.estimatedComputeUsd || (remote.artifact && remote.artifact.key !== remote.id)) {
      throw new SaladError('SALAD_JOB_MISMATCH')
    }
    return { ...previous, status: remote.status, artifact: remote.artifact }
  }
  async function capabilities() {
    if (!config.enabled) return { protocol: PROTOCOL, provider: 'salad' as const, state: 'disabled' as const,
      qualification: null, operations: ['text-to-video'] as ['text-to-video'], audio: false as const,
      native4k: false as const, maxConcurrent: 1 as const, quotaRemaining: null, quote: null, generationTimeoutMs: null }
    try {
      const { response, signal } = await request('/v1/capabilities', 'GET')
      if (!response.ok) { await response.body?.cancel(); throw new SaladError('SALAD_CAPABILITIES_HTTP', response.status) }
      const parsed = capabilitiesSchema.safeParse(await boundedJson(response, signal))
      if (!parsed.success) throw new SaladError('SALAD_INVALID_CAPABILITIES')
      return parsed.data
    } catch (error) {
      if (error instanceof SaladError) throw error
      throw new SaladError('SALAD_CAPABILITIES_UNREACHABLE')
    }
  }
  async function reconcile(previous: Job): Promise<Job> {
    requireActive(config)
    if (['succeeded', 'rejected'].includes(previous.status)) return previous
    let status: number | null = null
    let next: Job
    try {
      const { response, signal } = await request(`/v1/jobs/${previous.id}`, 'GET')
      status = response.status
      if (!response.ok) { await response.body?.cancel(); throw new SaladError('SALAD_RECONCILE_HTTP', status) }
      next = matchRemote(previous, await boundedJson(response, signal))
      if (next.status === 'running' && Date.now() > next.reconcileAfter) next.status = 'unknown'
    } catch { next = { ...previous, status: 'unknown', artifact: null } }
    return save(previous, { ...next, lastHttpStatus: status })
  }
  async function submit(scope: string, operationId: string, value: VideoInput, maxEstimatedComputeUsd: number): Promise<Job> {
    const active = requireActive(config)
    const parsed = inputSchema.safeParse(value)
    if (!parsed.success || !Number.isFinite(maxEstimatedComputeUsd) || maxEstimatedComputeUsd <= 0) throw new SaladError('SALAD_INVALID_INPUT')
    const input = parsed.data
    const ids = identity(scope, operationId, input, active.qualification.id)
    const previous = await journal.load(ids.id)
    if (previous) {
      if (previous.fingerprint !== ids.fingerprint || previous.scope !== ids.scope) throw new SaladError('SALAD_IDEMPOTENCY_CONFLICT')
      return reconcile(jobSchema.parse(previous)) // Never POST again, including remote 404 or lost worker.
    }
    const caps = await capabilities()
    const now = Date.now()
    if (caps.state !== 'ready' || caps.generationTimeoutMs !== active.generationTimeoutMs || sha256(JSON.stringify(caps.qualification)) !== sha256(JSON.stringify(active.qualification))
      || sha256(JSON.stringify(caps.quote)) !== sha256(JSON.stringify(active.quote))) throw new SaladError('SALAD_NOT_QUALIFIED')
    if (active.qualification.verifiedAt > now || active.quote.observedAt > now || active.quote.expiresAt <= now) throw new SaladError('SALAD_STALE_QUOTE')
    if (!active.qualification.profiles.some(p => JSON.stringify(p) === JSON.stringify(input.profile))) throw new SaladError('SALAD_UNSUPPORTED_PROFILE')
    const estimate = active.quote.hourlyRate * active.generationTimeoutMs / 3600000
    if (estimate > maxEstimatedComputeUsd) throw new SaladError('SALAD_ESTIMATE_EXCEEDS_BUDGET')
    const intention: Job = { protocol: PROTOCOL, ...ids, revision: 0, status: 'submitting', submittedAt: now,
      reconcileAfter: now + active.generationTimeoutMs, provider: 'salad', model: MODEL,
      qualificationId: active.qualification.id, estimatedComputeUsd: estimate, actualUsd: null,
      costBasis: 'approved-hourly-quote-times-timeout-excludes-idle-storage-network',
      quoteEvidenceSha256: active.quote.evidenceSha256, quotaRemaining: null, timeoutMs: active.generationTimeoutMs,
      lastHttpStatus: null, artifact: null }
    const claim = await journal.reserve(intention)
    if (claim === 'busy') throw new SaladError('SALAD_ENGINE_BUSY')
    if (claim === 'existing') {
      const found = await journal.load(ids.id)
      if (!found || found.fingerprint !== ids.fingerprint || found.scope !== ids.scope) throw new SaladError('SALAD_JOURNAL_CONFLICT')
      return reconcile(jobSchema.parse(found))
    }
    let status: number | null = null
    let next: Job
    try {
      const { response, signal } = await request('/v1/jobs', 'POST', {
        ...ids, input, qualificationId: active.qualification.id, maxEstimatedComputeUsd,
      })
      status = response.status
      if (!response.ok) { await response.body?.cancel(); throw new SaladError('SALAD_SUBMIT_HTTP', status) }
      next = matchRemote(intention, await boundedJson(response, signal))
    } catch { next = { ...intention, status: 'unknown', artifact: null } }
    return save(intention, { ...next, lastHttpStatus: status })
  }
  async function resume(scope: string, operationId: string, input: VideoInput): Promise<Job> {
    const active = requireActive(config)
    const ids = identity(scope, operationId, inputSchema.parse(input), active.qualification.id)
    const previous = await journal.load(ids.id)
    if (!previous || previous.fingerprint !== ids.fingerprint || previous.scope !== ids.scope) throw new SaladError('SALAD_UNKNOWN_INTENT')
    return reconcile(jobSchema.parse(previous))
  }
  async function download(job: Job, input: VideoInput): Promise<Uint8Array> {
    const checked = jobSchema.parse(job)
    const parsedInput = inputSchema.safeParse(input)
    if (!parsedInput.success || identity('download', 'download', parsedInput.data, checked.qualificationId).fingerprint !== checked.fingerprint) throw new SaladError('SALAD_INPUT_MISMATCH')
    if (checked.status !== 'succeeded' || !checked.artifact) throw new SaladError('SALAD_NO_VERIFIED_RESULT')
    try {
      const { response, signal } = await request(`/v1/jobs/${checked.id}/media`, 'GET')
      if (!response.ok || !response.headers.get('content-type')?.startsWith('video/mp4')) throw new SaladError('SALAD_MEDIA_HTTP')
      const bytes = await boundedBytes(response, 64 * 1024 * 1024, signal)
      if (bytes.length !== checked.artifact.bytes || sha256(bytes) !== checked.artifact.sha256) throw new SaladError('SALAD_MEDIA_HASH')
      await verifyVideoBytes(bytes, { width: input.profile.width, height: input.profile.height,
        duration: input.profile.num_frames / input.profile.fps, fps: input.profile.fps })
      return bytes
    } catch { throw new SaladError('SALAD_MEDIA_UNVERIFIED') }
  }
  // Storage/validation failures may contain connection strings or user input; expose only stable codes.
  const safe = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    try { return await fn(...args) } catch (error) {
      if (error instanceof SaladError) throw error
      throw new SaladError('SALAD_SAFE_FAILURE')
    }
  }
  return { capabilities: safe(capabilities), submit: safe(submit), resume: safe(resume), download: safe(download) }
}
