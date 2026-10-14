/** New T03 regressions: real queue/worker/pipelines, synthetic DB and provider boundaries. */
import assert from 'node:assert/strict'
import { test, mock, type TestContext } from 'node:test'
import type { VideoJob } from '../src/lib/video-queue'
import type { ProductionJobInput, ProductionProviders } from '../src/lib/production-pipeline'
import type { CreateJobInput } from '../src/lib/video-pipeline'
import type { ScriptData } from '../src/types'
import type { AutoConfig, VideoPlan } from '../src/lib/sutra-auto'

Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })
let visuals = 0
let musicCalls = 0
let voices = 0
let uploads = 0
let uploadFail = true
let music: () => Promise<{ id: string; audio_url: string }> = async () => ({ id: 'fixture', audio_url: 'https://media.fixture.invalid/music.mp3' })
mock.module('../src/lib/fallbacks.ts', { namedExports: {
  generateVisualWithFallback: async () => { visuals++; return { url: 'https://media.fixture.invalid/scene.mp4', engine: 'wan-classic', source: 'ai' } },
  generateVoiceWithFallback: async () => { throw new Error('UNEXPECTED_VOICE_GENERATION') },
} })
mock.module('../src/lib/suno.ts', { namedExports: {
  generateMusic: async () => { musicCalls++; return music() },
} })
mock.module('../src/lib/elevenlabs.ts', { namedExports: {
  generateVoice: async () => { voices++; return new TextEncoder().encode('fixture-audio').buffer },
} })
mock.module('../src/lib/storage.ts', { namedExports: {
  uploadToStorage: async (_path: string, bytes: Buffer | ArrayBuffer) => {
    uploads++
    assert.equal(Buffer.from(bytes as ArrayBuffer).toString(), 'fixture-audio')
    if (uploadFail) throw new Error('STORAGE_RESPONSE_LOST')
    return 'https://media.fixture.invalid/voice.mp3'
  },
} })
const { finishJob, checkpoint } = await import('../src/lib/video-queue')
const { runVideoJob } = await import('../src/lib/video-worker')
const { executeProductionStep } = await import('../src/lib/production-pipeline')
const { executeCreateJob } = await import('../src/lib/video-pipeline')
const { withPipelineLease } = await import('../src/lib/pipeline-state')
const { generateAutoVideoAssets } = await import('../src/lib/sutra-auto')
const USER = '00000000-0000-4000-8000-000000000003'
const JOB = '00000000-0000-4000-8000-000000000030'
const VIDEO = '00000000-0000-4000-8000-000000000031'
const WORKER = 't03-fixture'
const SCRIPT: ScriptData = { title: 'Fixture', description: '', tags: [], narration: 'Previously narrated.',
  scenes: [{ visual_prompt: 'Fixture landscape', duration_seconds: 5, use_stock: false }],
  music_prompt: 'Fixture music', music_style: 'cinematic', thumbnail_prompt: '', estimated_duration: 15 }
const input: ProductionJobInput = { step: 'script', userId: USER, userEmail: null, userPlan: 'free', genPlan: 'free',
  qualityCap: '720p', mediaFormat: '16:9', idea: 'Fixture', template: null, format: '16:9', voice: null,
  musicStyle: 'cinematic', tone: null, previousData: { script: SCRIPT }, brandKit: null, requestKey: 'fixture-job' }
function job(): VideoJob { return { id: JOB, video_id: VIDEO, user_id: USER, kind: 'production', payload: { input: structuredClone(input) },
  progress: { steps: { script: structuredClone(SCRIPT) }, result: structuredClone(SCRIPT) }, provider_job_ids: {},
  status: 'processing', attempts: 2, max_attempts: 3, locked_by: WORKER, last_error: null, idempotency_key: 'fixture-job' } }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })

