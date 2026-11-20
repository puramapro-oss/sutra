// Real admission, receipt reader and creation pipeline; all external ports inert.
import assert from 'node:assert/strict'
import test, { afterEach, beforeEach, mock } from 'node:test'
import type { CreateJobInput } from '../src/lib/video-pipeline.ts'
import type { ScriptData } from '../src/types/index.ts'

const USER = '11111111-1111-4111-8111-111111111111'
const VIDEO = '22222222-2222-4222-8222-222222222222'
const JOB = '33333333-3333-4333-8333-333333333333'
const STOP_SCRIPT = 'TEST_STOP_AFTER_SCRIPT'
const STOP_METADATA = 'TEST_STOP_BEFORE_METADATA_WRITE'
let scriptCalls = 0
let serviceClients = 0
let profileReads = 0
let submissions = 0
let claims = 0
let metadataWrites = 0
let networkCalls = 0
let unexpectedCalls = 0
let submittedInput: CreateJobInput | undefined
const checkpoints = new Map<string, unknown>()
const unexpected = (name: string) => () => {
  unexpectedCalls++
  throw new Error('UNEXPECTED_BOUNDARY: ' + name)
}
globalThis.fetch = async () => {
  networkCalls++
  throw new Error('UNEXPECTED_NETWORK')
}

const automatic: ScriptData = {
  title: 'Automatic fixture', description: 'Generated only by the inert port',
  tags: [], narration: 'Automatic narration distinct from the manual text.',
  scenes: [{ visual_prompt: 'Automatic scene', duration_seconds: 5, use_stock: false }],
  music_prompt: 'fixture', music_style: 'cinematic', thumbnail_prompt: 'fixture',
  estimated_duration: 5,
}
const pipelineState = await import('../src/lib/pipeline-state.ts')
mock.module('../src/lib/pipeline-state.ts', { namedExports: {
  ...pipelineState,
  pipelineLog: async () => {},
  pipelineNotification: unexpected('notification'),
  persistPipelineVideo: async () => {
    metadataWrites++
    throw new Error(STOP_METADATA)
  },
} })
mock.module('../src/lib/supabase.ts', { namedExports: {
  createServiceClient: () => {
    serviceClients++
    return { from: (table: string) => {
      profileReads++
      assert.equal(table, 'profiles')
      return { select: () => ({ eq: () => ({ single: async () => ({
        data: { id: USER, plan: 'free', brand_kit: null },
      }) }) }) }
    } }
  },
} })
mock.module('../src/lib/claude.ts', { namedExports: {
  generateScript: async () => {
    scriptCalls++
    assert.equal(checkpoints.get('script:started'), true, 'paid intent precedes the automatic port')
    return structuredClone(automatic)
  },
} })
mock.module('../src/lib/suno.ts', { namedExports: { generateMusic: unexpected('music') } })
mock.module('../src/lib/music-checkpoint.ts', { namedExports: { musicCheckpointed: unexpected('music checkpoint') } })
mock.module('../src/lib/fallbacks.ts', { namedExports: { generateVisualWithFallback: unexpected('visual') } })
mock.module('../src/lib/pexels.ts', { namedExports: { searchVideos: unexpected('stock') } })
mock.module('../src/lib/shotstack.ts', { namedExports: {
  actualQualityFor: unexpected('quality'), durableRenderJob: unexpected('render'),
  verifyAndStoreRenderedVideo: unexpected('render verification'),
} })
mock.module('../src/lib/ltx.ts', { namedExports: { durableLtxJob: unexpected('ltx') } })
mock.module('../src/lib/production-pipeline.ts', { namedExports: { executeProductionStep: unexpected('production') } })
mock.module('../src/lib/final-composition.ts', { namedExports: { assembleFinalVideo: unexpected('composition') } })
mock.module('../src/lib/video-proofs.ts', { namedExports: { stampVideoWhenReady: unexpected('proof') } })
mock.module('../src/lib/social-publication.ts', { namedExports: { publishVideoRecord: unexpected('publication') } })
mock.module('../src/lib/social-destinations.ts', { namedExports: {
  readOwnedPublicationDestinations: unexpected('destinations'),
  destinationPlatformsMatch: unexpected('platforms'),
} })
mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({
    data: { user: { id: USER, email: 'manual.fixture@example.invalid' } }, error: null,
  }) } }),
} })
mock.module('../src/lib/pipeline-submit.ts', { namedExports: {
  submissionIdentity: () => ({ key: 'create-fixture', fingerprint: 'fixture' }),
  submissionErrorStatus: () => 500,
  submitVideoJob: async (_profile: unknown, job: { input: CreateJobInput }) => {
    submissions++
    submittedInput = job.input
    return { id: JOB, status: 'queued', payload: { input: job.input } }
  },
} })
mock.module('../src/lib/video-worker.ts', { namedExports: { runVideoJob: unexpected('worker dispatch') } })
mock.module('../src/lib/video-queue.ts', { namedExports: {
  claimJobByKey: async () => { claims++; return null },
  completeQuotaForFinishedJob: unexpected('quota completion'), finishJob: unexpected('job finish'),
} })
mock.module('../src/lib/local-engine.ts', { namedExports: { shouldUseLocalEngine: () => false } })
mock.module('../src/lib/salad/application.ts', { namedExports: { saladApplicationConfig: unexpected('salad config') } })
mock.module('../src/lib/salad/config.ts', { namedExports: { requireActive: unexpected('salad activation') } })

