import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { resolveFfmpegBinary } from './ffmpeg-io.ts'
import { composeVideo, type ComposeVideoParams } from './ffmpeg-compositor.ts'
import { compositionPlan } from './composition-contract.ts'
import { assertFinalMedia, mediaValidation, validateRenderedMedia } from './media-validation.ts'
import { probeMedia, mediaCommand } from './media-inspection.ts'
import { generateSRT } from './ffmpeg-filters.ts'

let dir: string, base: string, server: Server
function ffmpeg(args: string[]) {
  const r = spawnSync(resolveFfmpegBinary(), ['-y', '-nostdin', '-v', 'error', ...args], { maxBuffer: 16 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr?.toString())
  return r.stdout
}
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sutra-t05-synthetic-'))
  for (const [name, size, color] of [['black', '320x180', 'black'], ['native', '160x90', 'black'], ['sar', '320x240', 'red'], ['uhd', '3840x2160', 'black']]) {
    ffmpeg(['-f', 'lavfi', '-i', `color=c=${color}:s=${size}:r=30:d=1`, '-vf', name === 'sar' ? 'setsar=2/1' : 'setsar=1',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(dir, `${name}.mp4`)])
  }
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.8', join(dir, 'voice.wav')])
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=120:duration=0.2', join(dir, 'music.wav')])
  ffmpeg(['-f', 'lavfi', '-i', 'color=white:s=32x32', '-frames:v', '1', join(dir, 'logo.png')])
  server = createServer((req, res) => {
    readFile(join(dir, (req.url ?? '').slice(1))).then(data => res.end(data), () => { res.statusCode = 404; res.end() })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }) })
const contract = (): ComposeVideoParams => ({ clips: [{ url: `${base}/black.mp4`, durationSeconds: 1 }], format: '1:1', quality: '720p', transitions: 'none' })

test('brief : voix/musique facultatives, obligatoires, desactivees; durees et sous-titres invalides', () => {
  assert.equal(compositionPlan(contract()).audioRequired, false)
  for (const key of ['voice', 'music', 'intro', 'outro', 'logo', 'subtitles']) {
    assert.throws(() => compositionPlan({ ...contract(), requirements: { [key]: 'required' } }), /obligatoire/)
  }
  assert.throws(() => compositionPlan({ ...contract(), requirements: { voice: 'disabled' }, voiceUrl: 'voice' }), /desactive/)
  assert.throws(() => compositionPlan({ ...contract(), requirements: { music: 'required' }, musicUrl: 'music', musicVolume: 0 }), /obligatoire/)
  for (const duration of [NaN, Infinity, 0, -1]) assert.throws(() => compositionPlan({ ...contract(), clips: [{ url: 'x', durationSeconds: duration }] }), /Duree/)
  for (const sub of [{ start: -1, end: 1 }, { start: 0, end: 2 }, { start: 0, end: NaN }, { start: 1, end: 1 }]) {
    assert.throws(() => compositionPlan({ ...contract(), subtitles: [{ ...sub, text: 'synthetic' }] }), /Sous-titres/)
  }
  assert.match(generateSRT([{ text: 'carry', start: 59.9999, end: 60.5 }]), /00:01:00,000/)
})

