import test, { afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isPublicMediaAddress, validateMediaUrl, downloadVideoBytes } from '../src/lib/media-download.ts'
import type { LtxJobState } from '../src/lib/ltx.ts'

const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')
const params = { prompt: 'contract', model: 'ltx-2-3-fast' as const, duration: 6, resolution: '1280x720' }
process.env.LTX_API_KEY = 'test-only'
process.env.SUTRA_VIDEO_ENGINE = 'external'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const { textToVideo, imageToVideo, durableLtxJob, generateVideoSmart } = await import('../src/lib/ltx.ts')
const { recordLtxFailure, recordLtxSuccess } = await import('../src/lib/ltx-utils.ts')
const { verifyAndStoreRenderedVideo } = await import('../src/lib/shotstack.ts')
const { verifyVideoBytes } = await import('../src/lib/media-probe.ts')
afterEach(() => { mock.restoreAll(); globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') } })

type Reply = { status?: number; headers?: Record<string, string>; bytes?: Buffer; hang?: boolean }
function mediaMock(replies: Reply[] = [{}], addresses = [{ address: '93.184.216.34', family: 4 }]) {
  let calls = 0
  mock.method(dns, 'lookup', async () => addresses)
  mock.method(https, 'request', (url: URL, options: { agent: unknown; headers: Record<string, string>; lookup: (host: string, options: { all: boolean }, callback: (error: Error | null, records: unknown) => void) => void; signal: AbortSignal }, callback: (stream: PassThrough) => void) => {
    assert.equal(url.protocol, 'https:')
    assert.equal(options.agent, false)
    assert.equal(options.headers.Authorization, undefined)
    // Simulate DNS changing after validation: the HTTP client must use the pinned lookup.
    options.lookup('rebound.invalid', { all: true }, (err, records) => {
      assert.equal(err, null); assert.deepEqual(records, [addresses[0]])
    })
    const request = new EventEmitter() as EventEmitter & { end(): void }
    const reply = replies[Math.min(calls++, replies.length - 1)]
    request.end = () => queueMicrotask(() => {
      const stream = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }
      stream.statusCode = reply.status ?? 200
      stream.headers = { 'content-type': 'video/mp4', ...reply.headers }
      options.signal.addEventListener('abort', () => { stream.destroy(new Error('timeout')); request.emit('error', new Error('timeout')) }, { once: true })
      callback(stream)
      if (!reply.hang) stream.end(reply.bytes ?? mp4)
    })
    return request
  })
  return () => calls
}

for (const address of ['0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.0.1', '100.64.0.1', '198.18.0.1', '192.0.2.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::', '64:ff9b::7f00:1', '3fff::1', 'invalid']) {
  test(`Media refuse adresse privee/reservee ${address}`, () => assert.equal(isPublicMediaAddress(address), false))
}
test('Media autorise les adresses publiques IPv4 et IPv6', () => {
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicMediaAddress(ip), true)
})
test('Media refuse protocoles, credentials, ports et IP obfusquees', () => {
  for (const url of ['http://example.org/x', 'file:///etc/passwd', 'https://a:b@example.org/x', 'https://example.org:8443/x', 'https://2130706433/x', 'https://0x7f000001/x', 'https://127.1/x', 'https://[::ffff:127.0.0.1]/x']) assert.throws(() => validateMediaUrl(url))
})
test('Media epingle le DNS valide et ne transmet pas de credentials', async () => {
  const count = mediaMock(); assert.deepEqual(await downloadVideoBytes('https://media.invalid/x.mp4'), mp4); assert.equal(count(), 1)
})
test('Media refuse une reponse DNS melangeant IP publique et privee', async () => {
  const count = mediaMock([{}], [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }])
  await assert.rejects(() => downloadVideoBytes('https://media.invalid/x'), /PRIVATE_ADDRESS/); assert.equal(count(), 0)
})
test('Media revalide les redirections avant le second telechargement', async () => {
  const count = mediaMock([{ status: 302, headers: { location: 'https://169.254.169.254/latest' } }])
  await assert.rejects(() => downloadVideoBytes('https://media.invalid/x'), /INVALID_REDIRECT/); assert.equal(count(), 1)
})
test('Media suit une redirection publique bornee', async () => {
  const count = mediaMock([{ status: 302, headers: { location: '/next' } }, {}])
  assert.deepEqual(await downloadVideoBytes('https://media.invalid/x'), mp4); assert.equal(count(), 2)
})
test('Media bloque les boucles de redirection', async () => {
  const count = mediaMock([{ status: 302, headers: { location: '/next' } }])
  await assert.rejects(() => downloadVideoBytes('https://media.invalid/x'), /REDIRECT_LIMIT/); assert.equal(count(), 4)
})
for (const [name, reply, error] of [
  ['MIME HTML', { headers: { 'content-type': 'text/html' } }, 'INVALID_MIME'],
  ['faux MP4', { bytes: Buffer.from('<html>not a video</html>') }, 'INVALID_SIGNATURE'],
  ['taille declaree', { headers: { 'content-length': '999999999' } }, 'INVALID_SIZE'],
  ['taille stream', { bytes: Buffer.alloc(40) }, 'INVALID_SIZE'],
  ['troncature', { headers: { 'content-length': '30' } }, 'TRUNCATED_DOWNLOAD'],
  ['compression', { headers: { 'content-encoding': 'gzip' } }, 'UNEXPECTED_ENCODING'],
  ['HTTP 403', { status: 403 }, 'HTTP_403'],
] as const) test(`Media refuse ${name}`, async () => {
  mediaMock([reply]); await assert.rejects(() => downloadVideoBytes('https://media.invalid/x', { maxBytes: 32 }), new RegExp(error))
})
test('Media timeout couvre aussi le corps de reponse', async () => {
  mediaMock([{ hang: true }])
  const hold = setTimeout(() => {}, 100)
  try { await assert.rejects(() => downloadVideoBytes('https://media.invalid/x', { timeoutMs: 10 }), /DOWNLOAD_(TIMEOUT|INTERRUPTED)/) }
  finally { clearTimeout(hold) }
})

