import test, { afterEach, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import dns from 'node:dns/promises'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

// Compose the real owner resolver and downloader; only network/Storage edges
// are doubles. Earlier suites exercised each side of this boundary separately.
process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.example.test'
const marker = 'T02_SYNTHETIC_DIAGNOSTIC'
const bytes = Buffer.from('0000ftypisom000000000000')
const signatures: string[] = []
const connections: string[] = []
const lookups: string[] = []
let signedUrl = ''
let storageError = false
let redirect: string | undefined
let internalDns = false
let responseCode = 200
let transportFailure = false
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  storage: { from: () => ({ createSignedUrl: async (path: string, ttl: number) => {
    signatures.push(path); assert.equal(ttl, 300)
    return storageError ? { data: null, error: { message: marker } }
      : { data: { signedUrl }, error: null }
  } }) },
}) } })
const { withMediaOwner, durableMediaUrl } = await import('../src/lib/private-media.ts')
const { downloadVideoBytes } = await import('../src/lib/media-download.ts')
const aliceUrl = durableMediaUrl('owners/alice/clip.mp4')
const download = (owner = 'alice') => withMediaOwner(owner, () => downloadVideoBytes(aliceUrl))

beforeEach(() => {
  signatures.length = connections.length = lookups.length = 0
  signedUrl = `https://storage.example.test/clip.mp4?token=${marker}`
  storageError = internalDns = transportFailure = false; redirect = undefined; responseCode = 200
  mock.method(dns, 'lookup', async (hostname: string) => {
    lookups.push(hostname)
    return [{ address: internalDns ? '127.0.0.1' : '93.184.216.34', family: 4 }]
  })
  mock.method(https, 'request', (url: URL, options: { agent: unknown; headers: Record<string, string>;
    lookup: (host: string, options: { all: boolean }, callback: (err: Error | null, value: unknown) => void) => void },
  callback: (stream: PassThrough) => void) => {
    connections.push(url.href)
    assert.equal(options.agent, false)
    assert.ok(Object.keys(options.headers).every(key => !['cookie', 'authorization'].includes(key.toLowerCase())))
    options.lookup('rebound.example.test', { all: true }, (err, value) => {
      assert.equal(err, null); assert.deepEqual(value, [{ address: '93.184.216.34', family: 4 }])
    })
    const request = new EventEmitter() as EventEmitter & { end(): void }
    request.end = () => queueMicrotask(() => {
      if (transportFailure) { request.emit('error', new Error(marker)); return }
      const stream = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }
      stream.statusCode = redirect ? 302 : responseCode
      stream.headers = { 'content-type': 'video/mp4', ...(redirect ? { location: redirect } : {}) }
      callback(stream); stream.end(bytes)
    })
    return request
  })
})
afterEach(() => mock.restoreAll())

test('private download: authorized owner signs once and fetches the signed object using pinned DNS', async () => {
  assert.deepEqual(await download(), bytes)
  assert.deepEqual(signatures, ['owners/alice/clip.mp4'])
  assert.deepEqual(connections, [signedUrl]); assert.deepEqual(lookups, ['storage.example.test'])
})
test('private download: missing context rejects before Storage, DNS or HTTPS', async () => {
  await assert.rejects(downloadVideoBytes(aliceUrl), /OWNER_REQUIRED/)
  assert.deepEqual([signatures, connections, lookups], [[], [], []])
})
test('private download: Bob cannot download Alice media even with a valid owner context', async () => {
  await assert.rejects(download('bob'), /ACCESS_DENIED/)
  assert.deepEqual([signatures, connections, lookups], [[], [], []])
})
test('private download: Storage error is constant and prevents all network activity', async () => {
  storageError = true
  await assert.rejects(download(), { message: 'SUTRA_MEDIA_SIGNATURE_FAILED' })
  assert.deepEqual([connections, lookups], [[], []])
})
for (const url of ['https://127.0.0.1/private', 'https://169.254.169.254/latest/meta-data/', 'http://storage.example.test/clip']) {
  test(`private download: invalid signed destination ${url} cannot bypass SSRF checks`, async () => {
    signedUrl = url
    await assert.rejects(download(), /SUTRA_MEDIA_(PRIVATE_ADDRESS|INVALID_URL)/)
    assert.deepEqual([connections, lookups], [[], []])
  })
}
test('private download: signed hostname resolving privately is denied before HTTPS', async () => {
  internalDns = true
  await assert.rejects(download(), { message: 'SUTRA_MEDIA_PRIVATE_ADDRESS' })
  assert.deepEqual(connections, []); assert.equal(lookups.length, 1)
})
test('private download: malicious Storage redirect cannot reach metadata', async () => {
  redirect = 'https://169.254.169.254/latest/meta-data/'
  await assert.rejects(download(), { message: 'SUTRA_MEDIA_INVALID_REDIRECT' })
  assert.deepEqual(connections, [signedUrl]); assert.equal(lookups.length, 1)
})
test('private download: expired signed URL preserves a safe error and never retries the signature', async () => {
  responseCode = 403
  await assert.rejects(download(), { message: 'SUTRA_MEDIA_HTTP_403' })
  assert.equal(signatures.length, 1); assert.deepEqual(connections, [signedUrl])
})
test('private download: transport rejection cannot expose the signed query or backend diagnostic', async () => {
  transportFailure = true
  await assert.rejects(download(), { message: 'SUTRA_MEDIA_DOWNLOAD_FAILED' })
  assert.equal(signatures.length, 1); assert.equal(connections.length, 1)
})