test('rendu : voix decalee, intro/outro silencieuses, logo visible et sous-titre seulement dans sa fenetre', async () => {
  const result = await composeVideo({ ...contract(), format: '1:1', quality: '720p', transitions: 'none',
    introUrl: `${base}/black.mp4`, outroUrl: `${base}/black.mp4`, introOutroDurationSeconds: 0.5,
    voiceUrl: `${base}/voice.wav`, watermarkUrl: `${base}/logo.png`,
    subtitles: [{ text: 'SYNTHETIQUE T05', start: 0.2, end: 0.6 }],
    requirements: { voice: 'required', music: 'optional', subtitles: 'required', intro: 'required', outro: 'required', logo: 'required' } })
  const path = join(dir, 'timing.mp4'); await writeFile(path, result.buffer)
  assert.equal(result.validation?.final.fullDecode, true)
  assert.deepEqual(result.validation?.subtitles.cues.map(s => [s.start, s.end]), [[0.7, 1.1]])
  const pcm = ffmpeg(['-i', path, '-vn', '-ar', '8000', '-ac', '1', '-f', 'f32le', '-'])
  const rms = (start: number, end: number) => {
    let sum = 0, n = 0
    for (let i = Math.floor(start * 8000); i < end * 8000; i++) { sum += pcm.readFloatLE(i * 4) ** 2; n++ }
    return Math.sqrt(sum / n)
  }
  assert.ok(rms(0.1, 0.4) < 0.001, 'intro silencieuse')
  assert.ok(rms(0.6, 0.9) > 0.02, 'voix presente apres intro')
  assert.ok(rms(1.6, 1.9) < 0.001, 'outro silencieuse')
  const pixels = (time: number, crop: string) => ffmpeg(['-ss', String(time), '-i', path, '-frames:v', '1', '-vf', `${crop},format=gray`, '-f', 'rawvideo', '-'])
  const white = (buffer: Buffer) => [...buffer].filter(x => x > 100).length
  const subtitleRegion = 'crop=460:360:80:360'
  assert.equal(white(pixels(0.3, subtitleRegion)), 0)
  assert.ok(white(pixels(0.85, subtitleRegion)) > 100, 'pixels du sous-titre visibles')
  assert.equal(white(pixels(1.4, subtitleRegion)), 0)
  for (const t of [0.3, 0.85, 1.8]) assert.ok(white(pixels(t, 'crop=80:80:610:610')) > 3000, 'logo visible pendant intro/corps/outro')
})

test('musique courte boucle jusqu a la fin; voix trop longue refusee', async () => {
  const result = await composeVideo({ ...contract(), format: '1:1', quality: '720p', musicUrl: `${base}/music.wav`, requirements: { music: 'required' } })
  const path = join(dir, 'music-final.mp4'); await writeFile(path, result.buffer)
  const pcm = ffmpeg(['-ss', '0.75', '-i', path, '-t', '0.1', '-vn', '-ar', '8000', '-ac', '1', '-f', 'f32le', '-'])
  let power = 0
  for (let i = 0; i < pcm.length; i += 4) power += pcm.readFloatLE(i) ** 2
  assert.ok(Math.sqrt(power / (pcm.length / 4)) > 0.005)
  await assert.rejects(() => composeVideo({ ...contract(), format: '1:1', quality: '720p', clips: [{ url: `${base}/black.mp4`, durationSeconds: 0.2 }], voiceUrl: `${base}/voice.wav` }), /Voix/)
})

test('pixels carres ET conservation du ratio affiche d une source anamorphique', async () => {
  const result = await composeVideo({ clips: [{ url: `${base}/sar.mp4`, durationSeconds: 0.2 }], format: '1:1', quality: '720p', transitions: 'none' })
  assert.equal(result.validation?.sources[0].source.video?.sar, '2:1')
  assert.equal(result.validation?.final.video?.sar, '1:1')
  const path = join(dir, 'sar-final.mp4'); await writeFile(path, result.buffer)
  const raw = ffmpeg(['-i', path, '-frames:v', '1', '-vf', 'format=gray', '-f', 'rawvideo', '-'])
  assert.ok(raw[190 * 720 + 360] < 5, 'bande noire preserve le DAR 8:3')
  assert.ok(raw[250 * 720 + 360] > 30, 'image visible dans le bon rectangle')
})

