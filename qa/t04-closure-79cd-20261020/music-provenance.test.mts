import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { generateMusicWithProvenance } from '../../src/lib/fallbacks.ts'
test.afterEach(() => mock.restoreAll())
for (const status of ['processing', 'succeeded']) test(`Stable Audio wrapper preserves job/provenance for ${status}`, async () => {
  process.env.REPLICATE_API_TOKEN = 'synthetic-contract-only'
  const stub = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ id: 'fixture-job', status, output: 'https://media.invalid/song.wav' })))
  if (status === 'processing') {
    await assert.rejects(generateMusicWithProvenance('fixture', '', 10, 'stable-audio'), {
      provider: 'stable-audio', jobId: 'fixture-job', remoteStatus: 'processing', retrySubmission: false, fallbackAllowed: false,
    })
  } else {
    const result = await generateMusicWithProvenance('fixture', '', 10, 'stable-audio')
    assert.equal(result.jobId, 'fixture-job'); assert.equal(result.remoteStatus, 'completed'); assert.equal(result.cost.actual, null)
  }
  assert.equal(stub.mock.callCount(), 1)
})
