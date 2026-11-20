// T05: existing remote-worker boundary, not a claim of a live Salad adapter.
import test, { before, beforeEach, afterEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import { makeFixtures, closeNetwork, mediaTransport, workerTransport, seconds, urls, type Fixtures } from '../qa/t05-salad-media-20261014/fixtures.mts'
import { verifyVideoBytes } from '../src/lib/media-probe.ts'
import type { CompositionContract } from '../src/lib/composition-contract.ts'
import type { MediaValidation } from '../src/lib/media-validation.ts'
import type { AssembleResult } from '../src/lib/shotstack.ts'
import type { ExportJobInput } from '../src/lib/export-pipeline.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service'
process.env.LOCAL_ENGINE_ENABLED = 'true'
process.env.LOCAL_VIDEO_API_URL = urls.worker
globalThis.fetch = async () => { throw new Error('T05_UNEXPECTED_NETWORK') }
closeNetwork()
const { probeMedia } = await import('../src/lib/media-inspection.ts')
const { validateRenderedMedia, mediaValidation, measureSources } = await import('../src/lib/media-validation.ts')
const { generateLocalVideo } = await import('../src/lib/local-engine.ts')
const { verifyAndStoreRenderedVideo } = await import('../src/lib/shotstack.ts')
const { executeExportJob } = await import('../src/lib/export-pipeline.ts')
const { composeVideoWithFallback } = await import('../src/lib/video-compositor.ts')

let fixtures: Fixtures
const expected = { width: 1280, height: 720, duration: seconds, fps: 30 }
const workerInput = { ...expected, prompt: 'synthetic fixture' }
const contract: CompositionContract = { clips: [{ url: urls.source, durationSeconds: seconds }], format: '16:9', quality: '720p' }
const input: ExportJobInput = { videoId: 'synthetic-video', userId: 'synthetic-owner', quality: '720p', format: '16:9',
  clips: [{ url: urls.source, duration: seconds, type: 'ia' }], voiceUrl: '', musicUrl: null, musicVolume: 0.25,
  requiredTracks: { voice: false, music: false }, subtitles: [] }
before(async () => { fixtures = await makeFixtures() })
beforeEach(closeNetwork)
afterEach(() => { mock.restoreAll(); globalThis.fetch = async () => { throw new Error('T05_UNEXPECTED_NETWORK') } })
after(async () => {
  if (!fixtures) return
  if (process.env.T05_MEDIA_EVIDENCE) await writeFile(process.env.T05_MEDIA_EVIDENCE, JSON.stringify({
    proof: 'SYNTHETIC_CPU_BYTES_REAL_DECODE_NO_PROVIDER', node: process.version, ffmpeg: fixtures.ffmpeg, ffprobe: fixtures.ffprobe,
    fixtures: Object.fromEntries(Object.entries(fixtures.files).map(([name, value]) => [name, value.probe])),
    corruptTail: { sha256: fixtures.corruptSha256, bytes: fixtures.corrupt.length, headerDimensionsReadable: true },
  }, null, 2) + '\n')
  await rm(fixtures.directory, { recursive: true, force: true })
})

async function receipt(name = 'final', url = urls.final): Promise<AssembleResult> {
  const fixture = fixtures.files[name]
  return verifyAndStoreRenderedVideo({ url, duration: seconds, outputQuality: 'hd',
    outputSize: { width: 1280, height: 720 }, outputVerified: false, timeline: {} },
  { userId: input.userId, mediaId: input.videoId, requireAudio: false }, {
    download: async () => fixture.bytes, verify: verifyVideoBytes, upload: async () => url,
  })
}

test('worker base64: real decoded dimensions/FPS, source buffer is not a ready receipt', async () => {
  workerTransport({ video_base64: fixtures.files.source.bytes.toString('base64') })
  const result = await generateLocalVideo(workerInput)
  assert.deepEqual(Buffer.from(result.videoBuffer), fixtures.files.source.bytes)
  assert.equal(result.resolution, '1280x720')
  assert.equal(result.duration, seconds)
  assert.equal('outputVerified' in result, false)
  assert.equal('url' in result, false)
})
test('worker same-origin URL: actual download bytes decoded before return', async () => {
  const requests = workerTransport({ video_url: '/result.mp4?expires=synthetic' }, { bytes: fixtures.files.source.bytes })
  assert.equal((await generateLocalVideo(workerInput)).resolution, '1280x720')
  assert.equal(requests.length, 2)
})
for (const status of [403, 410]) test(`worker expired output HTTP ${status}: no returned media or retry`, async () => {
  const requests = workerTransport({ video_url: '/result.mp4?expires=synthetic' }, { status })
  await assert.rejects(generateLocalVideo(workerInput), new RegExp(`SUTRA_LOCAL_FILE_HTTP_${status}`))
  assert.equal(requests.length, 2)
})
test('worker corrupt last packet despite readable MP4 header fails full decode', async () => {
  workerTransport({ video_base64: fixtures.corrupt.toString('base64') })
  await assert.rejects(generateLocalVideo(workerInput), /SUTRA_MEDIA_INVALID_OR_UNDECODABLE/)
  await assert.rejects(probeMedia(fixtures.corruptPath), /corrompu/)
})
for (const [name, reason] of [['native', 'DIMENSIONS_MISMATCH'], ['portrait', 'DIMENSIONS_MISMATCH'],
  ['fps16', 'FPS_MISMATCH'], ['sar2', 'NON_SQUARE_PIXELS']] as const) {
  test(`worker rejects measured ${name}, not trusted request labels`, async () => {
    workerTransport({ video_base64: fixtures.files[name].bytes.toString('base64') })
    await assert.rejects(generateLocalVideo(workerInput), new RegExp(reason))
  })
}
test('silent worker output is usable as a source, but required audio blocks durable export', async () => {
  let uploads = 0
  await assert.rejects(verifyAndStoreRenderedVideo({ ...(await receipt('source')), outputVerified: false },
    { userId: input.userId, mediaId: input.videoId, requireAudio: true }, {
      download: async () => fixtures.files.source.bytes, verify: verifyVideoBytes,
      upload: async () => { uploads++; return urls.final },
    }), /SUTRA_MEDIA_AUDIO_REQUIRED/)
  assert.equal(uploads, 0)
})
test('source/native/enhanced and requested/final dimensions are independently measured; upscale is explicit', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.source.bytes }, [urls.native]: { bytes: fixtures.files.native.bytes },
    [urls.enhanced]: { bytes: fixtures.files.enhanced.bytes }, [urls.final]: { bytes: fixtures.files.enhanced.bytes } })
  const c: CompositionContract = { ...contract, quality: '4k', clips: [{ ...contract.clips[0], lineage: {
    nativeUrl: urls.native, enhancedUrl: urls.enhanced, generation: { kind: 'upscaled', evidence: 'synthetic CPU scale filter; no model generation' },
  } }] }
  const result = await validateRenderedMedia(urls.final, c)
  assert.equal(result.resolutionOrigin, 'upscaled')
  assert.deepEqual([result.sources[0].source.video?.width, result.sources[0].native?.video?.width,
    result.sources[0].enhanced?.video?.width, result.requested.width, result.final.video?.width], [1280, 640, 3840, 3840, 3840])
})
test('4K dimensions alone remain origin-unknown; native label requires explicit lineage (synthetic assertion only)', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.native4k.bytes }, [urls.native]: { bytes: fixtures.files.native4k.bytes } })
  const c = { ...contract, quality: '4k' }
  const source = await measureSources(c)
  assert.equal(mediaValidation(c, fixtures.files.native4k.probe, source).resolutionOrigin, '4k-origin-unknown')
  const attested: CompositionContract = { ...c, clips: [{ ...c.clips[0], lineage: { nativeUrl: urls.native,
    generation: { kind: 'native', evidence: 'SYNTHETIC fixture assertion; NOT real native model generation' } } }] }
  assert.equal(mediaValidation(attested, fixtures.files.native4k.probe, await measureSources(attested)).resolutionOrigin, 'native-4k-attested')
})
test('false native-4K claim cannot override a measured lower-resolution native output', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.enhanced.bytes }, [urls.native]: { bytes: fixtures.files.native.bytes } })
  const c: CompositionContract = { ...contract, quality: '4k', clips: [{ ...contract.clips[0], lineage: {
    nativeUrl: urls.native, generation: { kind: 'native', evidence: 'false synthetic worker claim' },
  } }] }
  assert.equal(mediaValidation(c, fixtures.files.enhanced.probe, await measureSources(c)).resolutionOrigin, 'upscaled')
})
test('missing declared native measurement cannot certify provenance', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.enhanced.bytes }, [urls.native]: { status: 410 } })
  const c = { ...contract, clips: [{ ...contract.clips[0], lineage: { nativeUrl: urls.native } }] }
  await assert.rejects(measureSources(c), /Telechargement media refuse/)
})
for (const field of ['voice', 'music'] as const) test(`export ${field} mandatory but absent: zero assembly/persistence`, async () => {
  let calls = 0
  await assert.rejects(executeExportJob({ ...input, requiredTracks: { ...input.requiredTracks, [field]: true } }, { steps: {} }, {}, {
    assemble: async () => { calls++; return receipt() }, persist: async () => { calls++ },
  }), new RegExp(`REQUIRED_${field.toUpperCase()}_MISSING`))
  assert.equal(calls, 0)
})
test('export optional sound: valid silent composed bytes can persist with fresh full measurements', async () => {
  // Real silent 720p output differs from the measured 360p source.
  mediaTransport({ [urls.source]: { bytes: fixtures.files.native.bytes }, [urls.final]: { bytes: fixtures.files.source.bytes } })
  let writes = 0
  const result = await executeExportJob(input, { steps: {} }, {}, {
    assemble: async () => receipt('source'), persist: async (_input, update) => {
      writes++; assert.equal(update.video_url, urls.final)
      assert.ok(update.shotstack_json?.sutraMediaValidation)
    },
  })
  assert.equal(result.url, urls.final); assert.equal(writes, 1)
})
test('export expected audio absent in final bytes: forged hasAudio receipt cannot reach persistence', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.source.bytes }, [urls.voice]: { bytes: fixtures.files.final.bytes },
    [urls.final]: { bytes: fixtures.files.source.bytes } })
  let writes = 0
  const assembled = await receipt('source'); assembled.verification!.hasAudio = true
  await assert.rejects(executeExportJob({ ...input, voiceUrl: urls.voice, requiredTracks: { voice: true, music: false } }, { steps: {} }, {}, {
    assemble: async () => assembled, persist: async () => { writes++ },
  }), /audio requis absent/)
  assert.equal(writes, 0)
})
test('export A/V timestamps out of sync reject despite audio stream presence', async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.source.bytes }, [urls.final]: { bytes: fixtures.files.offset.bytes } })
  await assert.rejects(validateRenderedMedia(urls.final, contract), /desynchronisation audio\/video/)
})
for (const fault of ['expired', 'corrupt'] as const) test(`export cached completion ${fault}: fresh validation refuses ready, no new render`, async () => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.source.bytes },
    [urls.final]: fault === 'expired' ? { status: 403 } : { bytes: fixtures.corrupt } })
  const done = { steps: { assembly: await receipt() } }
  let calls = 0
  await assert.rejects(executeExportJob(input, done, {}, {
    assemble: async () => { calls++; return receipt() }, persist: async () => { calls++ },
  }), fault === 'expired' ? /Telechargement media refuse/ : /corrompu/)
  assert.equal(calls, 0)
  assert.equal('saved' in done.steps, false)
})
test('failed assembly has no raw fallback and no automatic repeat', async () => {
  const done = { steps: {} }; let assemblies = 0, writes = 0
  const providers = { assemble: async (): Promise<AssembleResult> => { assemblies++; throw new Error('synthetic assembly failed') },
    persist: async () => { writes++ } }
  await assert.rejects(executeExportJob(input, done, {}, providers), /synthetic assembly failed/)
  await assert.rejects(executeExportJob(input, done, {}, providers), /RECONCILIATION_REQUIRED/)
  assert.equal(assemblies, 1); assert.equal(writes, 0); assert.equal('saved' in done.steps, false)
})
test('completed raw source URL is refused even with a valid byte receipt', async () => {
  let writes = 0
  await assert.rejects(executeExportJob(input, { steps: {} }, {}, {
    assemble: async () => receipt('source', urls.source), persist: async () => { writes++ },
  }), /raw media/)
  assert.equal(writes, 0)
})
test('DEFECT T05-MEDIA-01: raw bytes behind a different URL must not persist as a subtitled final', async t => {
  mediaTransport({ [urls.source]: { bytes: fixtures.files.source.bytes }, [urls.final]: { bytes: fixtures.files.source.bytes } })
  let writes = 0
  const result = executeExportJob({ ...input, subtitles: [{ text: 'REQUIRED SYNTHETIC CAPTION', start: 0, end: seconds }],
    requirements: { subtitles: 'required' } }, { steps: {} }, {}, {
    assemble: async () => receipt('source'), persist: async (_input, update) => {
      writes++
      const measured = update.shotstack_json?.sutraMediaValidation as MediaValidation
      t.diagnostic(JSON.stringify({ defect: 'T05-MEDIA-01', persistCalls: writes,
        finalEqualsSourceSha256: measured.final.sha256 === measured.sources[0].source.sha256,
        subtitlesClaim: measured.subtitles.mode, subtitleProof: measured.subtitles.verification,
        actualFixture: 'solid blue frames, no text', requestedSubtitleCount: measured.subtitles.cues.length }))
    },
  })
  await assert.rejects(result, /brute|raw|identique|source|composition/i,
    'raw source bytes were accepted as a subtitled final through an alias URL')
  assert.equal(writes, 0)
})
test('both compositors fail: no upload, no raw success (Shotstack dependency is only a throwing mock)', async () => {
  let cloud = 0, uploads = 0
  mock.method(console, 'error', () => {})
  await assert.rejects(composeVideoWithFallback({ ...contract, format: '16:9', quality: '720p',
    transitions: 'none',
    clips: [{ url: urls.source, type: 'ia', durationSeconds: seconds }], subtitles: [] }, {
    compose: async () => { throw new Error('synthetic ffmpeg unavailable') },
    assemble: async () => { cloud++; throw new Error('synthetic cloud unavailable') },
    upload: async () => { uploads++; return urls.source },
  }), /synthetic cloud unavailable/)
  assert.equal(cloud, 1); assert.equal(uploads, 0)
})
