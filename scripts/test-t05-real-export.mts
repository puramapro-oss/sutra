import test, { before, after, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { closeNetwork } from '../qa/t05-salad-media-20261014/fixtures.mts'
import { directory, exportsDir, fixturesDir, root, keys, bytes, ffmpeg, makeFixtures, transport, job,
  measureAudio, measurePixels, type Feature } from '../qa/t05-real-export-20261014/helpers.mts'
import type { VideoCompositionJob, VideoCompositionDeps } from '../src/lib/video-compositor.ts'
import type { MediaValidation } from '../src/lib/media-validation.ts'

// The runner does not inherit application credentials. These values are synthetic.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service'
closeNetwork()
const { composeVideoWithFallback } = await import('../src/lib/video-compositor.ts')
const { compositionPlan } = await import('../src/lib/composition-contract.ts')
const { probeMedia } = await import('../src/lib/media-inspection.ts')
const { assertFinalMedia, mediaValidation } = await import('../src/lib/media-validation.ts')
const evidence: { base: string; environment?: unknown; exports: unknown[]; rejections: unknown[] } = {
  base: 'e09fdaeafbf1ec8554a7b689fe3c44dd696d0140', exports: [], rejections: [],
}
const proofs = new Map<string, { validation: MediaValidation; job: VideoCompositionJob; path: string }>()
before(async () => { evidence.environment = await makeFixtures() })
beforeEach(() => { transport() })
afterEach(() => mock.restoreAll())
after(async () => { await writeFile(process.env.T05_REAL_EXPORT_EVIDENCE ?? join(directory, 'measurements.json'), JSON.stringify(evidence, null, 2) + '\n') })

const modes: Array<[string, readonly Feature[], boolean?]> = [
  ['video-only', []], ['music-only', ['music']], ['voice-only', ['voice']], ['voice-music', ['voice', 'music']],
  ['subtitles', ['subtitles']], ['logo', ['logo']], ['intro', ['intro']], ['outro', ['outro']],
  ['intro-outro', ['intro', 'outro']], ['all-required', keys], ['all-optional', keys, true],
]
const formats = ['16:9', '9:16', '1:1'] as const

async function exportFile(name: string, contract: VideoCompositionJob) {
  const path = join(exportsDir, name + '.mp4')
  let uploads = 0, fallbackCalls = 0
  const result = await composeVideoWithFallback(contract, {
    assemble: async () => { fallbackCalls++; throw new Error('LIVE_RENDER_FORBIDDEN') },
    upload: async (_name, buffer, mime) => {
      assert.equal(mime, 'video/mp4'); uploads++
      assert.ok(Buffer.isBuffer(buffer))
      await writeFile(path, buffer)
      return `https://exports.invalid/${name}.mp4`
    },
  })
  assert.equal(uploads, 1); assert.equal(fallbackCalls, 0); assert.equal(result.engine, 'ffmpeg')
  assert.equal(result.url, `https://exports.invalid/${name}.mp4`)
  assert.ok(result.validation)
  // Reopen the exported bytes, not just the compositor's temporary output.
  const actual = await probeMedia(path)
  assert.deepEqual(actual, result.validation.final)
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), actual.sha256)
  assertFinalMedia(actual, contract)
  const plan = compositionPlan(contract)
  assert.deepEqual([actual.video?.width, actual.video?.height], [plan.width, plan.height])
  assert.equal(actual.video?.orientation, contract.format === '16:9' ? 'landscape' : contract.format === '9:16' ? 'portrait' : 'square')
  assert.equal(actual.video?.frames, Math.round(plan.total * 30))
  assert.equal(actual.fullDecode, true); assert.equal(actual.video?.codec, 'h264')
  assert.equal(actual.video?.fps, 30); assert.equal(actual.video?.sar, '1:1')
  assert.equal(actual.audio.length, 1); assert.equal(actual.audio[0].codec, 'aac')
  proofs.set(name, { path, job: contract, validation: result.validation })
  return { file: `exports/${name}.mp4`, engine: result.engine, upload: 'local file adapter; no remote storage', validation: result.validation }
}

