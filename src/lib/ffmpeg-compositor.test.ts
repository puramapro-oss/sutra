import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http, { type Server } from 'node:http'
import { resolveFfmpegBinary } from './ffmpeg-io'
const ffmpegStaticPath = resolveFfmpegBinary()
import { composeVideo, FfmpegCompositorError, isCancelledError } from './ffmpeg-compositor.ts'
import { compositionHash } from './media-validation.ts'
import { getFfmpegConcurrencyState } from './ffmpeg-concurrency.ts'

const FFMPEG = (ffmpegStaticPath as string) || 'ffmpeg'

function runSync(args: string[]): void {
  const res = spawnSync(FFMPEG, ['-y', '-nostdin', '-loglevel', 'error', ...args])
  if (res.status !== 0) {
    throw new Error(`fixture ffmpeg failed: ${res.stderr?.toString()}`)
  }
}

describe('ffmpeg-compositor', () => {
  let fixturesDir: string
  let server: Server
  let baseUrl: string

  before(async () => {
    fixturesDir = await mkdtemp(join(tmpdir(), 'sutra-compose-fixtures-'))

    // 2 clips synthetiques (couleur + ton), 2s chacun
    runSync([
      '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-c:a', 'aac', '-pix_fmt', 'yuv420p',
      join(fixturesDir, 'clip0.mp4'),
    ])
    runSync([
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      join(fixturesDir, 'clip1.mp4'),
    ])
    // voix (3s) + musique (6s)
    runSync(['-f', 'lavfi', '-i', 'sine=frequency=300:duration=3', '-c:a', 'libmp3lame', join(fixturesDir, 'voice.mp3')])
    runSync(['-f', 'lavfi', '-i', 'sine=frequency=150:duration=6', '-c:a', 'libmp3lame', join(fixturesDir, 'music.mp3')])
    // watermark PNG avec alpha
    runSync(['-f', 'lavfi', '-i', 'color=c=white@0.8:s=64x64', '-frames:v', '1', join(fixturesDir, 'watermark.png')])

    server = http.createServer((req, res) => {
      const file = join(fixturesDir, (req.url ?? '').replace(/^\//, ''))
      readFile(file)
        .then((buf) => {
          res.writeHead(200)
          res.end(buf)
        })
        .catch(() => {
          res.writeHead(404)
          res.end()
        })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(fixturesDir, { recursive: true, force: true }).catch(() => {})
  })

  async function assertDecodable(buffer: Buffer): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'sutra-compose-check-'))
    const path = join(dir, 'out.mp4')
    await writeFile(path, buffer)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(FFMPEG, ['-v', 'error', '-i', path, '-f', 'null', '-'])
      let stderr = ''
      child.stderr.on('data', (c) => (stderr += c.toString()))
      child.on('close', (code) => {
        if (code !== 0 || stderr.trim().length > 0) {
          reject(new Error(`sortie non decodable: ${stderr}`))
        } else {
          resolve()
        }
      })
    })
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  test('assemble 2 clips + voix + musique + watermark + sous-titres -> mp4 valide, duree exacte', async () => {
    const result = await composeVideo({
      clips: [
        { url: `${baseUrl}/clip0.mp4`, durationSeconds: 2 },
        { url: `${baseUrl}/clip1.mp4`, durationSeconds: 2 },
      ],
      voiceUrl: `${baseUrl}/voice.mp3`,
      musicUrl: `${baseUrl}/music.mp3`,
      watermarkUrl: `${baseUrl}/watermark.png`,
      subtitles: [{ text: 'Bonjour le monde', start: 0, end: 1.5 }],
      format: '16:9',
      quality: '720p',
      timeoutMs: 60_000,
    })

    assert.equal(result.resolution, '1280x720')
    assert.equal(result.durationSeconds, 4)
    assert.ok(result.buffer.length > 1000, 'buffer final trop petit')
    await assertDecodable(result.buffer)
  })

  test('fonctionne sans aucun audio (silence genere)', async () => {
    const result = await composeVideo({
      clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 2 }],
      format: '1:1',
      quality: '720p',
      timeoutMs: 60_000,
    })
    assert.equal(result.resolution, '720x720')
    assert.equal(result.durationSeconds, 2)
    await assertDecodable(result.buffer)
  })

  test('intro + outro rallongent la duree totale', async () => {
    const result = await composeVideo({
      clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 2 }],
      introUrl: `${baseUrl}/clip1.mp4`,
      outroUrl: `${baseUrl}/clip1.mp4`,
      introOutroDurationSeconds: 1,
      format: '16:9',
      quality: '720p',
      timeoutMs: 60_000,
    })
    assert.equal(result.durationSeconds, 4) // 1 intro + 2 scene + 1 outro
  })

  test('rejette un job sans clip', async () => {
    await assert.rejects(
      () => composeVideo({ clips: [], format: '16:9', quality: '1080p' }),
      FfmpegCompositorError
    )
  })

  test('rejette un clip de duree nulle ou negative avant tout telechargement', async () => {
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 0 }],
          format: '16:9',
          quality: '1080p',
        }),
      FfmpegCompositorError
    )
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: -3 }],
          format: '16:9',
          quality: '1080p',
        }),
      FfmpegCompositorError
    )
  })

  test('rejette une duree totale au-dela du plafond de la qualite demandee (garde-fou CPU/RAM)', async () => {
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 200 }],
          format: '16:9',
          quality: '4k',
        }),
      FfmpegCompositorError
    )
  })

  test('libere toujours le slot de concurrence meme si le pipeline echoue apres l acquisition (ex: asset introuvable)', async () => {
    const before = getFfmpegConcurrencyState().active
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/n-existe-pas.mp4`, durationSeconds: 1 }],
          format: '16:9',
          quality: '720p',
          timeoutMs: 15_000,
        }),
      FfmpegCompositorError
    )
    assert.equal(getFfmpegConcurrencyState().active, before, 'le slot doit etre libere meme en cas d echec en cours de pipeline')
  })

  test('maxDurationSeconds permet de surcharger explicitement le plafond par defaut', async () => {
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 50 }],
          format: '16:9',
          quality: '4k',
          maxDurationSeconds: 10,
        }),
      FfmpegCompositorError
    )
  })

  test('un signal deja annule rejette immediatement avec step=cancelled, jamais de secours declenche par l appelant', async () => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(
      () =>
        composeVideo({
          clips: [{ url: `${baseUrl}/clip0.mp4`, durationSeconds: 2 }],
          format: '16:9',
          quality: '720p',
          signal: controller.signal,
        }),
      (err: unknown) => {
        assert.ok(isCancelledError(err), 'doit etre identifie comme une annulation, pas une panne moteur')
        return true
      }
    )
  })

  test('reprise identique reutilise les etapes completes; un brief modifie ne reutilise rien', async () => {
    const jobId = `resume-t05-${Date.now()}`
    const params = {
      jobId, clips: [
        { url: `${baseUrl}/clip0.mp4`, durationSeconds: 2 },
        { url: `${baseUrl}/retry-clip.mp4`, durationSeconds: 2 },
      ], format: '16:9' as const, quality: '720p' as const, timeoutMs: 30000,
    }
    const dir = join(tmpdir(), `sutra-compose-${jobId}-${compositionHash(params).slice(0, 16)}`)
    const original = await readFile(join(fixturesDir, 'clip0.mp4'))
    try {
      await assert.rejects(() => composeVideo(params))
      assert.ok((await stat(join(dir, 'src-clip-0.mp4.complete'))).size > 0)
      await writeFile(join(fixturesDir, 'retry-clip.mp4'), await readFile(join(fixturesDir, 'clip1.mp4')))
      await rm(join(fixturesDir, 'clip0.mp4'))
      const changed = { ...params, transitions: 'none' as const }
      assert.notEqual(compositionHash(changed), compositionHash(params))
      await assert.rejects(() => composeVideo(changed), /Telechargement media refuse/)
      const result = await composeVideo(params)
      assert.equal(result.durationSeconds, 4)
      await assertDecodable(result.buffer)
      await assert.rejects(() => stat(dir))
      await rm(join(tmpdir(), `sutra-compose-${jobId}-${compositionHash(changed).slice(0, 16)}`), { recursive: true, force: true })
    } finally {
      await writeFile(join(fixturesDir, 'clip0.mp4'), original)
      await rm(dir, { recursive: true, force: true })
    }
  })
})
