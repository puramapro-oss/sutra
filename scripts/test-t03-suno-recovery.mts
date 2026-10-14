/** T03 orchestration port fixtures. HTTP adapter contract is separately owned by T04. */
import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import type { SunoJobPort } from '../src/lib/suno'
import type { ProductionJobInput } from '../src/lib/production-pipeline'
import type { CreateJobInput } from '../src/lib/video-pipeline'
import type { AutoConfig, VideoPlan } from '../src/lib/sutra-auto'
import type { ScriptData } from '../src/types'

let provider: (job?: SunoJobPort) => Promise<{ id: string; audio_url: string }>
mock.module('../src/lib/suno.ts', { namedExports: { generateMusic: (_params: unknown, job?: SunoJobPort) => provider(job) } })
const { executeProductionStep } = await import('../src/lib/production-pipeline')
const { executeCreateJob } = await import('../src/lib/video-pipeline')
const { generateAutoVideoAssets } = await import('../src/lib/sutra-auto')
const { musicCheckpointed } = await import('../src/lib/music-checkpoint')
const { pipelineSteps } = await import('../src/lib/pipeline-state')
const SCRIPT: ScriptData = { title: 'Fixture', description: '', tags: [], narration: 'Fixture narration',
  scenes: [{ visual_prompt: 'Acquired scene', duration_seconds: 15, use_stock: false }],
  music_prompt: 'Fixture music', music_style: 'cinematic', thumbnail_prompt: '', estimated_duration: 15 }
const URL = 'https://media.fixture.invalid/music.mp3'
const TASK = 'fixture-suno-task'
const USER = '00000000-0000-4000-8000-000000000003'
const VIDEO = '00000000-0000-4000-8000-000000000031'
const production: ProductionJobInput = { step: 'music', userId: USER, userEmail: null, userPlan: 'free', genPlan: 'free',
  qualityCap: '720p', mediaFormat: '16:9', idea: 'Fixture', template: null, format: '16:9', voice: null,
  musicStyle: 'cinematic', tone: null, previousData: { script: SCRIPT }, brandKit: null, requestKey: VIDEO }
const create: CreateJobInput = { userId: USER, videoId: VIDEO, userEmail: null, userPlan: 'free', genPlan: 'free',
  quality: '720p', format: '16:9', mediaFormat: '16:9', topic: 'fixture', mode: 'auto', mediaMode: 'ai',
  voiceId: 'fixture', stockSelections: [], brandKit: null }

function scenario(path: 'create' | 'production' | 'auto') {
  const key = path === 'auto' ? 'asset:music' : 'music'
  const done: Record<string, unknown> = { script: SCRIPT, metadata_saved: true,
    voice_url: 'https://media.fixture.invalid/voice.mp3', 'asset:video': 'https://media.fixture.invalid/raw.mp4' }
  const h = { post: 0, get: 0, called: 0, pending: true, fault: '', done, key, acknowledgements: [] as string[] }
  provider = async job => {
    h.called++
    assert.ok(job, 'durable port must be supplied by every pipeline')
    if (!job.current) {
      h.post++
      assert.equal(done[`${key}:started`], true, 'paid intent acknowledged BEFORE submission')
      await job.onSubmitted({ taskId: TASK })
    } else assert.equal(job.current.taskId, TASK)
    assert.deepEqual(done[`${key}:suno`], { taskId: TASK }, 'ID durable BEFORE polling')
    h.get++
    if (h.pending) throw new Error('REMOTE_STILL_PENDING_AFTER_TIMEOUT')
    return { id: 'fixture-song', audio_url: URL }
  }
  const run = async () => {
    const progress = { steps: structuredClone(done), onStepResolved: async (name: string, value: unknown) => {
      if (name === 'stage:scenes' && path === 'create') throw new Error('STOP_BEFORE_COMPOSITION')
      if ((h.fault === 'id-before-commit' || h.fault === 'id-after-commit') && name === `${key}:suno`) {
        if (h.fault === 'id-after-commit') done[name] = structuredClone(value)
        throw new Error('ID_ACK_LOST')
      }
      if (h.fault === 'result-before-commit' && name === key) throw new Error('RESULT_WRITE_FAILED')
      done[name] = structuredClone(value); h.acknowledgements.push(name)
    } }
    if (path === 'production') return executeProductionStep(production, progress, progress)
    if (path === 'auto') return generateAutoVideoAssets({ videoId: VIDEO, userEmail: null, plan_tier: 'free',
      config: { user_id: USER, default_voice_enabled: false, default_music_genre: 'cinematic', default_duration: 15 } as AutoConfig,
      plan: { script: SCRIPT.narration, music_prompt: SCRIPT.music_prompt } as VideoPlan, progress })
    return executeCreateJob(create, { steps: progress.steps,
      scenes: { '0': { url: 'https://media.fixture.invalid/acquired.mp4', type: 'ia', kind: 'video', duration: 15 } } }, progress)
  }
  const finish = async () => {
    if (path === 'create') await assert.rejects(run(), /STOP_BEFORE_COMPOSITION/)
    else await run()
    assert.equal(done[key], URL)
    assert.equal(done['asset:video'], 'https://media.fixture.invalid/raw.mp4')
    assert.equal(done['stage:export'], undefined)
  }
  return { h, run, finish }
}

