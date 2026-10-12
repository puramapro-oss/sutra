import test, { mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { downloadMediaBytes, type MediaDownloadKind } from '../src/lib/media-download.ts'

afterEach(() => mock.restoreAll())
const audio = Buffer.from('RIFF0000WAVEfmt 00000000')
const image = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(16)])
type Reply = { mime?: string; bytes?: Buffer; redirect?: string; encoding?: string }
function transport(replies: Reply[], addresses = [{ address: '93.184.216.34', family: 4 }]) {
  let calls = 0
  mock.method(dns, 'lookup', async () => addresses)
  mock.method(https, 'request', (url: URL, options: { agent: unknown; headers: Record<string, string>;
    signal: AbortSignal; lookup: (host: string, options: { all: boolean }, cb: (err: Error | null, records: unknown) => void) => void }, callback: (stream: PassThrough) => void) => {
    calls++; const reply = replies[Math.min(calls - 1, replies.length - 1)]
    assert.equal(url.protocol, 'https:'); assert.equal(options.agent, false)
    assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined)
    options.lookup('rebound.invalid', { all: true }, (err, records) => { assert.equal(err, null); assert.deepEqual(records, [addresses[0]]) })
    const request = new EventEmitter() as EventEmitter & { end(): void }
    request.end = () => queueMicrotask(() => {
      const stream = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }
      stream.statusCode = reply.redirect ? 302 : 200
      stream.headers = { 'content-type': reply.mime ?? 'audio/wav', ...(reply.redirect ? { location: reply.redirect } : {}), ...(reply.encoding ? { 'content-encoding': reply.encoding } : {}) }
      callback(stream); stream.end(reply.bytes ?? audio)
    })
    return request
  })
  return () => calls
}
test('audio and raster images use the pinned transport and preserve the downloaded bytes', async () => {
  const count = transport([{ bytes: audio }, { mime: 'image/png', bytes: image }])
  assert.deepEqual(await downloadMediaBytes('https://cdn.invalid/a', { kind: 'audio' }), audio)
  assert.deepEqual(await downloadMediaBytes('https://cdn.invalid/b', { kind: 'image' }), image)
  assert.equal(count(), 2)
})
for (const kind of ['audio', 'image'] as const) {
  test(`${kind}: mixed private/public DNS is rejected before any connection`, async () => {
    const count = transport([{}], [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }])
    await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind }), /PRIVATE_ADDRESS/)
    assert.equal(count(), 0)
  })
  test(`${kind}: redirects into cloud metadata are rejected`, async () => {
    const count = transport([{ redirect: 'https://169.254.169.254/secret' }])
    await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind }), /INVALID_REDIRECT/)
    assert.equal(count(), 1)
  })
  test(`${kind}: compressed bodies and streamed overflow are rejected`, async () => {
    transport([{ mime: 'application/octet-stream', bytes: kind === 'image' ? image : audio, encoding: 'gzip' },
      { mime: 'application/octet-stream', bytes: Buffer.alloc(40) }])
    await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind }), /UNEXPECTED_ENCODING/)
    await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind, maxBytes: 12 }), /INVALID_SIZE/)
  })
}
for (const [kind, reply] of [
  ['audio', { mime: 'audio/mpeg', bytes: Buffer.from('#EXTM3U\nhttps://127.0.0.1/private') }],
  ['audio', { mime: 'audio/wav', bytes: image }],
  ['image', { mime: 'image/svg+xml', bytes: Buffer.from('<svg>untrusted</svg>') }],
  ['image', { mime: 'image/png', bytes: audio }],
] as Array<[MediaDownloadKind, Reply]>) {
  test(`${kind}: reject playlist, SVG or mismatched ${reply.mime}`, async () => {
    transport([reply])
    await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind }), /INVALID_MIME|INVALID_SIGNATURE/)
  })
}
test('DNS failure does not expose the requested host or signed URL', async () => {
  mock.method(dns, 'lookup', async () => { throw new Error('synthetic-sensitive-marker') })
  await assert.rejects(downloadMediaBytes('https://cdn.invalid/x?token=synthetic-sensitive-marker', { kind: 'audio' }),
    error => error instanceof Error && error.message === 'SUTRA_MEDIA_DNS_FAILED')
})
test('pre-cancelled downloads do not resolve DNS or connect', async () => {
  const count = transport([{}]); const controller = new AbortController(); controller.abort(new Error('synthetic-sensitive-marker'))
  await assert.rejects(downloadMediaBytes('https://cdn.invalid/x', { kind: 'audio', signal: controller.signal }), /DOWNLOAD_ABORTED/)
  assert.equal(count(), 0)
})
test('cancellation interrupts pending DNS without exposing the caller reason', async () => {
  mock.method(dns, 'lookup', () => new Promise(() => {}))
  const controller = new AbortController()
  const pending = downloadMediaBytes('https://cdn.invalid/x', { kind: 'audio', signal: controller.signal })
  controller.abort(new Error('synthetic-sensitive-marker'))
  await assert.rejects(pending, error => error instanceof Error && /^SUTRA_MEDIA_DOWNLOAD_/.test(error.message))
})
