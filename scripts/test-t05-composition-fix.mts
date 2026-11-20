import test, { before, after, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import https from 'node:https'
import type { PassThrough } from 'node:stream'
import { closeNetwork, mediaTransport } from '../qa/t05-salad-media-20261014/fixtures.mts'
import type { CompositionContract, CompositionRequirements } from '../src/lib/composition-contract.ts'
import { buildSubtitlesFilter, generateSRT } from '../src/lib/ffmpeg-filters.ts'
import type { AssembleParams } from '../src/lib/shotstack.ts'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service'
globalThis.fetch = async () => { throw new Error('T05_UNEXPECTED_NETWORK') }
closeNetwork()
const { compositionPlan } = await import('../src/lib/composition-contract.ts')
const { buildTracks, shotstackContract } = await import('../src/lib/shotstack-timeline.ts')
const { composeVideo } = await import('../src/lib/ffmpeg-compositor.ts')
const { mediaValidation } = await import('../src/lib/media-validation.ts')
const { probeMedia } = await import('../src/lib/media-inspection.ts')
const { composeVideoWithFallback } = await import('../src/lib/video-compositor.ts')

const exec = promisify(execFile)
const root = 'https://media.invalid/'
const keys = ['voice', 'music', 'subtitles', 'logo', 'intro', 'outro'] as const
const base: AssembleParams = { clips: [{ url: root + 'black.mp4', duration: 0.4, type: 'stock' }],
  voiceUrl: '', musicUrl: '', musicVolume: 0.25, subtitles: [], transitions: 'none', format: '16:9', quality: '720p' }
let directory: string
const bytes: Record<string, Buffer> = {}
const evidence: Record<string, unknown> = {}
async function ffmpeg(args: string[]) {
  return exec('ffmpeg', ['-nostdin', '-v', 'error', '-threads', '1', ...args], { timeout: 60000, maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' })
}
before(async () => {
  closeNetwork()
  directory = await mkdtemp(join(tmpdir(), 'sutra-t05-composition-fix-'))
  for (const [name, color] of [['black', 'black'], ['intro', 'red'], ['outro', 'blue']]) {
    const path = join(directory, name + '.mp4')
    await ffmpeg(['-f', 'lavfi', '-i', `color=${color}:s=320x180:r=30:d=0.4`, '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', path])
    bytes[name + '.mp4'] = await readFile(path)
  }
  for (const [name, size] of [['native', '160x90'], ['uhd', '3840x2160']]) {
    const path = join(directory, name + '.mp4')
    await ffmpeg(['-f', 'lavfi', '-i', `color=black:s=${size}:r=30:d=0.2`, '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', path])
    bytes[name + '.mp4'] = await readFile(path)
  }
  for (const [name, hz] of [['voice', 440], ['music', 880]]) {
    const path = join(directory, name + '.wav')
    await ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=0.3`, path])
    bytes[name + '.wav'] = await readFile(path)
  }
  const logo = join(directory, 'logo.png')
  await ffmpeg(['-f', 'lavfi', '-i', 'color=white:s=32x32', '-frames:v', '1', logo])
  bytes['logo.png'] = await readFile(logo)
})
beforeEach(() => {
  closeNetwork()
  mediaTransport(Object.fromEntries(Object.entries(bytes).map(([name, data]) => [root + name, { bytes: data }])))
  // Reuse the isolated HTTPS fixture, with truthful types for non-video assets.
  const request = https.request
  mock.method(https, 'request', (url: URL, options: Parameters<typeof request>[1], callback: (stream: PassThrough & { headers: Record<string, string> }) => void) =>
    request(url, options, stream => {
      stream.headers['content-type'] = url.pathname.endsWith('.png') ? 'image/png' : url.pathname.endsWith('.wav') ? 'audio/wav' : 'video/mp4'
      callback(stream as unknown as PassThrough & { headers: Record<string, string> })
    }))
})
afterEach(() => mock.restoreAll())
after(async () => {
  if (process.env.T05_COMPOSITION_EVIDENCE) await writeFile(process.env.T05_COMPOSITION_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n')
  if (directory) await rm(directory, { recursive: true, force: true })
})

test('64 presence combinations: required/optional/disabled agree with Shotstack tracks and clock', () => {
  for (let mask = 0; mask < 64; mask++) {
    const has = (key: typeof keys[number]) => Boolean(mask & (1 << keys.indexOf(key)))
    const p: AssembleParams = { ...base,
      voiceUrl: has('voice') ? root + 'voice.wav' : '', musicUrl: has('music') ? root + 'music.wav' : '',
      subtitles: has('subtitles') ? [{ text: 'SUTRA', start: 0, end: 0.3 }] : [],
      watermarkUrl: has('logo') ? root + 'logo.png' : null, introOutroDurationSeconds: 0.2,
      brandKit: { intro_template: has('intro') ? root + 'intro.mp4' : undefined, outro_template: has('outro') ? root + 'outro.mp4' : undefined },
      requirements: Object.fromEntries(keys.map(k => [k, has(k) ? 'required' : 'optional'])) as CompositionRequirements,
    }
    const contract = shotstackContract(p)
    const plan = compositionPlan(contract)
    assert.deepEqual(compositionPlan({ ...contract, requirements: Object.fromEntries(keys.map(k => [k, 'optional'])) }), plan)
    const tracks = buildTracks(p, 0.3)
    const clips = tracks.flatMap(track => track.clips) as Array<{ asset: { type: string; src?: string; text?: string }; start: number; length: number }>
    for (const key of keys) {
      if (!has(key)) {
        assert.throws(() => compositionPlan({ ...contract, requirements: { [key]: 'required' } }), /obligatoire/)
        assert.deepEqual(compositionPlan({ ...contract, requirements: { [key]: 'disabled' } }), plan)
      }
      else assert.throws(() => compositionPlan({ ...contract, requirements: { [key]: 'disabled' } }), /desactive/)
    }
    assert.equal(clips.some(c => c.asset.src === p.voiceUrl && c.asset.type === 'audio'), has('voice'))
    assert.equal(clips.some(c => c.asset.src === p.musicUrl && c.asset.type === 'audio'), has('music'))
    assert.equal(clips.some(c => c.asset.type === 'image'), has('logo'))
    assert.equal(clips.some(c => c.asset.type === 'title'), has('subtitles'))
    assert.ok(Math.abs(Math.max(...clips.map(c => c.start + c.length)) - plan.total) < 1e-9)
    for (const c of clips.filter(c => c.asset.src === p.voiceUrl || c.asset.type === 'title')) assert.equal(c.start, plan.intro)
  }
})

test('required subtitle cannot fall wholly between two video frames', () => {
  for (const requirement of ['required', 'optional'] as const) {
    assert.throws(() => compositionPlan({ ...shotstackContract(base), requirements: { subtitles: requirement },
      subtitles: [{ text: 'invisible', start: 0.001, end: 0.002 }] }), /Sous-titre/)
  }
  for (const start of [0, 0.001, 0.1]) {
    const p = compositionPlan({ ...shotstackContract(base), subtitles: [{ text: 'one frame', start, end: start + 1 / 30 }] })
    assert.equal(p.subtitles.length, 1)
  }
})

test('invalid brief fails before composition, paid fallback or upload', async () => {
  let calls = 0
  const unexpected = async (): Promise<never> => { calls++; throw new Error('Unexpected side effect') }
  await assert.rejects(composeVideoWithFallback({ ...shotstackContract(base), format: '16:9', quality: '720p', transitions: 'none',
    clips: [{ url: root + 'black.mp4', durationSeconds: 0.4, type: 'stock' }],
    subtitles: [{ text: 'invisible', start: 0.001, end: 0.002 }], requirements: { subtitles: 'required' } },
  { compose: unexpected, assemble: unexpected, upload: unexpected }), /Sous-titre/)
  assert.equal(calls, 0)
})

test('inherited Object names are not legal brief requirement keys', () => {
  for (const key of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => compositionPlan({ ...shotstackContract(base), requirements: JSON.parse(`{"${key}":"required"}`) }), /inconnue/)
  }
})

test('subtitle glyph size and lower margin stay proportional from 720p to 4K', async () => {
  const srt = join(directory, 'size.srt')
  await writeFile(srt, generateSRT([{ text: 'SUTRA', start: 0, end: 0.4 }]))
  const measurements = []
  for (const [width, height] of [[1280, 720], [3840, 2160]]) {
    const { stdout } = await ffmpeg(['-f', 'lavfi', '-i', `color=black:s=${width}x${height}:r=30:d=0.4`,
      '-vf', buildSubtitlesFilter(srt, width, height) + ',format=gray', '-frames:v', '1', '-threads', '1', '-f', 'rawvideo', '-'])
    let top = height, bottom = -1, left = width, right = -1
    for (let i = 0; i < stdout.length; i++) if (stdout[i] > 180) {
      const y = Math.floor(i / width), x = i % width
      top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x)
    }
    measurements.push({ width, height, glyphHeight: bottom - top + 1, glyphWidth: right - left + 1, margin: height - bottom - 1 })
  }
  evidence.subtitlePixels = measurements
  const [hd, uhd] = measurements
  assert.ok(hd.glyphHeight > 5)
  assert.ok(Math.abs(uhd.glyphHeight / hd.glyphHeight - 3) < 0.4, JSON.stringify(measurements))
  assert.ok(Math.abs(uhd.margin / hd.margin - 3) < 0.4, JSON.stringify(measurements))
  assert.ok(uhd.glyphHeight / uhd.height < 0.07, 'subtitle must not occupy a large part of the 4K frame')
})

for (const format of ['16:9', '9:16', '1:1'] as const) test(`CPU composition ${format}: all required tracks, measured files, corrupt/truncated rejection`, async () => {
  const contract: CompositionContract = { clips: [{ url: root + 'black.mp4', durationSeconds: 0.4 }], format, quality: '720p', transitions: 'none',
    voiceUrl: root + 'voice.wav', musicUrl: root + 'music.wav', watermarkUrl: root + 'logo.png',
    introUrl: root + 'intro.mp4', outroUrl: root + 'outro.mp4', introOutroDurationSeconds: 0.2,
    subtitles: [{ text: 'SUTRA', start: 0.1, end: 0.3 }], requirements: Object.fromEntries(keys.map(k => [k, 'required'])) as CompositionRequirements }
  const result = await composeVideo({ ...contract, format, quality: '720p', transitions: 'none' })
  assert.ok(result.validation)
  const proof = result.validation
  assert.equal(proof.final.fullDecode, true)
  assert.equal(proof.final.video?.orientation, format === '1:1' ? 'square' : format === '9:16' ? 'portrait' : 'landscape')
  assert.equal(proof.final.video?.codec, 'h264')
  assert.equal(proof.final.video?.sar, '1:1')
  assert.equal(proof.final.video?.fps, 30)
  assert.equal(proof.final.audio.length, 1)
  assert.equal(proof.final.audio[0].codec, 'aac')
  assert.ok(Math.abs(proof.final.duration - 0.8) < 0.08)
  assert.equal(proof.resolutionOrigin, 'upscaled')
  assert.throws(() => mediaValidation(contract, { ...proof.final, audio: [] }, proof.sources), /audio requis/)
  assert.throws(() => mediaValidation(contract, { ...proof.final, audio: [{ ...proof.final.audio[0], start: 0.2 }] }, proof.sources), /desynchronisation/)
  for (const [name, data] of [['truncated', result.buffer.subarray(0, result.buffer.length - 300)], ['corrupt', Buffer.from('invalid synthetic mp4')]] as const) {
    const path = join(directory, `${format.replace(':', '-')}-${name}.mp4`)
    await writeFile(path, data)
    await assert.rejects(probeMedia(path), /corrompu/)
  }
  evidence[format] = proof
})

for (const format of ['16:9', '9:16', '1:1'] as const) test(`4K ${format}: measured source/native/enhanced/final with burned subtitle`, async () => {
  const result = await composeVideo({ clips: [{ url: root + 'black.mp4', durationSeconds: 0.2,
    lineage: { nativeUrl: root + 'native.mp4', enhancedUrl: root + 'black.mp4', generation: { kind: 'upscaled', evidence: 'synthetic-only' } } }],
  format, quality: '4k', transitions: 'none', subtitles: [{ text: 'SUTRA', start: 0, end: 0.2 }], requirements: { subtitles: 'required' } })
  const proof = result.validation!
  assert.equal(proof.sources[0].source.video?.width, 320)
  assert.equal(proof.sources[0].native?.video?.width, 160)
  assert.equal(proof.sources[0].enhanced?.video?.width, 320)
  const expected = format === '16:9' ? [3840, 2160] : format === '9:16' ? [2160, 3840] : [2160, 2160]
  assert.deepEqual([proof.requested.width, proof.requested.height], expected)
  assert.deepEqual([proof.final.video?.width, proof.final.video?.height], expected)
  assert.equal(proof.final.fullDecode, true)
  assert.equal(proof.resolutionOrigin, 'upscaled')
  evidence['4k-' + format] = proof
})

test('synthetic native 4K attestation is distinct from dimensions alone', async () => {
  const contract: CompositionContract = { clips: [{ url: root + 'uhd.mp4', durationSeconds: 0.2,
    lineage: { nativeUrl: root + 'uhd.mp4', generation: { kind: 'native', evidence: 'lavfi-only-no-model' } } }],
  format: '16:9', quality: '4k', transitions: 'none', subtitles: [{ text: 'SUTRA', start: 0, end: 0.2 }] }
  const result = await composeVideo({ ...contract, format: '16:9', quality: '4k', transitions: 'none' })
  const proof = result.validation!
  assert.equal(proof.resolutionOrigin, 'native-4k-attested')
  const unknown = mediaValidation(contract, proof.final, proof.sources.map(s => ({ ...s, generation: null })))
  assert.equal(unknown.resolutionOrigin, '4k-origin-unknown')
  evidence.syntheticNative4k = proof
  evidence.withoutGenerationAttestation = unknown.resolutionOrigin
})