function db(t: TestContext) {
  const h = { row: job(), calls: [] as string[], writes: [] as Record<string, unknown>[], forbidden: [] as string[],
    receipt: 'done' as unknown, finishHttp: 200, commit: false, readHttp: 200, heartbeat: true, event: true,
    onWrite: (_body: Record<string, unknown>) => { void _body }, }
  const previous = globalThis.fetch
  globalThis.fetch = async (request, options) => {
    const url = new URL(request instanceof Request ? request.url : request)
    const method = options?.method ?? 'GET'
    if (url.origin !== 'https://db.fixture.invalid') { h.forbidden.push(url.origin); throw new Error('EXTERNAL_REQUEST_DENIED') }
    if (method === 'GET' && url.pathname === '/rest/v1/video_jobs') {
      h.calls.push('read')
      assert.equal(url.searchParams.get('id'), `eq.${JOB}`)
      return json(h.readHttp === 200 ? h.row : { message: 'fixture DB unavailable' }, h.readHttp)
    }
    const body = JSON.parse(String(options?.body ?? '{}')) as Record<string, unknown>
    const rpc = url.pathname.replace('/rest/v1/rpc/', '')
    h.calls.push(rpc); h.writes.push(body); h.onWrite(body)
    assert.equal(body.p_job_id, JOB)
    if (rpc === 'finish_video_job') {
      if (h.commit) { h.row.status = body.p_status as VideoJob['status']; h.row.locked_by = null }
      return json(h.receipt, h.finishHttp)
    }
    if (rpc === 'heartbeat_video_job_v2') return json(h.heartbeat)
    if (rpc === 'record_video_job_event') return json(h.event)
    if (rpc === 'checkpoint_video_job_v2' || rpc === 'persist_video_job_video') return json(true)
    h.forbidden.push(rpc); throw new Error('UNEXPECTED_RPC')
  }
  t.after(() => { globalThis.fetch = previous; assert.deepEqual(h.forbidden, []) })
  return h
}

for (const receipt of ['failed', 'queued', 'reconciliation_required']) {
  test(`finish done rejects incompatible DB receipt ${receipt}`, async t => {
    const h = db(t); h.receipt = receipt
    await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
    assert.deepEqual(h.calls, ['finish_video_job'])
  })
}
test('finish queued still accepts SQL quarantine receipt', async t => {
  const h = db(t); h.receipt = 'reconciliation_required'
  assert.equal(await finishJob(JOB, WORKER, 'queued', 'SUTRA_RECONCILIATION_REQUIRED'), 'reconciliation_required')
})
test('finish done lost ACK: reconcile persisted result with one GET, never repeat quota mutation', async t => {
  const h = db(t); h.commit = true; h.finishHttp = 503; h.receipt = { message: 'fixture ACK lost' }
  assert.equal(await finishJob(JOB, WORKER, 'done'), 'done')
  assert.deepEqual(h.calls, ['finish_video_job', 'read'])
})
test('duplicate completion after lost ACK reads existing outcome; no second successful mutation', async t => {
  const h = db(t); h.row.status = 'done'; h.row.locked_by = null; h.finishHttp = 409; h.receipt = { message: 'SUTRA_JOB_LEASE_LOST' }
  assert.deepEqual(await Promise.all(Array.from({ length: 12 }, () => finishJob(JOB, WORKER, 'done'))), Array(12).fill('done'))
  assert.equal(h.calls.filter(c => c === 'read').length, 12)
})
for (const state of ['processing', 'queued', 'cancelled', 'failed', 'reconciliation_required'] as const) {
  test(`unconfirmed finish cannot promote ${state} to done`, async t => {
    const h = db(t); h.row.status = state; h.finishHttp = 503; h.receipt = { message: 'fixture DB unavailable' }
    await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
  })
}
test('unconfirmed finish with unreadable DB remains blocked', async t => {
  const h = db(t); h.row.status = 'done'; h.finishHttp = 503; h.readHttp = 503
  await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
})
for (const result of [undefined, null]) {
  test(`terminal status without result ${String(result)} cannot reconcile as successful media`, async t => {
    const h = db(t); h.row.status = 'done'; h.row.progress.result = result; h.finishHttp = 503
    await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
  })
}
test('lost finish ACK for explicitly skipped production music accepts its durable null result', async t => {
  const h = db(t); h.row.status = 'done'; h.row.locked_by = null; h.row.progress.result = null; h.finishHttp = 503
  Object.assign(h.row.payload.input as object, { step: 'music', musicStyle: 'none' })
  Object.assign(h.row.progress.steps as object, { 'stage:music': { status: 'skipped', value: null } })
  assert.equal(await finishJob(JOB, WORKER, 'done'), 'done')
})