for (const format of formats) for (const [mode, features, optional] of modes) {
  test(`retained CPU export ${format} ${mode}: decode, clock, audio spectrum and visual pixels`, async () => {
    const name = format.replace(':', '-') + '-' + mode, contract = job(format, features, optional)
    const exported = await exportFile(name, contract), { path } = proofs.get(name)!
    const { width, height } = exported.validation.final.video!
    const audio = await measureAudio(path, features)
    const pixels = await measurePixels(path, width, height, features)
    assert.equal(exported.validation.resolutionOrigin, 'upscaled')
    assert.deepEqual([exported.validation.sources[0].native?.video?.width, exported.validation.sources[0].source.video?.width,
      exported.validation.sources[0].enhanced?.video?.width], [160, 320, 320])
    evidence.exports.push({ status: 'PASS', ...exported, features, requirements: contract.requirements, audio, pixels })
  })
}

for (const format of formats) test(`retained 4K ${format}: actual upscale from measured source and native`, async () => {
  const contract = job(format, ['subtitles'])
  contract.quality = '4k'; contract.clips[0].durationSeconds = 0.2
  contract.subtitles = [{ text: 'SUTRA', start: 0, end: 0.2 }]
  const exported = await exportFile(format.replace(':', '-') + '-4k-upscale', contract)
  assert.equal(exported.validation.resolutionOrigin, 'upscaled')
  evidence.exports.push({ status: 'PASS', ...exported, provenance: '160x90 native synthetic -> 320x180 enhanced/source -> measured 4K output; no native 4K generation' })
})

test('retained synthetic native 4K control: dimensions alone never attest generation', async () => {
  const contract = job('16:9', ['subtitles'])
  contract.quality = '4k'; contract.clips = [{ url: root + 'native-4k.mp4', type: 'stock', durationSeconds: 0.2,
    lineage: { nativeUrl: root + 'native-4k.mp4', generation: { kind: 'native', evidence: 'lavfi-color-3840x2160-no-AI' } } }]
  contract.subtitles = [{ text: 'SUTRA', start: 0, end: 0.2 }]
  const exported = await exportFile('16-9-4k-native-synthetic', contract)
  assert.equal(exported.validation.resolutionOrigin, 'native-4k-attested')
  const unknown = mediaValidation(contract, exported.validation.final, exported.validation.sources.map(s => ({ ...s, generation: null })))
  assert.equal(unknown.resolutionOrigin, '4k-origin-unknown')
  evidence.exports.push({ status: 'PASS', ...exported, provenance: 'native synthetic lavfi fixture only; not AI generation proof', withoutAttestation: unknown.resolutionOrigin })
})

async function mustReject(name: string, contract: VideoCompositionJob, deps: VideoCompositionDeps = {}, expectedFallback?: number) {
  let uploads = 0, fallbacks = 0
  let reason: string | undefined
  await assert.rejects(composeVideoWithFallback(contract, {
    assemble: async () => { fallbacks++; throw new Error('SYNTHETIC_FALLBACK_FAILURE') },
    ...deps, upload: async () => { uploads++; throw new Error('UNEXPECTED_UPLOAD') },
  }), (error: unknown) => {
    assert.ok(error instanceof Error); reason = error.message
    assert.doesNotMatch(reason, /UNEXPECTED_UPLOAD|T05_UNEXPECTED_NETWORK|LIVE_RENDER_FORBIDDEN/)
    return true
  })
  assert.equal(uploads, 0)
  if (expectedFallback !== undefined) assert.equal(fallbacks, expectedFallback)
  evidence.rejections.push({ status: 'PASS', name, reason, uploads, mockedFallbackAttempts: fallbacks })
}

for (const name of ['invalid.mp4', 'truncated.mp4', 'corrupt-tail.mp4', 'expired.mp4']) test(`bad source ${name} cannot export or return raw success`, async () => {
  const contract = job('16:9', ['subtitles']); contract.clips = [{ url: root + name, type: 'stock', durationSeconds: 1.2 }]
  await mustReject(name, contract, {}, 0)
})

