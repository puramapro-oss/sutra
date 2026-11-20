// Independent T08 boundary: real stock adapter -> real creation pipeline.
// Existing paid/media/SQL ports are fixtures; no original fetch is reachable.
import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { CreateJobInput } from '../../src/lib/video-pipeline.ts'

let visualCalls = 0
let searches = 0
let responseBody: unknown = {}
let responseStatus = 200
const forbiddenVisual = 'T08_SYNTHETIC_PAID_VISUAL_ATTEMPT'
const finishedStockScene = 'T08_STOP_AFTER_REAL_STOCK_RESOLUTION'
const pipelineState = await import('../../src/lib/pipeline-state.ts')
mock.module('../../src/lib/pipeline-state.ts', { namedExports: {
  ...pipelineState, pipelineLog: async () => {}, pipelineNotification: async () => {},
  persistPipelineVideo: async () => assert.fail('no SQL write expected before the scene boundary'),
} })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({}) } })
mock.module('../../src/lib/fallbacks.ts', { namedExports: {
  generateVisualWithFallback: async () => { visualCalls++; throw new Error(forbiddenVisual) },
} })
mock.module('../../src/lib/claude.ts', { namedExports: { generateScript: async () => assert.fail('script already checkpointed') } })
mock.module('../../src/lib/suno.ts', { namedExports: { generateMusic: async () => assert.fail('music already checkpointed') } })
mock.module('../../src/lib/production-pipeline.ts', { namedExports: {
  executeProductionStep: async () => ({ url: 'https://media.fixture.invalid/voice.mp3' }),
} })
mock.module('../../src/lib/final-composition.ts', { namedExports: {
  assembleFinalVideo: async () => assert.fail('test stops before composition'),
} })
mock.module('../../src/lib/video-proofs.ts', { namedExports: {
  stampVideoWhenReady: async () => assert.fail('no ready video'),
} })
mock.module('../../src/lib/social-publication.ts', { namedExports: {
  publishVideoRecord: async () => assert.fail('no social operation'),
} })
const { executeCreateJob } = await import('../../src/lib/video-pipeline.ts')
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  assert.equal(url.origin, 'https://api.pexels.com')
  assert.equal(url.pathname, '/v1/videos/search')
  assert.equal(init?.method ?? 'GET', 'GET')
  searches++
  return Response.json(responseBody, { status: responseStatus })
}
const input: CreateJobInput = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', videoId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userEmail: null, userPlan: 'free', genPlan: 'free', quality: '720p', format: '16:9', mediaFormat: '16:9',
  topic: 'Independent stock-only boundary', mode: 'auto', mediaMode: 'stock', voiceId: 'fixture',
  stockSelections: [], brandKit: null,
}
const script = {
  title: 'Fixture', description: 'No generation', tags: [], narration: 'Fixture narration.',
  music_prompt: 'fixture', music_style: 'cinematic', estimated_duration: 5,
  scenes: [{ visual_prompt: 'ocean', duration_seconds: 5, use_stock: true }],
}
beforeEach(() => {
  visualCalls = 0; searches = 0; responseStatus = 200; responseBody = {}
  process.env.PEXELS_API_KEY = 'fixture-stock-only'
})

for (const failure of ['http403', 'http429', 'http500', 'malformed', 'empty'] as const) {
  test(`stock-only ${failure}: no visual submission or paid intent at the adapter/pipeline boundary`, async () => {
    if (failure.startsWith('http')) responseStatus = Number(failure.slice(4))
    if (failure === 'empty') responseBody = { videos: [] }
    const steps: Record<string, unknown> = {
      script, metadata_saved: true, music: 'https://media.fixture.invalid/music.mp3',
    }
    let failureMessage = ''
    try { await executeCreateJob(input, { scenes: {}, steps }) }
    catch (error) { failureMessage = error instanceof Error ? error.message : String(error) }
    assert.ok(failureMessage, 'stock failure must not become success')
    assert.equal(searches, 1)
    assert.equal(visualCalls, 0, `stock failure called visual provider: ${failureMessage}`)
    assert.equal(steps['scene:0:started'], undefined, 'no paid visual intent on a stock-only failure')
  })
}

test('successful stock response reaches the scene checkpoint with provenance and no visual generation', async () => {
  responseBody = { videos: [{ id: 1, url: 'https://www.pexels.com/video/1', duration: 5,
    video_files: [{ id: 2, quality: 'hd', width: 1280, height: 720, file_type: 'video/mp4',
      link: 'https://videos.pexels.com/fixture.mp4' }] }] }
  const clips: unknown[] = []
  await assert.rejects(executeCreateJob(input, {
    scenes: {}, steps: { script, metadata_saved: true, music: 'https://media.fixture.invalid/music.mp3' },
  }, { onSceneResolved: async (_index, clip) => { clips.push(clip); throw new Error(finishedStockScene) } }), new RegExp(finishedStockScene))
  assert.equal(searches, 1); assert.equal(visualCalls, 0)
  assert.deepEqual(clips, [{ url: 'https://videos.pexels.com/fixture.mp4', type: 'stock', kind: 'video', duration: 5 }])
})