const { executeCreateJob } = await import('../src/lib/video-pipeline.ts')
const { POST } = await import('../src/app/api/create/route.ts')
const { readCreateIntent, createIntentKey } = await import('../src/lib/create-intent-client.ts')
const input: CreateJobInput = {
  userId: USER, videoId: VIDEO, userEmail: null, userPlan: 'free', genPlan: 'free',
  quality: '720p', format: '16:9', mediaFormat: '16:9', topic: 'Manual fixture',
  mode: 'manual', mediaMode: 'stock', voiceId: 'fixture', stockSelections: [], brandKit: null,
}
const request = (script: string | undefined, mode: 'manual' | 'auto' = 'manual') =>
  new Request('https://sutra.fixture.invalid/api/create', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: input.topic, mode, mediaMode: 'stock', script }),
  })
const stopAfterScript = async (key: string, value: unknown) => {
  checkpoints.set(key, structuredClone(value))
  if (key === 'stage:script') throw new Error(STOP_SCRIPT)
}

beforeEach(() => {
  scriptCalls = serviceClients = profileReads = submissions = claims = metadataWrites = 0
  networkCalls = unexpectedCalls = 0
  submittedInput = undefined
  checkpoints.clear()
})
afterEach(() => {
  assert.equal(networkCalls, 0)
  assert.equal(unexpectedCalls, 0)
})

const invalid: Array<[string, string | undefined]> = [
  ['missing', undefined], ['empty', ''], ['whitespace', ' \n\t\r '],
  ['over 20000 characters', 'x'.repeat(20_001)],
  ['61 scenes', Array.from({ length: 61 }, () => 'Scene').join('\n')],
]
for (const [label, script] of invalid) {
  test('manual admission rejects ' + label + ' before profile reads, quota reservation or dispatch', async () => {
    const response = await POST(request(script))
    const body = await response.json()
    assert.equal(response.status, 400)
    assert.ok(body.details?.script?.length, 'error belongs to the script field')
    assert.equal(serviceClients, 0)
    assert.equal(profileReads, 0)
    assert.equal(submissions, 0)
    assert.equal(claims, 0)
    assert.equal(scriptCalls, 0)
  })
  test('manual worker rejects ' + label + ' before service clients, checkpoints or providers', async () => {
    await assert.rejects(
      executeCreateJob({ ...input, manualScript: script }, { scenes: {}, steps: {} }, {
        onStepResolved: stopAfterScript,
      }),
      /SUTRA_INVALID_MANUAL_SCRIPT/,
    )
    assert.equal(serviceClients, 0)
    assert.equal(scriptCalls, 0)
    assert.equal(checkpoints.size, 0)
    assert.equal(metadataWrites, 0)
  })
}

