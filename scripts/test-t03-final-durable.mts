import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { pipelineSteps, checkpointStage } from '../src/lib/pipeline-state'
import { hasCompletedJobResult } from '../src/lib/video-queue'
import { executeProductionStep, voiceB64Checkpointed, type ProductionJobInput, type ProductionProviders } from '../src/lib/production-pipeline'

const media = { url: 'https://fixture.invalid/final.mp4', outputVerified: true, duration: 5,
  outputSize: { width: 720, height: 1280 }, verification: { url: 'https://fixture.invalid/final.mp4',
    sha256: 'a'.repeat(64), duration: 5, width: 720, height: 1280, fps: 30, hasAudio: true } }
const complete = (value: unknown) => ({ status: 'complete', value })
const steps = {
  'stage:script': complete({ narration: 'fixture' }), 'stage:scenes': complete([{ url: 'https://fixture.invalid/raw.mp4' }]),
  'stage:images': { status: 'skipped', value: [] }, 'stage:voice': complete('https://fixture.invalid/voice.mp3'),
  'stage:music': complete('https://fixture.invalid/music.mp3'), 'stage:subtitles': complete([]),
  'stage:composition': complete(media), 'stage:export': complete(media),
}
const valid = () => ({ kind: 'create' as const, payload: { input: {} }, progress: {
  result: { videoUrl: media.url, actualQuality: '720p', duration: 5 }, steps: structuredClone(steps),
} })

