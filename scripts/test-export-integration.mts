import test from 'node:test'
import assert from 'node:assert/strict'
import { simulatedValidation } from './helpers/media-validation-fixture.ts'
import type { ExportJobInput, ExportProviders } from '../src/lib/export-pipeline.ts'
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'fixture-anon'
const { executeExportJob } = await import('../src/lib/export-pipeline.ts')
const input: ExportJobInput = { videoId: 'v', userId: 'u', format: '16:9', quality: '720p',
  voiceUrl: '', musicUrl: null, musicVolume: 0.3, requiredTracks: { voice: false, music: false },
  clips: [{ url: 'https://source.invalid/clip.mp4', type: 'ia', duration: 5 }], subtitles: [] }
function fixture() {
  const calls = { render: 0, validate: 0, persist: 0 }
  const providers: ExportProviders = {
    assemble: async () => { calls.render++; return { url: 'https://storage.invalid/final.mp4', duration: 5,
      outputQuality: 'hd', outputSize: { width: 1280, height: 720 }, outputVerified: true, timeline: {},
      verification: { url: 'https://storage.invalid/final.mp4', sha256: '0'.repeat(64), duration: 5, width: 1280, height: 720, fps: 30, hasAudio: false } } },
    validate: async (_url, contract) => { calls.validate++; return simulatedValidation(contract) },
    persist: async () => { calls.persist++ },
  }
  return { calls, providers, steps: {} as Record<string, unknown> }
}
test('export resumes paid and saved steps but freshly validates immutable bytes', async () => {
  const f = fixture()
  await executeExportJob(input, f, {}, f.providers)
  await executeExportJob(input, f, {}, f.providers)
  assert.deepEqual(f.calls, { render: 1, validate: 2, persist: 1 })
  f.providers.validate = async (_url, contract) => { const v = simulatedValidation(contract); v.final.sha256 = '1'.repeat(64); return v }
  await assert.rejects(executeExportJob(input, f, {}, f.providers), /MEDIA_CHANGED/)
  assert.equal(f.calls.render, 1)
})
test('changed brief is rejected before any paid resubmission or publication', async () => {
  const f = fixture(); await executeExportJob(input, f, {}, f.providers)
  await assert.rejects(executeExportJob({ ...input, quality: '1080p' }, f, {}, f.providers), /CONTRACT_CHANGED/)
  assert.deepEqual(f.calls, { render: 1, validate: 1, persist: 1 })
})
test('legacy checkpoints cannot return a different saved URL', async () => {
  const f = fixture(); await executeExportJob(input, f, {}, f.providers)
  delete f.steps.mediaContractHash
  f.steps.saved = { url: input.clips[0].url, quality: '720p' }
  await assert.rejects(executeExportJob(input, f, {}, f.providers), /CHECKPOINT_MISMATCH/)
  assert.equal(f.calls.persist, 1)
})
test('validation failure is retryable without another render', async () => {
  const f = fixture(); const validate = f.providers.validate
  f.providers.validate = async () => { throw new Error('probe failed') }
  await assert.rejects(executeExportJob(input, f, {}, f.providers), /probe failed/)
  assert.equal(f.calls.persist, 0)
  f.providers.validate = validate
  await executeExportJob(input, f, {}, f.providers)
  assert.equal(f.calls.render, 1); assert.equal(f.calls.persist, 1)
})
