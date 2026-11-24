/** Export completion and lost-ACK recovery use real queue logic and synthetic DB boundaries. */
import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import type { VideoJob } from '../src/lib/video-queue'

let service: () => unknown = () => { throw new Error('UNEXPECTED_DATABASE_CALL') }
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service() } })
mock.module('../src/lib/utils.ts', { namedExports: { isAdmin: () => false } })
const { hasCompletedJobResult, finishJob } = await import('../src/lib/video-queue')

function receipt(options: { voice?: boolean; music?: boolean; hasAudio?: boolean } = {}) {
  const voiceUrl = options.voice === false ? '' : 'https://fixture.invalid/voice.mp3'
  const musicUrl = options.music === false ? null : 'https://fixture.invalid/music.mp3'
  const media = { url: 'https://fixture.invalid/final.mp4', outputVerified: true, duration: 5,
    outputSize: { width: 1280, height: 720 }, verification: { url: 'https://fixture.invalid/final.mp4',
      sha256: 'a'.repeat(64), duration: 5, width: 1280, height: 720, fps: 30, hasAudio: options.hasAudio ?? false } }
  const complete = (value: unknown) => ({ status: 'complete', value })
  const input = { videoId: 'fixture-video', userId: 'fixture-user', format: '16:9', quality: '720p',
    voiceUrl, musicUrl, voiceVolume: 0 as number | undefined, musicVolume: 0 as number | undefined,
    requiredTracks: { voice: false, music: false } }
  const steps = {
    'stage:script': { status: 'skipped', value: null },
    'stage:scenes': complete([{ url: 'https://fixture.invalid/source.mp4' }]),
    'stage:images': { status: 'skipped', value: [] },
    'stage:voice': { status: voiceUrl ? 'complete' : 'skipped', value: voiceUrl },
    'stage:music': { status: musicUrl ? 'complete' : 'skipped', value: musicUrl },
    'stage:subtitles': complete([]), 'stage:composition': complete(media), 'stage:export': complete(media),
  }
  const job: VideoJob = { id: 'fixture-job', video_id: input.videoId, user_id: input.userId, kind: 'export',
    payload: { input }, progress: { steps, result: { url: media.url, quality: input.quality } },
    provider_job_ids: {}, status: 'done', attempts: 1, max_attempts: 3, locked_by: null,
    last_error: null, idempotency_key: 'fixture-export' }
  return { job, input, steps, media }
}

for (const [name, options] of [
  ['both source tracks', {}], ['voice only', { music: false }], ['music only', { voice: false }],
] as const) {
  test(`verified silent export with ${name} explicitly muted is complete`, () => {
    assert.equal(hasCompletedJobResult(receipt(options).job), true)
  })
}
test('verified silent export without source audio remains complete', () => {
  assert.equal(hasCompletedJobResult(receipt({ voice: false, music: false }).job), true)
})
for (const track of ['voice', 'music'] as const) {
  for (const volume of [0.25, undefined]) {
    test(`${track} at ${String(volume)} volume still requires an audio proof`, () => {
      const f = receipt(); f.input[`${track}Volume`] = volume
      assert.equal(hasCompletedJobResult(f.job), false)
      f.media.verification.hasAudio = true
      assert.equal(hasCompletedJobResult(f.job), true)
    })
  }
  test(`a required ${track} cannot use mute to bypass its audio proof`, () => {
    const f = receipt(); f.input.requiredTracks[track] = true
    assert.equal(hasCompletedJobResult(f.job), false)
  })
}
for (const kind of ['create', 'production', 'auto'] as const) {
  test(`export mute settings do not relax ${kind} audio verification`, () => {
    const f = receipt(); f.job.kind = kind
    f.job.payload.input = { ...f.input, step: 'all', musicStyle: 'none', config: {} }
    f.job.progress.result = kind === 'create' ? { videoUrl: f.media.url }
      : kind === 'production' ? { assembly: { url: f.media.url } }
        : { videoFinalUrl: f.media.url, status: 'ready', assemblyError: null }
    assert.equal(hasCompletedJobResult(f.job), false)
    f.media.verification.hasAudio = true
    assert.equal(hasCompletedJobResult(f.job), true)
  })
}
for (const fault of ['missing-stage', 'raw-output', 'invalid-proof'] as const) {
  test(`muted export still rejects ${fault}`, () => {
    const f = receipt()
    if (fault === 'missing-stage') delete (f.steps as Record<string, unknown>)['stage:scenes']
    if (fault === 'raw-output') {
      f.media.url = f.media.verification.url = 'https://fixture.invalid/source.mp4'
      f.job.progress.result = { url: f.media.url, quality: f.input.quality }
    }
    if (fault === 'invalid-proof') f.media.verification.sha256 = 'not-a-hash'
    assert.equal(hasCompletedJobResult(f.job), false)
  })
}
for (const muted of [true, false]) {
  test(`lost finish ACK for ${muted ? 'muted' : 'audible'} export reconciles only valid durable media`, async t => {
    const f = receipt(); if (!muted) f.input.voiceVolume = 1
    const calls: string[] = []
    service = () => ({
      rpc: async (name: string) => { calls.push(name); return { data: null, error: { message: 'ACK_LOST' } } },
      from: (table: string) => {
        assert.equal(table, 'video_jobs')
        return { select: () => ({ eq: (field: string, id: string) => {
          assert.equal(field, 'id'); assert.equal(id, f.job.id)
          return { maybeSingle: async () => { calls.push('read'); return { data: f.job, error: null } } }
        } }) }
      },
    })
    t.after(() => { service = () => { throw new Error('UNEXPECTED_DATABASE_CALL') } })
    const result = finishJob(f.job.id, 'fixture-worker', 'done')
    if (muted) assert.equal(await result, 'done')
    else await assert.rejects(result, /SUTRA_JOB_FINISH_UNCONFIRMED/)
    assert.deepEqual(calls, ['finish_video_job', 'read'], 'no second completion or quota mutation')
  })
}