for (const path of ['create', 'production', 'auto'] as const) {
  test(`${path}: timeout after accepted Suno ID resumes GET only; acquired results never regenerated`, async () => {
    const { h, run, finish } = scenario(path)
    await assert.rejects(run(), /REMOTE_STILL_PENDING/)
    h.pending = false
    await finish(); await finish()
    assert.equal(h.post, 1); assert.equal(h.get, 2); assert.equal(h.called, 2)
  })
  for (const fault of ['id-before-commit', 'id-after-commit', 'result-before-commit']) {
    test(`${path}: ${fault} never resubmits, and resumes only a durably known ID`, async () => {
      const { h, run, finish } = scenario(path); h.pending = false; h.fault = fault
      await assert.rejects(run(), /ID_ACK_LOST|RESULT_WRITE_FAILED/)
      h.fault = ''
      if (fault === 'id-before-commit') {
        for (let i = 0; i < 3; i++) await assert.rejects(run(), /SUTRA_RECONCILIATION_REQUIRED/)
        assert.equal(h.get, 0); assert.equal(h.called, 1)
      } else { await finish(); assert.equal(h.get, fault === 'id-after-commit' ? 1 : 2) }
      assert.equal(h.post, 1)
    })
  }
  test(`${path}: legacy ambiguous intent without ID remains quarantined`, async () => {
    const { h, run } = scenario(path); h.done[`${h.key}:started`] = true
    await assert.rejects(run(), /SUTRA_RECONCILIATION_REQUIRED/)
    assert.equal(h.called, 0)
  })
  test(`${path}: corrupt durable ID cannot enable any provider call`, async () => {
    const { h, run } = scenario(path); h.done[`${h.key}:started`] = true; h.done[`${h.key}:suno`] = { taskId: '../other-task' }
    await assert.rejects(run(), /SUTRA_RECONCILIATION_REQUIRED/)
    assert.equal(h.called, 0)
  })
}

test('duplicate Suno submission callbacks are coalesced; a competing task identity cannot replace the binding', async () => {
  const done: Record<string, unknown> = {}
  const writes: string[] = []
  const hooks = { onStepResolved: async (key: string) => { writes.push(key) } }
  const step = pipelineSteps(done, hooks)
  let calls = 0
  const generate = async (job: SunoJobPort) => {
    calls++
    await Promise.all([job.onSubmitted({ taskId: TASK }), job.onSubmitted({ taskId: TASK })])
    await assert.rejects(job.onSubmitted({ taskId: 'competing-task' }), /identity changed/)
    return URL
  }
  assert.deepEqual(await Promise.all(Array.from({ length: 12 }, () => musicCheckpointed(done, hooks, step, 'music', generate))), Array(12).fill(URL))
  assert.equal(calls, 1); assert.equal(writes.filter(k => k === 'music:suno').length, 1)
  assert.deepEqual(done['music:suno'], { taskId: TASK })
})
