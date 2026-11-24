// CPU-only fixtures and independent byte-level measurements. No live transport.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import https from 'node:https'
import type { PassThrough } from 'node:stream'
import { mock } from 'node:test'
import { closeNetwork, mediaTransport } from '../t05-salad-media-20261014/fixtures.mts'
import type { VideoCompositionJob } from '../../src/lib/video-compositor.ts'

const exec = promisify(execFile)
export const directory = resolve('qa/t05-real-export-20261014')
export const exportsDir = join(directory, 'exports')
export const fixturesDir = join(directory, 'fixtures')
export const root = 'https://media.invalid/'
export const keys = ['voice', 'music', 'subtitles', 'logo', 'intro', 'outro'] as const
export type Feature = typeof keys[number]
export const bytes: Record<string, Buffer> = {}
export const ffmpeg = (args: string[]) => exec('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-threads', '1', ...args],
  { timeout: 60000, maxBuffer: 48 * 1024 * 1024, encoding: 'buffer' })

export async function makeFixtures() {
  await mkdir(exportsDir, { recursive: true })
  await mkdir(fixturesDir, { recursive: true })
  const encode = ['-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  for (const [name, color, size, duration] of [
    ['native', 'black', '160x90', 1.2], ['intro', 'red', '320x180', 0.2],
    ['outro', 'blue', '320x180', 0.2], ['native-4k', 'black', '3840x2160', 0.2],
  ]) await ffmpeg(['-f', 'lavfi', '-i', `color=${color}:s=${size}:r=30:d=${duration}`, ...encode, join(fixturesDir, name + '.mp4')])
  // Enhanced source really is scaled from the measured native fixture.
  await ffmpeg(['-i', join(fixturesDir, 'native.mp4'), '-vf', 'scale=320:180', '-filter_threads', '1', ...encode, join(fixturesDir, 'source.mp4')])
  for (const [name, frequency] of [['voice', 440], ['music', 880]]) {
    await ffmpeg(['-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=0.8`, join(fixturesDir, name + '.wav')])
  }
  await ffmpeg(['-f', 'lavfi', '-i', 'color=white:s=32x32', '-frames:v', '1', join(fixturesDir, 'logo.png')])
  for (const name of ['native.mp4', 'source.mp4', 'intro.mp4', 'outro.mp4', 'native-4k.mp4', 'voice.wav', 'music.wav', 'logo.png']) {
    bytes[name] = await readFile(join(fixturesDir, name))
  }
  bytes['invalid.mp4'] = Buffer.from('synthetic invalid media, no provider content')
  bytes['truncated.mp4'] = bytes['source.mp4'].subarray(0, bytes['source.mp4'].length - 300)
  const packets = JSON.parse((await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_packets', '-of', 'json', join(fixturesDir, 'source.mp4')])).stdout).packets
  const last = packets.at(-1) as { pos: string; size: string }
  bytes['corrupt-tail.mp4'] = Buffer.from(bytes['source.mp4'])
  bytes['corrupt-tail.mp4'].fill(255, Number(last.pos), Number(last.pos) + Number(last.size))
  for (const name of ['invalid.mp4', 'truncated.mp4', 'corrupt-tail.mp4']) await writeFile(join(fixturesDir, name), bytes[name])
  return { ffmpeg: (await exec('ffmpeg', ['-version'])).stdout.split('\n')[0],
    ffprobe: (await exec('ffprobe', ['-version'])).stdout.split('\n')[0], encoder: 'libx264 CPU only' }
}

export function transport() {
  closeNetwork()
  const requests = mediaTransport({ ...Object.fromEntries(Object.entries(bytes).map(([name, data]) => [root + name, { bytes: data }])),
    [root + 'expired.mp4']: { status: 403 } })
  const request = https.request
  mock.method(https, 'request', (url: URL, options: Parameters<typeof request>[1], callback: (stream: PassThrough & { headers: Record<string, string> }) => void) =>
    request(url, options, stream => {
      stream.headers['content-type'] = url.pathname.endsWith('.png') ? 'image/png' : url.pathname.endsWith('.wav') ? 'audio/wav' : 'video/mp4'
      callback(stream as unknown as PassThrough & { headers: Record<string, string> })
    }))
  return requests
}

export function job(format: VideoCompositionJob['format'], features: readonly Feature[] = [], optional = false): VideoCompositionJob {
  const has = (key: Feature) => features.includes(key)
  return { clips: [{ url: root + 'source.mp4', type: 'stock', durationSeconds: 1.2,
    lineage: { nativeUrl: root + 'native.mp4', enhancedUrl: root + 'source.mp4', generation: { kind: 'upscaled', evidence: 'lavfi-native-then-CPU-scale-only' } } }],
  format, quality: '720p', transitions: 'none', introOutroDurationSeconds: 0.2,
  voiceUrl: has('voice') ? root + 'voice.wav' : null, musicUrl: has('music') ? root + 'music.wav' : null,
  voiceVolume: 1, musicVolume: 0.4, watermarkUrl: has('logo') ? root + 'logo.png' : null,
  introUrl: has('intro') ? root + 'intro.mp4' : null, outroUrl: has('outro') ? root + 'outro.mp4' : null,
  subtitles: has('subtitles') ? [{ text: 'SUTRA', start: 0.2, end: 0.7 }] : [],
  requirements: Object.fromEntries(keys.map(key => [key, optional ? 'optional' : has(key) ? 'required' : 'disabled'])) }
}

function amplitude(pcm: Buffer, start: number, end: number, frequency: number) {
  const rate = 12000, from = Math.round(start * rate), to = Math.min(pcm.length / 4, Math.round(end * rate))
  let sin = 0, cos = 0, sum = 0
  for (let index = from; index < to; index++) {
    const sample = pcm.readFloatLE(index * 4), phase = 2 * Math.PI * frequency * index / rate
    sin += sample * Math.sin(phase); cos += sample * Math.cos(phase); sum += sample * sample
  }
  return { amplitude: 2 * Math.hypot(sin, cos) / (to - from), rms: Math.sqrt(sum / (to - from)) }
}

export async function measureAudio(path: string, features: readonly Feature[]) {
  const { stdout } = await ffmpeg(['-i', path, '-map', '0:a:0', '-ac', '1', '-ar', '12000', '-f', 'f32le', '-'])
  const intro = features.includes('intro') ? 0.2 : 0
  const windows = { early: [0.04, 0.14], body: [intro + 0.3, intro + 0.5], afterVoice: [intro + 1.0, intro + 1.1] }
  const measured = Object.fromEntries(Object.entries(windows).map(([name, [start, end]]) => [name, {
    start, end, voice440: amplitude(stdout, start, end, 440), music880: amplitude(stdout, start, end, 880),
  }]))
  const has = (key: Feature) => features.includes(key)
  for (const [key, tone] of [['voice', 'voice440'], ['music', 'music880']] as const) {
    const value = measured.body[tone].amplitude
    assert.ok(has(key) ? value > 0.005 : value < 0.001, `${key} expected=${has(key)} amplitude=${value}`)
  }
  assert.ok(measured.afterVoice.voice440.amplitude < 0.001, 'voice must stop after its supplied duration')
  if (has('intro')) assert.ok(measured.early.voice440.amplitude < 0.001, 'voice must wait until body starts')
  if (!has('voice') && !has('music')) assert.ok(measured.body.voice440.rms < 0.00001, 'video-only must have silent audio')
  return measured
}

export async function frame(path: string, time: number, width: number, height: number) {
  const { stdout } = await ffmpeg(['-ss', String(time), '-i', path, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
  assert.equal(stdout.length, width * height * 3)
  const pixel = (x: number, y: number) => Array.from(stdout.subarray((Math.floor(y) * width + Math.floor(x)) * 3, (Math.floor(y) * width + Math.floor(x)) * 3 + 3))
  let subtitleWhitePixels = 0
  for (let y = Math.floor(height * 0.65); y < height * 0.97; y++) for (let x = Math.floor(width * 0.15); x < width * 0.75; x++) {
    const offset = (y * width + x) * 3
    if (stdout[offset] > 180 && stdout[offset + 1] > 180 && stdout[offset + 2] > 180) subtitleWhitePixels++
  }
  return { center: pixel(width / 2, height / 2), logo: pixel(width - 24 - width * 0.06, height - 24 - width * 0.06), subtitleWhitePixels }
}

export async function measurePixels(path: string, width: number, height: number, features: readonly Feature[]) {
  const has = (key: Feature) => features.includes(key), intro = has('intro') ? 0.2 : 0
  const body = await frame(path, intro + 0.4, width, height)
  assert.ok(body.center.every(c => c < 8), 'body must be black')
  assert.ok(has('logo') ? body.logo.every(c => c > 160) : body.logo.every(c => c < 8), 'logo presence must agree with brief')
  assert.ok(has('subtitles') ? body.subtitleWhitePixels > 50 : body.subtitleWhitePixels === 0, 'subtitle pixels must agree with brief')
  const boundary: Record<string, unknown> = {}
  if (has('subtitles')) for (const time of [intro + 0.1, intro + 0.9]) {
    const measurement = await frame(path, time, width, height)
    assert.equal(measurement.subtitleWhitePixels, 0, 'subtitle must stay within cue clock')
    boundary[String(time)] = measurement
  }
  for (const [key, time, channel] of [['intro', 0.1, 0], ['outro', intro + 1.3, 2]] as const) if (has(key)) {
    const measurement = await frame(path, time, width, height)
    assert.ok(measurement.center[channel] > 220 && measurement.center[(channel + 1) % 3] < 15, `${key} color must be rendered`)
    boundary[key] = measurement
  }
  return { body, boundary }
}