for (const kind of ['production', 'create', 'export', 'auto'] as const) {
  test(`worker interrupted after final checkpoint: ${kind} resumes result without replaying effects`, async t => {
    const h = db(t); h.row.kind = kind
    Object.assign(h.row.payload.input as object, { videoId: VIDEO, videoRowId: VIDEO })
    if (kind === 'auto' || kind === 'production') h.row.video_id = null
    assert.deepEqual(await runVideoJob(h.row, WORKER), SCRIPT)
    assert.deepEqual(h.calls, ['heartbeat_video_job_v2'])
  })
}
for (const fault of ['owner', 'lease', 'expired', 'video', 'auto-video', 'kind'] as const) {
  test(`cached result never bypasses ${fault} guard`, async t => {
    const h = db(t)
    if (fault === 'owner') (h.row.payload.input as Record<string, unknown>).userId = 'other-user'
    if (fault === 'lease') h.row.locked_by = 'other-worker'
    if (fault === 'expired') h.heartbeat = false
    if (fault === 'video' || fault === 'auto-video') { h.row.kind = fault === 'video' ? 'create' : 'auto'; Object.assign(h.row.payload.input as object, { videoId: 'other', videoRowId: null }) }
    if (fault === 'kind') h.row.kind = 'invalid' as VideoJob['kind']
    await assert.rejects(runVideoJob(h.row, WORKER), /SUTRA_(INVALID_JOB|JOB_LEASE_LOST)/)
    assert.ok(h.calls.every(c => c === 'heartbeat_video_job_v2'))
  })
}

const createInput: CreateJobInput = { userId: USER, videoId: VIDEO, userEmail: null, userPlan: 'free', genPlan: 'free',
  quality: '720p', format: '16:9', mediaFormat: '16:9', topic: 'fixture', mode: 'auto', mediaMode: 'ai',
  voiceId: 'fixture', stockSelections: [], brandKit: null }
function creation() {
  const steps: Record<string, unknown> = { script: SCRIPT, metadata_saved: true, voice_url: 'https://media.fixture.invalid/voice.mp3', music: 'https://media.fixture.invalid/music.mp3' }
  const scenes: Record<string, { url: string; type: 'ia'; kind: 'video'; duration: number }> = {}
  return { steps, scenes }
}
for (const fault of ['event-after-visual', 'scene-checkpoint'] as const) {
  test(`acquired scene survives ${fault}: no generation replay and no lost visual`, async t => {
    const h = db(t); const durable = creation(); visuals = 0
    let interrupted = false
    if (fault === 'event-after-visual') h.onWrite = body => { if ((body.p_values as { endpoint?: string })?.endpoint === 'generateVisual') h.event = false }
    const run = () => withPipelineLease(JOB, WORKER, () => executeCreateJob(createInput, structuredClone(durable), {
      onStepResolved: async (key, value) => {
        if (key === 'stage:scenes') throw new Error('STOP_BEFORE_COMPOSITION')
        durable.steps[key] = structuredClone(value)
      },
      onSceneResolved: async (index, clip) => {
        if (fault === 'scene-checkpoint' && !interrupted) { interrupted = true; throw new Error('SCENE_ACK_LOST_BEFORE_COMMIT') }
        durable.scenes[index] = clip as typeof durable.scenes[string]
      },
    }))
    await assert.rejects(run(), fault === 'event-after-visual' ? /SUTRA_EVENT_PERSISTENCE_FAILED/ : /SCENE_ACK_LOST/)
    assert.equal(visuals, 1)
    h.event = true; h.onWrite = () => {}
    await assert.rejects(run(), /STOP_BEFORE_COMPOSITION/)
    assert.equal(visuals, 1, 'provider result must be checkpointed before observability/scene conversion')
    assert.equal(durable.scenes['0'].url, 'https://media.fixture.invalid/scene.mp4')
    assert.ok(!h.writes.some(w => (w.p_values as { status?: string })?.status === 'ready'))
  })
}