const valid: Array<[string, string, string[]]> = [
  ['one character', 'x', ['x']],
  ['19 characters', 'x'.repeat(19), ['x'.repeat(19)]],
  ['20 characters', 'x'.repeat(20), ['x'.repeat(20)]],
  ['multiple lines and CRLF', '  Mer calme  \r\n\n  Ciel étoilé  \n', ['Mer calme', 'Ciel étoilé']],
  ['60 scenes', Array.from({ length: 60 }, () => 'Scene').join('\n'), Array.from({ length: 60 }, () => 'Scene')],
  ['20000 characters', 'x'.repeat(20_000), ['x'.repeat(2000)]],
]
for (const [label, script, prompts] of valid) {
  test('manual worker preserves ' + label + ' without automatic script generation', async () => {
    await assert.rejects(
      executeCreateJob({ ...input, manualScript: script }, { scenes: {}, steps: {} }, {
        onStepResolved: stopAfterScript,
      }),
      new RegExp(STOP_SCRIPT),
    )
    const receipt = checkpoints.get('stage:script') as { status: string; value: ScriptData }
    assert.equal(receipt.status, 'complete')
    assert.equal(receipt.value.narration, script)
    assert.deepEqual(receipt.value.scenes.map(scene => scene.visual_prompt), prompts)
    assert.ok(receipt.value.scenes.every(scene => scene.duration_seconds === 5))
    assert.equal(scriptCalls, 0)
    assert.equal(checkpoints.has('script:started'), false)
    assert.equal(metadataWrites, 0)
  })
  test('manual admission retains ' + label + ' in the durable job input', async () => {
    const response = await POST(request(script))
    assert.equal(response.status, 202)
    assert.equal(submissions, 1)
    assert.equal(claims, 1)
    assert.equal(submittedInput?.mode, 'manual')
    assert.equal(submittedInput?.manualScript, script)
    assert.equal(scriptCalls, 0)
  })
}

test('automatic admission still accepts an absent manual script', async () => {
  const response = await POST(request(undefined, 'auto'))
  assert.equal(response.status, 202)
  assert.equal(submittedInput?.mode, 'auto')
  assert.equal(submittedInput?.manualScript, undefined)
  assert.equal(submissions, 1)
})

test('automatic worker still generates a script only after its durable paid intent', async () => {
  await assert.rejects(
    executeCreateJob({ ...input, mode: 'auto' }, { scenes: {}, steps: {} }, {
      onStepResolved: stopAfterScript,
    }),
    new RegExp(STOP_SCRIPT),
  )
  assert.equal(scriptCalls, 1)
  assert.deepEqual(checkpoints.get('stage:script'), { status: 'complete', value: automatic })
})

test('an old automatic result for a short manual request requires reconciliation without another paid call', async () => {
  const steps = {
    script: structuredClone(automatic),
    'stage:script': { status: 'complete', value: structuredClone(automatic) },
    'stage:storyboard': { status: 'complete', value: structuredClone(automatic.scenes) },
  }
  const before = structuredClone(steps)
  await assert.rejects(
    executeCreateJob({ ...input, manualScript: 'Mer calme' }, { scenes: {}, steps }, {
      onStepResolved: stopAfterScript,
    }),
    /SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT stage:script/,
  )
  assert.equal(scriptCalls, 0)
  assert.equal(metadataWrites, 0)
  assert.equal(checkpoints.size, 0)
  assert.deepEqual(steps, before)
})

for (const [label, script] of invalid.filter(([label]) => label !== 'over 20000 characters')) {
  test('an older admitted ' + label + ' manual receipt remains readable for recovery and cancellation', t => {
    const prior = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    const intent = {
      version: 1, userId: USER, requestId: VIDEO, jobId: JOB, cancelRequested: true,
      body: JSON.stringify({ topic: input.topic, mode: 'manual', script, mediaMode: 'stock' }),
    }
    const records = new Map([[createIntentKey(USER), JSON.stringify(intent)]])
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true, value: { getItem: (key: string) => records.get(key) ?? null },
    })
    t.after(() => {
      if (prior) Object.defineProperty(globalThis, 'sessionStorage', prior)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    })
    assert.deepEqual(readCreateIntent(USER), intent)
    assert.equal(submissions, 0)
    assert.equal(serviceClients, 0)
  })
}