function ltxFetch(poll: () => Response | Promise<Response>, submit?: () => Response | Promise<Response>) {
  const requests: Array<{ url: string; method: string; body?: string }> = []
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body as string })
    assert.ok(String(url).startsWith('https://api.ltx.io/v2/'))
    assert.equal(init?.redirect, 'error')
    if (init?.method === 'POST') return submit ? submit() : Response.json({ id: 'job-1' }, { status: 202 })
    return poll()
  }
  return requests
}
const completed = () => Response.json({ id: 'job-1', status: 'completed', result: { video_url: 'https://media.invalid/video.mp4' } })
test('LTX V2 soumet 202, sauvegarde ID, poll GET et telecharge sans token', async () => {
  mediaMock()
  const steps: Record<string, unknown> = {}, saved: string[] = []
  const requests = ltxFetch(() => { assert.equal((steps.ltx as LtxJobState).id, 'job-1'); return completed() })
  const bytes = await textToVideo(params, durableLtxJob(steps, 'ltx', async (_key, state) => { saved.push((state as LtxJobState).id ?? 'intent') }))
  assert.deepEqual(Buffer.from(bytes), mp4)
  assert.deepEqual(requests.map(r => r.method), ['POST', 'GET'])
  assert.equal(requests[1].url, 'https://api.ltx.io/v2/text-to-video/job-1')
  assert.deepEqual(saved, ['intent', 'job-1', 'job-1'])
})
test('LTX image conserve references, camera et endpoint lors du polling', async () => {
  mediaMock(); const requests = ltxFetch(completed)
  await imageToVideo({ ...params, image_uri: 'ltx://image', last_frame_uri: 'ltx://end', camera_motion: 'static' })
  assert.equal(requests[1].url, 'https://api.ltx.io/v2/image-to-video/job-1')
  assert.equal(JSON.parse(requests[0].body!).last_frame_uri, 'ltx://end')
})
test('LTX reprise apres reponse de download perdue ne refait aucun POST', async () => {
  const steps: Record<string, unknown> = {}
  mediaMock([{ status: 403 }, {}]); const requests = ltxFetch(completed)
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /RECONCILIATION_REQUIRED/)
  await textToVideo(params, durableLtxJob(steps, 'ltx'))
  assert.equal(requests.filter(r => r.method === 'POST').length, 1)
  assert.equal(requests.filter(r => r.method === 'GET').length, 2)
})
test('LTX le meme objet de reprise conserve aussi son identifiant apres succes', async () => {
  mediaMock(); const requests = ltxFetch(completed)
  const job = durableLtxJob({}, 'ltx')
  await textToVideo(params, job)
  await textToVideo(params, job)
  assert.equal(job.current?.id, 'job-1')
  assert.equal(requests.filter(r => r.method === 'POST').length, 1)
})
test('LTX reponse POST perdue bloque la deuxieme soumission', async () => {
  const steps: Record<string, unknown> = {}
  const requests = ltxFetch(completed, () => { throw new Error('lost response') })
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /RECONCILIATION_REQUIRED/)
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /RECONCILIATION_REQUIRED/)
  assert.equal(requests.length, 1)
})
test('LTX erreur du checkpoint ID interdit polling et nouvelle soumission', async () => {
  const steps: Record<string, unknown> = {}
  const requests = ltxFetch(completed)
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx', async (_key, state) => {
    if ((state as LtxJobState).id) throw new Error('DB offline')
  })), /RECONCILIATION_REQUIRED/)
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /RECONCILIATION_REQUIRED/)
  assert.equal(requests.length, 1)
})
test('LTX echec terminal reste terminal sans regeneration', async () => {
  const steps: Record<string, unknown> = {}
  const requests = ltxFetch(() => Response.json({ id: 'job-1', status: 'failed', error: { message: 'private provider detail' } }))
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /JOB_FAILED/)
  await assert.rejects(() => textToVideo(params, durableLtxJob(steps, 'ltx')), /JOB_FAILED/)
  assert.equal(requests.length, 2)
})
test('LTX requete modifiee sous le meme checkpoint refusee avant reseau', async () => {
  const steps: Record<string, unknown> = {}; mediaMock(); const requests = ltxFetch(completed)
  await textToVideo(params, durableLtxJob(steps, 'ltx'))
  await assert.rejects(() => textToVideo({ ...params, prompt: 'different' }, durableLtxJob(steps, 'ltx')), /RESUME_CONFLICT/)
  assert.equal(requests.length, 2)
})
for (const data of [{ status: 'completed', result: { video_url: 'https://media.invalid/x' } }, { id: 'other', status: 'completed' }, { id: 'job-1', status: 'unknown' }, { id: 'job-1', status: 'completed', result: {} }]) {
  test(`LTX rejette une reponse incomplete ${JSON.stringify(data)}`, async () => {
    const count = mediaMock(); ltxFetch(() => Response.json(data))
    await assert.rejects(() => textToVideo(params)); assert.equal(count(), 0)
  })
}
test('LTX requete acceptee puis erreur ne declenche pas de fallback payant WAN', async () => {
  const requests = ltxFetch(() => Response.json({ id: 'job-1', status: 'failed' }))
  await assert.rejects(() => generateVideoSmart('p', 'empire', null, { quality: '720p', duration: 6 }), /JOB_FAILED/)
  assert.equal(requests.length, 2)
})
test('LTX circuit ouvert ne perd ni image de reference ni contrainte camera', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('unexpected') }
  for (let i = 0; i < 10; i++) recordLtxFailure()
  try {
    await assert.rejects(() => generateVideoSmart('p', 'empire', null, { imageUri: 'ltx://reference', cameraMotion: 'static' }), /fallback WAN refuse/)
    assert.equal(calls, 0)
  } finally { recordLtxSuccess() }
})

