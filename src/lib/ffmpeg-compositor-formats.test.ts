import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http, { type Server } from 'node:http'
import { resolveFfmpegBinary } from './ffmpeg-io'
const ffmpegStaticPath = resolveFfmpegBinary()
import { composeVideo } from './ffmpeg-compositor.ts'
import { getResolution } from './ffmpeg-filters.ts'

const FFMPEG = (ffmpegStaticPath as string) || 'ffmpeg'

function runSync(args: string[]): void {
  const res = spawnSync(FFMPEG, ['-y', '-nostdin', '-loglevel', 'error', ...args])
  if (res.status !== 0) throw new Error(`fixture ffmpeg failed: ${res.stderr?.toString()}`)
}

/**
 * Sonde la resolution reelle + decodabilite d'un buffer video via ffmpeg
 * (pas de ffprobe dans ffmpeg-static). `ffmpeg -i <f>` ecrit toujours le
 * banner des streams sur stderr (meme sans erreur) ; `-f null -` en plus
 * force un decodage complet pour detecter une corruption eventuelle sans
 * repolluer ce meme banner (loglevel par defaut, pas -v error).
 */
async function probeResolution(buffer: Buffer): Promise<{ width: number; height: number; decodable: boolean }> {
  const dir = await mkdtemp(join(tmpdir(), 'sutra-probe-'))
  const path = join(dir, 'probe.mp4')
  await writeFile(path, buffer)
  const stderr = await new Promise<string>((resolve) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-i', path, '-f', 'null', '-'])
    let out = ''
    child.stderr.on('data', (c) => (out += c.toString()))
    child.on('close', () => resolve(out))
  })
  await rm(dir, { recursive: true, force: true }).catch(() => {})
  const match = stderr.match(/Video:.*?(\d{3,5})x(\d{3,5})/)
  return {
    width: match ? Number(match[1]) : 0,
    height: match ? Number(match[2]) : 0,
    decodable: !/error|invalid|corrupt/i.test(stderr),
  }
}

