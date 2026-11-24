// Synthetic CPU fixtures and closed transports. No provider, credential or GPU.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import dns from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import { mock } from 'node:test'
import type { MediaProbe } from '../../src/lib/media-inspection.ts'

const exec = promisify(execFile)
export const seconds = 0.4
export const urls = {
  worker: 'https://worker.invalid/generate', source: 'https://media.invalid/source.mp4',
  native: 'https://media.invalid/native.mp4', enhanced: 'https://media.invalid/enhanced.mp4',
  final: 'https://media.invalid/final.mp4', voice: 'https://media.invalid/voice.mp4',
}
export type Fixture = { path: string; bytes: Buffer; probe: MediaProbe }
export type Fixtures = Awaited<ReturnType<typeof makeFixtures>>

export async function makeFixtures() {
  const { probeMedia } = await import('../../src/lib/media-inspection.ts')
  const directory = await mkdtemp(join(tmpdir(), 'sutra-t05-salad-'))
  const files: Record<string, Fixture> = {}
  const render = async (name: string, inputs: string[], filters: string[] = [], audio = false) => {
    const path = join(directory, `${name}.mp4`)
    await exec('ffmpeg', ['-v', 'error', '-nostdin', ...inputs, ...filters,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p',
      ...(audio ? ['-c:a', 'aac', '-ar', '48000', '-ac', '1'] : ['-an']),
      '-t', String(seconds), '-movflags', '+faststart', path], { timeout: 30_000 })
    files[name] = { path, bytes: await readFile(path), probe: await probeMedia(path) }
  }
  try {
    const color = (size: string, fps = 30) => ['-f', 'lavfi', '-i', `color=blue:s=${size}:r=${fps}:d=${seconds}`]
    await render('native', color('640x360'))
    await render('source', color('1280x720'))
    await render('final', [...color('1280x720'), '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`], [], true)
    await render('native4k', color('3840x2160'))
    await render('enhanced', ['-i', files.source.path], ['-vf', 'scale=3840:2160', '-filter_threads', '1'])
    await render('portrait', color('720x1280'))
    await render('fps16', color('1280x720', 16))
    await render('sar2', color('1280x720'), ['-vf', 'setsar=2'])
    await render('offset', [...color('1280x720'), '-itsoffset', '0.2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2'], [], true)
    // Keep a valid moov/header and earlier frames; destroy only the last video packet.
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_packets', '-of', 'json', files.source.path])
    const packets = JSON.parse(stdout).packets as Array<{ pos: string; size: string }>
    const last = packets.at(-1)!
    const corrupt = Buffer.from(files.source.bytes)
    corrupt.fill(255, Number(last.pos), Number(last.pos) + Number(last.size))
    const corruptPath = join(directory, 'corrupt-tail.mp4')
    await writeFile(corruptPath, corrupt)
    const metadata = await exec('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', corruptPath])
    assert.equal(JSON.parse(metadata.stdout).streams[0].width, 1280, 'corrupt fixture must retain readable dimensions')
    return { directory, files, corrupt, corruptPath,
      corruptSha256: createHash('sha256').update(corrupt).digest('hex'),
      ffmpeg: (await exec('ffmpeg', ['-version'])).stdout.split('\n')[0],
      ffprobe: (await exec('ffprobe', ['-version'])).stdout.split('\n')[0] }
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
}

export function closeNetwork() {
  const blocked = () => { throw new Error('T05_UNEXPECTED_NETWORK') }
  globalThis.fetch = async () => blocked()
  mock.method(http, 'request', blocked)
  mock.method(http, 'get', blocked)
  mock.method(https, 'request', blocked)
  mock.method(https, 'get', blocked)
  mock.method(dns, 'lookup', blocked)
}

export type Reply = { bytes?: Buffer; status?: number }
export function mediaTransport(replies: Record<string, Reply>) {
  const requested: string[] = []
  mock.method(dns, 'lookup', async (host: string) => {
    assert.equal(host, 'media.invalid')
    return [{ address: '93.184.216.34', family: 4 }]
  })
  mock.method(https, 'request', (url: URL, options: { method: string; headers: Record<string, string> }, callback: (stream: PassThrough) => void) => {
    assert.equal(options.method, 'GET')
    assert.equal(options.headers.Authorization, undefined)
    assert.ok(Object.hasOwn(replies, url.href), 'unexpected media URL')
    requested.push(url.href)
    const reply = replies[url.href]
    const request = new EventEmitter() as EventEmitter & { end(): void }
    request.end = () => queueMicrotask(() => {
      const stream = Object.assign(new PassThrough(), { statusCode: reply.status ?? 200,
        headers: { 'content-type': 'video/mp4', 'content-length': String(reply.bytes?.length ?? 0) } })
      callback(stream)
      stream.end(reply.bytes)
    })
    return request
  })
  return requested
}

export function workerTransport(reply: Record<string, unknown>, file?: Reply) {
  const requests: string[] = []
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    requests.push(target)
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal)
    if (target === urls.worker) {
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init.body)), { prompt: 'synthetic fixture', width: 1280, height: 720, num_frames: 12, fps: 30 })
      return Response.json(reply)
    }
    assert.equal(target, 'https://worker.invalid/result.mp4?expires=synthetic')
    assert.ok(file, 'unexpected worker request')
    return new Response(file.bytes ? new Uint8Array(file.bytes) : null, { status: file.status ?? 200 })
  }
  return requests
}