let synthetic: Promise<Buffer> | undefined
function videoFixture() {
  return synthetic ??= (async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sutra-final-contract-'))
    try {
      const file = join(directory, 'video.mp4')
      await promisify(execFile)('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=128x72:r=30:d=1',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file])
      return await readFile(file)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })()
}
const rendered = { url: 'https://temporary.invalid/render.mp4', duration: 1, outputQuality: 'hd' as const,
  outputSize: { width: 128, height: 72 }, outputVerified: false, timeline: {} }
const owner = { userId: 'user-1', mediaId: 'video-1', requireAudio: true }
test('Export cloud: fichier decode, dimensions/audio mesures, copie durable avant validation', async () => {
  let uploads = 0
  const final = await verifyAndStoreRenderedVideo(rendered, owner, {
    download: videoFixture, verify: verifyVideoBytes, upload: async (path, bytes, mime) => {
      uploads++; assert.match(path, /^final\/user-1\/[a-f0-9]{64}\/[a-f0-9]{64}\.mp4$/)
      assert.equal(mime, 'video/mp4'); assert.ok(Buffer.isBuffer(bytes)); assert.ok(bytes.byteLength > 24)
      return 'https://durable.invalid/video.mp4'
    },
  })
  assert.equal(final.outputVerified, true); assert.equal(final.url, 'https://durable.invalid/video.mp4')
  assert.equal(final.verification?.hasAudio, true); assert.equal(final.verification?.fps, 30); assert.equal(uploads, 1)
})
test('Export cloud: fausse resolution refusee sans upload ni succes', async () => {
  let uploads = 0
  await assert.rejects(() => verifyAndStoreRenderedVideo({ ...rendered, outputSize: { width: 3840, height: 2160 } }, owner,
    { download: videoFixture, verify: verifyVideoBytes, upload: async () => { uploads++; return 'wrong' } }), /DIMENSIONS_MISMATCH/)
  assert.equal(uploads, 0)
})
test('Export cloud: fichier tronque refuse avant copie durable', async () => {
  let uploads = 0
  await assert.rejects(() => verifyAndStoreRenderedVideo(rendered, owner, {
    download: async () => mp4, verify: verifyVideoBytes, upload: async () => { uploads++; return 'wrong' },
  }), /INVALID_OR_UNDECODABLE/)
  assert.equal(uploads, 0)
})
test('Export cloud: echec stockage reste une erreur; la reprise reutilise les memes octets', async () => {
  const paths: string[] = []
  const providers = { download: videoFixture, verify: verifyVideoBytes, upload: async (path: string) => {
    paths.push(path); if (paths.length === 1) throw new Error('storage unavailable'); return 'https://durable.invalid/video.mp4'
  } }
  await assert.rejects(() => verifyAndStoreRenderedVideo(rendered, owner, providers), /storage unavailable/)
  assert.equal((await verifyAndStoreRenderedVideo(rendered, owner, providers)).outputVerified, true)
  assert.equal(paths[0], paths[1])
})