describe('ffmpeg-compositor — matrice formats x qualites (export strict)', () => {
  let fixturesDir: string
  let server: Server
  let baseUrl: string

  before(async () => {
    fixturesDir = await mkdtemp(join(tmpdir(), 'sutra-compose-matrix-'))
    // Source volontairement petite et au mauvais ratio (320x240, 4:3) pour
    // prouver que le compositeur impose bien la resolution/ratio cible et
    // ne se contente jamais de "ce que la source a produit".
    runSync(['-f', 'lavfi', '-i', 'color=c=green:s=320x240:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'src.mp4')])

    server = http.createServer((req, res) => {
      readFile(join(fixturesDir, (req.url ?? '').replace(/^\//, '')))
        .then((buf) => { res.writeHead(200); res.end(buf) })
        .catch(() => { res.writeHead(404); res.end() })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
  })

  const formats: Array<'16:9' | '9:16' | '1:1'> = ['16:9', '9:16', '1:1']
  const qualities: Array<'720p' | '1080p' | '4k'> = ['720p', '1080p', '4k']

  for (const format of formats) {
    for (const quality of qualities) {
      test(`${format} @ ${quality} -> sortie exactement ${getResolution(format, quality)} (export strict, source 320x240 4:3)`, async () => {
        const result = await composeVideo({
          clips: [{ url: `${baseUrl}/src.mp4`, durationSeconds: 1 }],
          format,
          quality,
          timeoutMs: 60_000,
        })
        assert.equal(result.resolution, getResolution(format, quality))
        const probed = await probeResolution(Buffer.from(result.buffer))
        const [expectedW, expectedH] = getResolution(format, quality).split('x').map(Number)
        assert.equal(probed.width, expectedW, `largeur reelle ${probed.width} != attendue ${expectedW}`)
        assert.equal(probed.height, expectedH, `hauteur reelle ${probed.height} != attendue ${expectedH}`)
      })
    }
  }

  test('4K demande == 4K produit, jamais silencieusement degrade vers 1080p/hd (bug Shotstack corrige, verifie ici cote FFmpeg)', async () => {
    const result4k = await composeVideo({ clips: [{ url: `${baseUrl}/src.mp4`, durationSeconds: 1 }], format: '16:9', quality: '4k', timeoutMs: 60_000 })
    const result1080 = await composeVideo({ clips: [{ url: `${baseUrl}/src.mp4`, durationSeconds: 1 }], format: '16:9', quality: '1080p', timeoutMs: 60_000 })
    assert.equal(result4k.resolution, '3840x2160')
    assert.equal(result4k.validation?.resolutionOrigin, 'upscaled')
    assert.equal(result4k.validation?.sources[0].native, null)
    assert.equal(result4k.validation?.sources[0].source.video?.width, 320)
    assert.equal(result1080.resolution, '1920x1080')
    assert.notEqual(result4k.resolution, result1080.resolution)
  })
})

describe('ffmpeg-compositor — pipeline complet realiste (multi-scenes + voix + musique + watermark + intro/outro + sous-titres)', () => {
  let fixturesDir: string
  let server: Server
  let baseUrl: string

  before(async () => {
    fixturesDir = await mkdtemp(join(tmpdir(), 'sutra-compose-e2e-'))
    runSync(['-f', 'lavfi', '-i', 'color=c=red:s=640x480:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'scene0.mp4')])
    runSync(['-f', 'lavfi', '-i', 'color=c=blue:s=640x480:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'scene1.mp4')])
    runSync(['-f', 'lavfi', '-i', 'color=c=yellow:s=640x480:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'scene2.mp4')])
    runSync(['-f', 'lavfi', '-i', 'color=c=white:s=640x480:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'intro.mp4')])
    runSync(['-f', 'lavfi', '-i', 'color=c=black:s=640x480:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(fixturesDir, 'outro.mp4')])
    runSync(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=9', '-c:a', 'libmp3lame', join(fixturesDir, 'voice.mp3')])
    runSync(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=20', '-c:a', 'libmp3lame', join(fixturesDir, 'music.mp3')])
    runSync(['-f', 'lavfi', '-i', 'color=c=white@0.9:s=96x96', '-frames:v', '1', join(fixturesDir, 'logo.png')])

    server = http.createServer((req, res) => {
      readFile(join(fixturesDir, (req.url ?? '').replace(/^\//, '')))
        .then((buf) => { res.writeHead(200); res.end(buf) })
        .catch(() => { res.writeHead(404); res.end() })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
  })

  for (const format of ['16:9', '9:16', '1:1'] as const) {
    test(`simule un /api/create complet en ${format} : 3 scenes (durees reelles distinctes) + intro/outro + voix + musique + watermark + sous-titres`, async () => {
      const result = await composeVideo({
        clips: [
          { url: `${baseUrl}/scene0.mp4`, durationSeconds: 3 },
          { url: `${baseUrl}/scene1.mp4`, durationSeconds: 2 },
          { url: `${baseUrl}/scene2.mp4`, durationSeconds: 4 },
        ],
        introUrl: `${baseUrl}/intro.mp4`,
        outroUrl: `${baseUrl}/outro.mp4`,
        introOutroDurationSeconds: 2,
        voiceUrl: `${baseUrl}/voice.mp3`,
        musicUrl: `${baseUrl}/music.mp3`,
        musicVolume: 0.3,
        watermarkUrl: `${baseUrl}/logo.png`,
        subtitles: [
          { text: 'Scene un', start: 0, end: 2 },
          { text: 'Scene deux', start: 3, end: 4.5 },
          { text: 'Scene trois', start: 5, end: 8 },
        ],
        transitions: 'fade',
        format,
        quality: '1080p',
        timeoutMs: 90_000,
      })

      // 2 (intro) + 3 + 2 + 4 (scenes) + 2 (outro) = 13s — pas 9s (voix) ni 20s (musique).
      assert.equal(result.durationSeconds, 13)
      assert.equal(result.resolution, getResolution(format, '1080p'))
      const probed = await probeResolution(Buffer.from(result.buffer))
      assert.equal(probed.decodable, true)
      const [expectedW, expectedH] = getResolution(format, '1080p').split('x').map(Number)
      assert.equal(probed.width, expectedW)
      assert.equal(probed.height, expectedH)
    })
  }
})