for (const result of [false, true, '', 0, [], {}, { videoUrl: 'https://fixture.invalid/raw.mp4' }]) {
  test(`invalid non-null terminal result is refused: ${JSON.stringify(result)}`, () => {
    const job = valid(); job.progress.result = result as never
    assert.equal(hasCompletedJobResult(job), false)
  })
}
test('terminal replay needs matching measured export and all required stages', () => {
  assert.equal(hasCompletedJobResult(valid()), true)
  for (const key of Object.keys(steps)) {
    const job = valid(); delete (job.progress.steps as Record<string, unknown>)[key]
    assert.equal(hasCompletedJobResult(job), false, key)
  }
  for (const proof of [{ ...media, outputVerified: false }, { ...media, verification: undefined },
    { ...media, verification: { ...media.verification, hasAudio: false } }]) {
    const job = valid(); job.progress.steps['stage:export'] = complete(proof) as never
    assert.equal(hasCompletedJobResult(job), false)
  }
})
test('production substeps need a result bound to their independent checkpoint', () => {
  for (const [step, stage, result, value] of [
    ['script', 'script', { title: 'fixture', scenes: [{ visual_prompt: 'fixture' }] }, { title: 'fixture', scenes: [{ visual_prompt: 'fixture' }] }],
    ['video', 'scenes', [{ url: 'https://fixture.invalid/raw.mp4' }], [{ url: 'https://fixture.invalid/raw.mp4' }]],
    ['voice', 'voice', { url: 'https://fixture.invalid/voice.mp3' }, 'https://fixture.invalid/voice.mp3'],
    ['music', 'music', 'https://fixture.invalid/music.mp3', 'https://fixture.invalid/music.mp3'],
  ] as const) {
    const job = { kind: 'production' as const, payload: { input: { step, musicStyle: 'cinematic' } },
      progress: { result, steps: { [`stage:${stage}`]: complete(value) } } }
    assert.equal(hasCompletedJobResult(job), true, step)
    assert.equal(hasCompletedJobResult({ ...job, progress: { ...job.progress, result: {} } }), false, step)
  }
})
test('pending checkpoint advances durably, completed result remains immutable', async () => {
  const done: Record<string, unknown> = {}; const writes: unknown[] = []
  const hooks = { onStepResolved: async (key: string, value: unknown) => { writes.push([key, value]) } }
  await checkpointStage(done, hooks, 'publication', { accounts: ['fixture'] }, 'pending')
  await checkpointStage(done, hooks, 'publication', { accounts: ['fixture'], journal: 'complete' })
  assert.equal((done['stage:publication'] as { status: string }).status, 'complete')
  await assert.rejects(checkpointStage(done, hooks, 'publication', { accounts: ['different'] }), /CHECKPOINT_CONFLICT/)
  assert.equal(writes.length, 2)
})
test('failed pending promotion is not reflected in memory or acknowledged', async () => {
  const done = { 'stage:export': { status: 'pending', value: null } }
  await assert.rejects(checkpointStage(done, { onStepResolved: async () => { throw new Error('SQL_FAILED') } }, 'export', media), /SQL_FAILED/)
  assert.equal(done['stage:export'].status, 'pending')
})
test('storyboard write interruption preserves script and resumes without paying again', async () => {
  let calls = 0
  const durable: Record<string, unknown> = {}
  const script = { scenes: [{ visual_prompt: 'fixture' }] }
  const hooks = { onStepResolved: async (key: string, value: unknown) => {
    if (key === 'stage:storyboard') throw new Error('STORAGE_UNAVAILABLE')
    durable[key] = structuredClone(value)
  } }
  const first: Record<string, unknown> = {}
  const value = await pipelineSteps(first, hooks)('script', async () => { calls++; return script }, true)
  await assert.rejects(checkpointStage(first, hooks, 'script', value), /STORAGE_UNAVAILABLE/)
  assert.deepEqual(durable['stage:script'], complete(script))
  assert.equal(first['stage:storyboard'], undefined)
  const restart = structuredClone(durable)
  const acquired = await pipelineSteps(restart, {})('script', async () => { calls++; return script }, true)
  await checkpointStage(restart, { onStepResolved: async (key, output) => { durable[key] = output } }, 'script', acquired)
  assert.deepEqual(durable['stage:storyboard'], complete(script.scenes))
  assert.equal(calls, 1)
})
test('24 duplicate stage deliveries serialize to one durable receipt; conflict never overwrites it', async () => {
  let writes = 0
  const done: Record<string, unknown> = {}
  const hooks = { onStepResolved: async () => { writes++; await new Promise(resolve => setImmediate(resolve)) } }
  await Promise.all(Array.from({ length: 24 }, () => checkpointStage(done, hooks, 'scenes', [{ url: 'acquired' }])))
  assert.equal(writes, 1)
  await assert.rejects(checkpointStage(done, hooks, 'scenes', [{ url: 'different' }]), /CHECKPOINT_CONFLICT/)
  assert.deepEqual(done['stage:scenes'], complete([{ url: 'acquired' }]))
})
test('legacy empty optional checkpoints are retained byte for byte', async () => {
  const done: Record<string, unknown> = { 'stage:images': complete([]), 'stage:music': complete(null) }
  const before = structuredClone(done)
  const hooks = { onStepResolved: async () => { throw new Error('IMMUTABLE_RECEIPT_REWRITE') } }
  await checkpointStage(done, hooks, 'images', [], 'skipped')
  await checkpointStage(done, hooks, 'music', '', 'skipped')
  assert.deepEqual(done, before)
})
test('required tracks cannot be skipped by changing final result alone', () => {
  for (const kind of ['auto', 'export', 'production'] as const) {
    const input = { step: 'all', musicStyle: 'cinematic', config: { default_voice_enabled: true, default_music_genre: 'cinematic' } }
    const result = kind === 'auto' ? { videoFinalUrl: media.url, status: 'ready', assemblyError: null }
      : kind === 'export' ? { url: media.url } : { assembly: media }
    for (const track of ['voice', 'music']) {
      const checkpoint: Record<string, unknown> = structuredClone(steps)
      checkpoint[`stage:${track}`] = { status: 'skipped', value: '' }
      assert.equal(hasCompletedJobResult({ kind, payload: { input }, progress: { result, steps: checkpoint } }), false)
    }
  }
})
for (const narration of ['fixture', '']) {
test(`production all with disabled music and narration=${JSON.stringify(narration)} completes and replays`, async () => {
  const calls = { script: 0, visual: 0, voice: 0, music: 0, assemble: 0, upload: 0 }
  const script = { title: 'fixture', description: '', tags: [], narration, scenes: [{ visual_prompt: 'fixture', duration_seconds: 5, use_stock: false }],
    music_prompt: '', music_style: 'cinematic' as const, thumbnail_prompt: '', estimated_duration: 5 }
  const providers: ProductionProviders = {
    script: async () => { calls.script++; return script },
    visual: async () => { calls.visual++; return { url: 'https://fixture.invalid/raw.mp4', engine: 'wan-classic', source: 'ai' } },
    voice: async () => { calls.voice++; return new TextEncoder().encode('fixture voice').buffer },
    music: async () => { calls.music++; return null },
    upload: async () => { calls.upload++; return 'https://fixture.invalid/voice.mp3' },
    assemble: async () => { calls.assemble++; return { ...media, outputVerified: true, outputQuality: 'hd', timeline: {} } },
  }
  const input: ProductionJobInput = { step: 'all', userId: 'fixture', userEmail: null, userPlan: 'empire', genPlan: 'empire',
    qualityCap: '720p', mediaFormat: '9:16', idea: 'fixture', template: null, format: null, voice: null, musicStyle: 'none',
    tone: null, previousData: {}, brandKit: null, requestKey: 'fixture' }
  const durable: Record<string, unknown> = {}
  const first = await executeProductionStep(input, { steps: {} }, { onStepResolved: async (key, value) => { durable[key] = structuredClone(value) } }, providers)
  const replay = await executeProductionStep(input, { steps: structuredClone(durable) }, {}, providers)
  assert.deepEqual(first, replay)
  assert.deepEqual(calls, { script: 1, visual: 1, voice: narration ? 1 : 0, music: 1, assemble: 1, upload: narration ? 1 : 0 })
  assert.deepEqual(durable['stage:storyboard'], complete(script.scenes))
  // persistProductionResult wraps this acquired assembly in the client all-result.
  assert.equal(hasCompletedJobResult({ kind: 'production', payload: { input }, progress: { result: { assembly: first }, steps: durable } }), true)
})
}
const b64 = Buffer.from('synthetic audio bytes').toString('base64')
const checksum = createHash('sha256').update(b64).digest('hex')
for (const state of [
  { voice_b64: '%%%INVALID%%%' }, { voice_b64: '' }, { voice_b64: b64, voice_b64_sha256: '0'.repeat(64) },
  { voice_b64_parts: 1, 'voice_b64:0': b64 },
  { voice_b64_parts: 1.5, 'voice_b64:0': b64, 'voice_b64:1': '', voice_b64_sha256: checksum },
  { voice_b64_parts: 1, 'voice_b64:0': '???', voice_b64_sha256: checksum },
]) {
  test(`corrupt voice checkpoint quarantines without synthesis: ${JSON.stringify(state)}`, async () => {
    let calls = 0; const done: Record<string, unknown> = structuredClone(state)
    await assert.rejects(voiceB64Checkpointed(done, {}, pipelineSteps(done, {}), {
      voice: async () => { calls++; return new ArrayBuffer(1) },
    }, 'fixture', null), /RECONCILIATION_REQUIRED/)
    assert.equal(calls, 0)
  })
}
test('valid chunked and legacy unchunked voice are preserved without regeneration', async () => {
  for (const state of [{ voice_b64: b64 }, { voice_b64_parts: 1, 'voice_b64:0': b64, voice_b64_sha256: checksum }]) {
    const done: Record<string, unknown> = state
    assert.equal(await voiceB64Checkpointed(done, {}, pipelineSteps(done, {}), {
      voice: async () => { throw new Error('UNEXPECTED_SYNTHESIS') },
    }, 'fixture', null), b64)
  }
})
test('new small voice persists integrity before payload and never regenerates on lost payload write', async () => {
  const durable: Record<string, unknown> = {}; let calls = 0
  const hooks = { onStepResolved: async (key: string, value: unknown) => {
    if (key === 'voice_b64') throw new Error('SQL_FAILED')
    durable[key] = value
  } }
  const done: Record<string, unknown> = {}
  await assert.rejects(voiceB64Checkpointed(done, hooks, pipelineSteps(done, hooks), {
    voice: async () => { calls++; return Buffer.from('synthetic audio bytes') as never },
  }, 'fixture', null), /SQL_FAILED/)
  assert.equal(durable.voice_b64_sha256, checksum)
  await assert.rejects(voiceB64Checkpointed(durable, {}, pipelineSteps(durable, {}), {
    voice: async () => { calls++; return new ArrayBuffer(1) },
  }, 'fixture', null), /RECONCILIATION_REQUIRED/)
  assert.equal(calls, 1)
})
