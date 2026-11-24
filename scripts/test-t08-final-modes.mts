// T08: HTTP/dispatch boundaries only. Queue, database and providers are fixtures.
// No full pipeline, worker GPU, real credentials or network requests are exercised.
import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { SUPER_ADMIN_EMAIL } from '../src/lib/constants.ts'
import type { Plan } from '../src/types/index.ts'

type Input = { userId: string; userEmail: string | null; genPlan: Plan; videoId: string; topic: string; quality: string; format: string }
type Job = { id: string; status: string; payload: { input: Input } }
const CLIENT = 'client@fixture.invalid'
let email = CLIENT, claim = true, submitted: Job | undefined
let apiCalls = 0, workerCalls = 0, externalAttempts = 0
let workerFailure: 'http' | 'timeout' = 'http'
const effects: string[] = []

mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'session-user', email } }, error: null }) } }),
} })
const query = { select: () => query, eq: () => query, single: async () => ({
  data: { id: 'session-user', email, plan: 'free', user_id: 'session-user' }, error: null,
}) }
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({ from: () => query }) } })
const { submissionErrorStatus } = await import('../src/lib/pipeline-submit.ts')
mock.module('../src/lib/pipeline-submit.ts', { namedExports: {
  submissionIdentity: () => ({ key: 'fixture-identity', fingerprint: 'fixture-fingerprint' }),
  submitVideoJob: async (_profile: unknown, params: { input: Input }) => {
    effects.push('submit')
    submitted = { id: 'fixture-job', status: 'queued', payload: { input: params.input } }
    return submitted
  },
  submissionErrorStatus,
} })
mock.module('../src/lib/video-queue.ts', { namedExports: {
  claimJobByKey: async () => claim ? submitted : null,
  finishJob: async () => { effects.push('finish') },
  completeQuotaForFinishedJob: async () => true,
  cancelJobByKey: async () => { effects.push('cancel'); return true },
} })
// Only the dispatch boundary is run; T03 owns durable execution/recovery proofs.
mock.module('../src/lib/video-worker.ts', { namedExports: { runVideoJob: async (job: Job) => {
  const input = job.payload.input
  await generateVideoSmart(input.topic, input.genPlan, input.userEmail, {
    userId: input.userId, videoId: input.videoId, quality: input.quality, format: input.format, duration: 6,
  })
} } })
mock.module('../src/lib/ltx-helpers.ts', { namedExports: {
  logVideoGeneration: async () => undefined,
  generateWanVideoWithTracking: async (params: { userEmail: string; fallbackTriggered: boolean }) => {
    apiCalls++
    assert.equal(params.userEmail, CLIENT)
    assert.equal(params.fallbackTriggered, false)
    return { videoBuffer: new ArrayBuffer(0), engine: 'wan-classic', model: 'wan-2.2', duration: 6, resolution: '1280x720' }
  },
} })
mock.module('../src/lib/media-probe.ts', { namedExports: {
  assertMediaProbeAvailable: async () => undefined,
  verifyVideoBytes: async () => { throw new Error('T08_UNEXPECTED_MEDIA_VALIDATION') },
} })
mock.module('../src/lib/ltx-v2.ts', { namedExports: {
  LtxJobError: class extends Error {},
  ltxV2: { submit: async () => { apiCalls++; throw new Error('T08_UNEXPECTED_LTX') } },
} })

globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
  if (url.origin !== 'https://worker.fixture.invalid') {
    externalAttempts++
    throw new Error('T08_UNEXPECTED_NETWORK')
  }
  workerCalls++
  if (workerFailure === 'timeout') throw new DOMException('fixture timeout', 'TimeoutError')
  return new Response('fixture unavailable', { status: 503 })
}
const { generateVideoSmart } = await import('../src/lib/ltx.ts')
const { POST } = await import('../src/app/api/create/route.ts')
const { POST: productionPOST } = await import('../src/app/api/production/route.ts')