for (const feature of ['voice', 'music'] as const) test(`${feature} supplied without audio is rejected before upload or fallback`, async () => {
  const contract = job('16:9', [feature]); contract[feature === 'voice' ? 'voiceUrl' : 'musicUrl'] = root + 'source.mp4'
  await mustReject(feature + '-no-audio', contract, {}, 0)
})

test('each mandatory missing or disabled supplied asset fails before any rendering', async () => {
  let renderCalls = 0
  const forbidden = async (): Promise<never> => { renderCalls++; throw new Error('UNEXPECTED_RENDER') }
  for (const key of keys) {
    const missing = job('16:9'); missing.requirements = { [key]: 'required' }
    await mustReject('missing-required-' + key, missing, { compose: forbidden }, 0)
    const disabled = job('16:9', [key]); disabled.requirements = { [key]: 'disabled' }
    await mustReject('supplied-disabled-' + key, disabled, { compose: forbidden }, 0)
  }
  assert.equal(renderCalls, 0)
})

test('both composition engines failing cannot return a raw source as final', async () => {
  await mustReject('both-engines-fail', job('16:9', ['voice']), { compose: async () => { throw new Error('SYNTHETIC_COMPOSITION_FAILURE') } }, 1)
})

test('fallback returning input URL is rejected despite an otherwise valid media proof', async () => {
  const sample = proofs.get('16-9-all-required')!
  await mustReject('raw-url-fallback', sample.job, { compose: async () => { throw new Error('SYNTHETIC_COMPOSITION_FAILURE') },
    assemble: async () => ({ url: sample.job.clips[0].url, duration: 1.6, validation: sample.validation, timeline: {},
      outputQuality: 'hd', outputSize: { width: 1280, height: 720 }, outputVerified: true }) })
})

test('storage error after successful CPU composition does not trigger another renderer', async () => {
  const sample = proofs.get('16-9-all-required')!
  let fallbacks = 0
  await assert.rejects(composeVideoWithFallback(sample.job, {
    compose: async () => ({ buffer: await readFile(sample.path), durationSeconds: 1.6, resolution: '1280x720', validation: sample.validation }),
    assemble: async () => { fallbacks++; throw new Error('UNEXPECTED_FALLBACK') },
    upload: async () => { throw new Error('SYNTHETIC_STORAGE_FAILURE') },
  }), /SYNTHETIC_STORAGE_FAILURE/)
  assert.equal(fallbacks, 0)
  evidence.rejections.push({ status: 'PASS', name: 'storage-failure', fallbackAttempts: fallbacks, returnedSuccess: false })
})

test('real final file without expected audio or with delayed audio is refused', async () => {
  const sample = proofs.get('16-9-all-required')!
  for (const [name, args, expected] of [
    ['final-no-audio', ['-i', sample.path, '-an', '-c:v', 'copy'], /audio requis/],
    ['final-delayed-audio', ['-i', sample.path, '-itsoffset', '0.25', '-i', sample.path, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-t', '1.6'], /desynchronisation/],
  ] as const) {
    const path = join(fixturesDir, name + '.mp4')
    await ffmpeg([...args, path])
    const actual = await probeMedia(path)
    assert.throws(() => assertFinalMedia(actual, sample.job), expected)
    evidence.rejections.push({ status: 'PASS', name, fullDecode: actual.fullDecode, audio: actual.audio, video: actual.video })
  }
})

test('full decoding rejects damaged and truncated final exports after persistence', async () => {
  const sample = proofs.get('16-9-all-required')!, buffer = await readFile(sample.path)
  for (const [name, data] of [['final-truncated', buffer.subarray(0, buffer.length - 300)], ['final-invalid', bytes['invalid.mp4']]] as const) {
    const path = join(fixturesDir, name + '.mp4')
    await writeFile(path, data)
    await assert.rejects(probeMedia(path), /corrompu/)
    evidence.rejections.push({ status: 'PASS', name, fullDecodeRejected: true, bytes: data.length })
  }
})