test('music fails after video acquired: preserve completed scene, no second paid music submission or ready', async t => {
  const h = db(t); const durable = creation(); delete durable.steps.music; visuals = 0; musicCalls = 0
  let sceneSaved!: () => void
  const saved = new Promise<void>(resolve => { sceneSaved = resolve })
  music = async () => { await saved; throw new Error('MUSIC_RESPONSE_LOST') }
  const run = () => withPipelineLease(JOB, WORKER, () => executeCreateJob(createInput, structuredClone(durable), {
    onStepResolved: async (key, value) => { durable.steps[key] = structuredClone(value) },
    onSceneResolved: async (index, clip) => { durable.scenes[index] = clip as typeof durable.scenes[string]; sceneSaved() },
  }))
  await assert.rejects(run(), /MUSIC_RESPONSE_LOST/)
  assert.ok(durable.scenes['0'])
  for (let i = 0; i < 3; i++) await assert.rejects(run(), /SUTRA_RECONCILIATION_REQUIRED: music/)
  assert.equal(visuals, 1); assert.equal(musicCalls, 1)
  assert.equal(durable.steps['stage:export'], undefined)
  assert.ok(!h.writes.some(w => (w.p_values as { status?: string })?.status === 'ready'))
})

for (const step of ['music', 'all'] as const) {
  test(`production ${step}: required music absent cannot succeed or start downstream paid work`, async () => {
    let downstream = 0
    const providers = { music: async () => null, visual: async () => { downstream++; throw new Error('UNEXPECTED_VISUAL') },
      voice: async () => { downstream++; throw new Error('UNEXPECTED_VOICE') } } as unknown as ProductionProviders
    await assert.rejects(executeProductionStep({ ...input, step }, { steps: { script: SCRIPT } }, {}, providers), /SUTRA_REQUIRED_MUSIC_MISSING/)
    assert.equal(downstream, 0)
  })
}
test('production explicit no-music remains a skipped checkpoint', async () => {
  const steps: Record<string, unknown> = {}
  assert.equal(await executeProductionStep({ ...input, step: 'music', musicStyle: 'none' }, { steps }, {},
    { music: async () => null } as unknown as ProductionProviders), null)
  assert.deepEqual(steps['stage:music'], { status: 'skipped', value: null })
})
test('checkpoint write is always required before final worker success', async t => {
  const h = db(t); delete h.row.progress.result
  h.onWrite = body => { if ((body.p_progress as { result?: unknown })?.result) throw new Error('RESULT_DB_UNAVAILABLE') }
  await assert.rejects(runVideoJob(h.row, WORKER), /SUTRA_CHECKPOINT_FAILED/)
})
test('fresh DB checkpoint is still lease-fenced', async t => {
  const h = db(t)
  await checkpoint(JOB, WORKER, { steps: { retained: true } })
  assert.equal(h.writes[0].p_worker, WORKER)
})

function autoVoice(steps: Record<string, unknown>) {
  return generateAutoVideoAssets({ videoId: VIDEO, userEmail: null, plan_tier: 'free',
    config: { user_id: USER, default_voice_enabled: true, default_voice_id: 'fixture-voice', default_music_genre: 'none' } as AutoConfig,
    plan: { script: 'Fixture narration' } as VideoPlan, progress: { steps: structuredClone(steps),
      onStepResolved: async (key, value) => { steps[key] = structuredClone(value) } } })
}
test('AUTO voice received then storage fails: retry upload from checkpoint, synthesize exactly once', async () => {
  voices = 0; uploads = 0; uploadFail = true
  const steps: Record<string, unknown> = { 'asset:video': 'https://media.fixture.invalid/raw.mp4' }
  await assert.rejects(autoVoice(steps), /STORAGE_RESPONSE_LOST/)
  assert.equal(voices, 1)
  uploadFail = false
  assert.equal((await autoVoice(steps)).audio_voice_url, 'https://media.fixture.invalid/voice.mp3')
  assert.equal(voices, 1); assert.equal(uploads, 2)
  assert.equal((await autoVoice(steps)).audio_voice_url, 'https://media.fixture.invalid/voice.mp3')
  assert.equal(voices, 1); assert.equal(uploads, 2)
})
test('AUTO legacy uncertain voice remains quarantined, never synthesized again', async () => {
  voices = 0; uploads = 0
  await assert.rejects(autoVoice({ 'asset:video': 'https://media.fixture.invalid/raw.mp4', 'asset:voice:started': true }), /SUTRA_RECONCILIATION_REQUIRED/)
  assert.equal(voices, 0); assert.equal(uploads, 0)
})