beforeEach(() => {
  email = CLIENT; claim = true; submitted = undefined
  apiCalls = 0; workerCalls = 0; externalAttempts = 0; effects.length = 0
  workerFailure = 'http'
  process.env.SALAD_ENABLED = 'false'
  process.env.LOCAL_ENGINE_ENABLED = 'false'
  process.env.LOCAL_ENGINE_MODE = 'strict'
  process.env.LOCAL_VIDEO_API_URL = 'https://worker.fixture.invalid'
})
const request = (extra: Record<string, unknown> = {}) => new Request('https://sutra.fixture.invalid/api/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Email': SUPER_ADMIN_EMAIL },
  body: JSON.stringify({ topic: 'T08 fixture topic', quality: '720p', format: '16:9', engine: 'wan-classic', ...extra }),
})

test('T08 MODE-01: client cannot obtain owner dispatch through forged body or headers', async () => {
  claim = false
  const response = await POST(request({ userEmail: SUPER_ADMIN_EMAIL, userId: 'owner', isOwner: true }))
  assert.equal(response.status, 202)
  assert.equal(submitted?.payload.input.userEmail, CLIENT)
  assert.equal(submitted?.payload.input.userId, 'session-user')
  const invalid = await POST(request({ engine: 'owner' }))
  assert.equal(invalid.status, 400)
  assert.deepEqual(effects, ['submit'])
  assert.equal(workerCalls + apiCalls + externalAttempts, 0)
})

test('T08 MODE-02: normal client API dispatch survives personal worker disabled or enabled', async () => {
  for (const enabled of ['false', 'true']) {
    process.env.LOCAL_ENGINE_ENABLED = enabled
    process.env.SALAD_ENABLED = enabled
    const response = await POST(request())
    assert.equal(response.status, 200)
    assert.equal((await response.json()).success, true)
  }
  assert.equal(apiCalls, 2, 'explicit client API selection is preserved')
  assert.equal(workerCalls + externalAttempts, 0)
})

test('T08 MODE-03: disabled personal worker returns an actionable safe HTTP error without paid fallback', async () => {
  email = SUPER_ADMIN_EMAIL
  const response = await POST(request())
  const body = await response.json() as { error?: string; code?: string }
  assert.equal(workerCalls + apiCalls + externalAttempts, 0)
  assert.ok(response.status >= 400 && response.status < 600)
  assert.deepEqual(effects, [], 'disabled mode must fail before submission and any paid pipeline phase')
  assert.match(`${body.code ?? ''} ${body.error ?? ''}`, /SUTRA_(?:LOCAL|SALAD)_(?:NOT_CONFIGURED|DISABLED|UNAVAILABLE)|moteur.*(?:desactive|indisponible|non configure)/i,
    'Owner must receive a stable unavailable-mode reason instead of a generic generation failure')
  assert.doesNotMatch(JSON.stringify(body), /worker\.fixture\.invalid|session-user/)
})

test('T08 MODE-04: legacy Mac/auto flags cannot activate Salad or paid fallback', async () => {
  email = SUPER_ADMIN_EMAIL
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_ENGINE_MODE = 'auto'
  for (const failure of ['http', 'timeout'] as const) {
    workerFailure = failure
    const response = await POST(request())
    assert.ok(response.status >= 400 && response.status < 600)
    assert.doesNotMatch(await response.text(), /worker\.fixture\.invalid|fixture unavailable|fixture timeout/)
  }
  assert.equal(workerCalls, 0, 'legacy URL must never be contacted by the owner route')
  assert.equal(apiCalls + externalAttempts, 0)
  assert.deepEqual(effects, [])
})

test('T08 MODE-05: production all rejects a disabled personal GPU before any submission', async () => {
  email = SUPER_ADMIN_EMAIL
  claim = false
  const response = await productionPOST(new Request('https://sutra.fixture.invalid/api/production', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'all', idea: 'T08 fixture idea' }),
  }))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'SALAD_UNAVAILABLE')
  assert.deepEqual(effects, [])
  assert.equal(workerCalls + apiCalls + externalAttempts, 0)
})

test('T08 MODE-06: production all keeps explicit client API submission available', async () => {
  claim = false
  const response = await productionPOST(new Request('https://sutra.fixture.invalid/api/production', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'all', idea: 'T08 fixture idea' }),
  }))
  assert.equal(response.status, 202)
  assert.deepEqual(effects, ['submit'])
  assert.equal(submitted?.payload.input.userEmail, CLIENT)
  assert.equal(workerCalls + apiCalls + externalAttempts, 0)
})