test('logo texte : ponctuation et expressions percent restent litterales', async () => {
  const result = await composeVideo({ ...contract(), format: '1:1', quality: '720p', transitions: 'none',
    watermarkText: "SUTRA: l'export 100% %{pts}", requirements: { logo: 'required' } })
  const path = join(dir, 'text-logo.mp4'); await writeFile(path, result.buffer)
  const pixels = ffmpeg(['-i', path, '-frames:v', '1', '-vf', 'crop=720:100:0:620,format=gray', '-f', 'rawvideo', '-'])
  assert.ok([...pixels].filter(p => p > 100).length > 100)
})

test('mesures source/native/amelioree et 4K native attestee distinctes de l upscale', async () => {
  const result = await composeVideo({ clips: [{ url: `${base}/black.mp4`, durationSeconds: 0.2,
    lineage: { nativeUrl: `${base}/native.mp4`, enhancedUrl: `${base}/black.mp4`, generation: { kind: 'upscaled', evidence: 'synthetic-test-only' } } }], format: '16:9', quality: '4k' })
  assert.equal(result.validation?.sources[0].source.video?.width, 320)
  assert.equal(result.validation?.sources[0].native?.video?.width, 160)
  assert.equal(result.validation?.sources[0].enhanced?.video?.width, 320)
  assert.equal(result.validation?.requested.width, 3840)
  assert.equal(result.validation?.final.video?.width, 3840)
  assert.equal(result.validation?.resolutionOrigin, 'upscaled')
  const native = await composeVideo({ clips: [{ url: `${base}/uhd.mp4`, durationSeconds: 0.2,
    lineage: { nativeUrl: `${base}/uhd.mp4`, generation: { kind: 'native', evidence: 'lavfi-synthetic-native' } } }], format: '16:9', quality: '4k' })
  assert.equal(native.validation?.resolutionOrigin, 'native-4k-attested')
  const unknown = structuredClone(native.validation!)
  unknown.sources[0].generation = null
  assert.equal(mediaValidation({ clips: [{ url: 'synthetic', durationSeconds: 0.2 }], format: '16:9', quality: '4k' }, unknown.final, unknown.sources).resolutionOrigin, '4k-origin-unknown')
})

test('final : corruption, troncature et reponse HTML refusees; controles metadonnees sans faux vert', async () => {
  const result = await composeVideo({ ...contract(), format: '1:1', quality: '720p' })
  const valid = result.validation!.final
  const mutate = (fn: (m: typeof valid) => void) => { const copy = structuredClone(valid); fn(copy); assert.throws(() => assertFinalMedia(copy, contract()), /refuse/) }
  mutate(m => { m.video!.width = 1280 }); mutate(m => { m.video!.rotation = 90 })
  mutate(m => { m.video!.fps = 25 }); mutate(m => { m.video!.nominalFps = 60 })
  mutate(m => { m.video!.codec = 'hevc' }); mutate(m => { m.video!.sar = '2:1' })
  mutate(m => { m.bitrate = 0 }); mutate(m => { m.video!.frames = 1 })
  mutate(m => { m.duration = 0.3 }); mutate(m => { m.audio[0].start = 0.5 })
  mutate(m => { m.video!.duration = NaN }); mutate(m => { m.video!.start = NaN })
  mutate(m => { m.audio[0].duration = 0.2 }); mutate(m => { m.subtitleStreams = 1 })
  assert.throws(() => assertFinalMedia({ ...valid, audio: [] }, { ...contract(), voiceUrl: 'required' }), /audio requis/)
  for (const [name, buffer] of [['truncated', result.buffer.subarray(0, Math.floor(result.buffer.length * 0.8))], ['html', Buffer.from('<html>503</html>')]] as const) {
    const path = join(dir, `${name}.mp4`); await writeFile(path, buffer)
    await assert.rejects(() => probeMedia(path), /corrompu/)
  }
  await assert.rejects(() => validateRenderedMedia(`${base}/black.mp4`, contract()), /brute/)
  await assert.rejects(() => mediaCommand('ffprobe', ['-version'], 1000, AbortSignal.abort()), /annulee/)
})
