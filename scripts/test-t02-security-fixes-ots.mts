import test, { mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import dns from 'node:dns/promises'
import https from 'node:https'
import OpenTimestamps from 'javascript-opentimestamps'
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => { throw new Error('T02_STORAGE_NOT_EXPECTED') } } })
const { stampMp4, verifyProof, attemptUpgrade } = await import('../src/lib/opentimestamps.ts')

const require = createRequire(import.meta.url)
const { RemoteCalendar } = require('javascript-opentimestamps/src/calendar.js')
const Esplora = require('javascript-opentimestamps/src/esplora.js')
const Notary = require('javascript-opentimestamps/src/notary.js')
const Timestamp = require('javascript-opentimestamps/src/timestamp.js')
const Context = require('javascript-opentimestamps/src/context.js')
const publicDns = [{ address: '93.184.216.34', family: 4 }]
const digest = Buffer.alloc(32, 7)
const calendar = 'https://alice.btc.calendar.opentimestamps.org'
type Reply = { status?: number; bytes?: Buffer; headers?: Record<string, string>; hanging?: boolean }

afterEach(() => mock.restoreAll())

function pendingTimestamp(hash: Uint8Array) {
  const timestamp = new Timestamp(Array.from(hash))
  timestamp.attestations.push(new Notary.PendingAttestation(calendar))
  const context = new Context.StreamSerialization()
  timestamp.serialize(context)
  return Buffer.from(context.getOutput())
}

function transport(replies: Reply[], addresses = publicDns) {
  const calls: Array<{ url: URL; body?: Buffer }> = []
  mock.method(dns, 'lookup', async () => addresses)
  mock.method(https, 'request', (url: URL, options: { agent: unknown; headers: Record<string, string>; signal: AbortSignal;
    lookup: (host: string, options: { all: boolean }, cb: (err: unknown, records: unknown) => void) => void }, callback: (stream: PassThrough) => void) => {
    assert.equal(options.agent, false)
    assert.equal(options.headers.Authorization, undefined)
    assert.equal(options.headers.Cookie, undefined)
    assert.equal(options.headers['Accept-Encoding'], 'identity')
    options.lookup('rebound.invalid', { all: true }, (error, records) => {
      assert.equal(error, null); assert.deepEqual(records, [addresses[0]])
    })
    const call: { url: URL; body?: Buffer } = { url }; calls.push(call)
    const reply = replies[calls.length - 1] ?? {}
    const request = new EventEmitter() as EventEmitter & { end(body?: Buffer): void }
    options.signal.addEventListener('abort', () => request.emit('error', new Error('synthetic-sensitive-marker')))
    request.end = body => {
      call.body = body
      if (reply.hanging) return
      queueMicrotask(() => {
        const response = new PassThrough() as PassThrough & { statusCode: number; headers: Record<string, string> }
        response.statusCode = reply.status ?? 200; response.headers = reply.headers ?? {}
        callback(response)
        response.end(reply.bytes ?? pendingTimestamp(body ?? digest))
      })
    }
    return request
  })
  return calls
}

test('calendar submit and lookup retain upstream binary parsing and pinned transport', async () => {
  const calls = transport([{}, {}])
  const remote = new RemoteCalendar(calendar)
  assert.deepEqual(Buffer.from((await remote.submit(digest)).msg), digest)
  assert.deepEqual(Buffer.from((await remote.getTimestamp(digest)).msg), digest)
  assert.deepEqual(calls[0].body, digest)
  assert.equal(calls[0].url.pathname, '/digest')
  assert.equal(calls[1].url.pathname, `/timestamp/${digest.toString('hex')}`)
})

test('invalid calendar origins are refused before DNS or transport', async () => {
  const calls = transport([])
  const lookup = mock.method(dns, 'lookup', async () => { assert.fail('DNS must not run') })
  for (const value of ['http://127.0.0.1', 'https://169.254.169.254', 'https://evil.invalid',
    'https://alice.btc.calendar.opentimestamps.org.evil.invalid', `https://user:pass@${new URL(calendar).hostname}`, `${calendar}?secret=synthetic-marker`]) {
    await assert.rejects(new RemoteCalendar(value).getTimestamp(digest))
  }
  assert.equal(lookup.mock.callCount(), 0); assert.equal(calls.length, 0)
})

for (const location of ['http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data', 'https://evil.invalid/private']) {
  test(`calendar redirect denied: ${location}`, async () => {
    const calls = transport([{ status: 302, headers: { location } }])
    await assert.rejects(new RemoteCalendar(calendar).getTimestamp(digest), /SUTRA_OTS_HTTP_REJECTED/)
    assert.equal(calls.length, 1)
  })
}

test('Esplora rejects redirects without requesting an internal destination', async () => {
  const calls = transport([{ status: 307, headers: { location: 'https://127.0.0.1/private' } }])
  await assert.rejects(new Esplora().blockhash(42), /SUTRA_OTS_HTTP_REJECTED/)
  assert.equal(calls.length, 1)
})

test('private or mixed DNS denies both adapters before connection', async () => {
  const calls = transport([], [...publicDns, { address: '127.0.0.1', family: 4 }])
  await assert.rejects(new RemoteCalendar(calendar).getTimestamp(digest), /SUTRA_OTS_PRIVATE_ADDRESS/)
  await assert.rejects(new Esplora().blockhash(42), /SUTRA_OTS_PRIVATE_ADDRESS/)
  assert.equal(calls.length, 0)
})

test('calendar responses reject compression, declared/streamed overflow and truncated bodies', async () => {
  transport([{ headers: { 'content-encoding': 'gzip' } }, { headers: { 'content-length': '10001' } },
    { bytes: Buffer.alloc(10_001) }, { headers: { 'content-length': '9999' } }])
  const remote = new RemoteCalendar(calendar)
  for (const code of ['ENCODING', 'SIZE', 'SIZE', 'SIZE']) await assert.rejects(remote.getTimestamp(digest), new RegExp(`SUTRA_OTS_${code}_REJECTED`))
})

test('raw DNS and parser diagnostics never escape the adapters', async () => {
  transport([{ bytes: Buffer.from('synthetic-sensitive-marker') }])
  await assert.rejects(new RemoteCalendar(calendar).getTimestamp(digest), { message: 'SUTRA_OTS_INVALID_RESPONSE' })
  mock.method(dns, 'lookup', async () => { throw new Error('synthetic-sensitive-marker') })
  await assert.rejects(new RemoteCalendar(calendar).getTimestamp(digest), { message: 'SUTRA_OTS_DNS_FAILED' })
})

test('DNS and connection stalls have a bounded deadline', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  transport([{ hanging: true }])
  const connection = new Esplora().blockhash(42)
  await new Promise(resolve => setImmediate(resolve))
  context.mock.timers.tick(10_001)
  await assert.rejects(connection, /SUTRA_OTS_TIMEOUT/)
  mock.method(dns, 'lookup', () => new Promise(() => {}))
  const resolving = new Esplora().blockhash(42)
  context.mock.timers.tick(10_001)
  await assert.rejects(resolving, /SUTRA_OTS_TIMEOUT/)
})

test('synchronous transport exceptions cannot leak request diagnostics', async () => {
  transport([])
  mock.method(https, 'request', () => { throw new Error('synthetic-sensitive-marker') })
  await assert.rejects(new Esplora().blockhash(42), { message: 'SUTRA_OTS_REQUEST_FAILED' })
})

test('Esplora validates block identifiers and response schema', async () => {
  const calls = transport([{ bytes: Buffer.from('not-a-hash') }, { bytes: Buffer.from('{"merkle_root":"bad","timestamp":1}') }])
  await assert.rejects(new Esplora().blockhash(-1), /INVALID_HEIGHT/)
  await assert.rejects(new Esplora().block('../private'), /INVALID_BLOCK_HASH/)
  assert.equal(calls.length, 0)
  await assert.rejects(new Esplora().blockhash(42), /INVALID_BLOCK_HASH/)
  await assert.rejects(new Esplora().block('a'.repeat(64)), /INVALID_BLOCK/)
})

test('application stamp and pending verification use protected calendar adapters', async () => {
  const calls = transport([{}, {}, {}, {}])
  const result = await stampMp4(Buffer.from('synthetic fixture'))
  const proof = OpenTimestamps.DetachedTimestampFile.deserialize(Buffer.from(result.proofBase64, 'base64'))
  assert.equal(Buffer.from(proof.fileDigest()).toString('hex'), result.sha256Hex)
  assert.ok((proof.timestamp as { getAttestations(): Set<unknown> }).getAttestations().size > 0)
  assert.equal(calls.length, 4)
  const pending = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), digest)
  const timestamp = pending.timestamp as { attestations: unknown[] }
  timestamp.attestations.push(new Notary.PendingAttestation(calendar))
  transport([{ status: 302, headers: { location: 'http://127.0.0.1' } }])
  assert.deepEqual(await verifyProof(Buffer.from(pending.serializeToBytes()).toString('base64'), digest.toString('hex')),
    { verified: false, reason: 'not_anchored' })
})

test('actual OTS crypto accepts matching Merkle fixture and refuses mismatch; no Bitcoin node access', async () => {
  // Synthetic trusted-explorer fixture, not evidence of a real Bitcoin anchor.
  const proof = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), digest)
  const timestamp = proof.timestamp as { attestations: unknown[] }
  timestamp.attestations.push(new Notary.BitcoinBlockHeaderAttestation(42))
  const encoded = Buffer.from(proof.serializeToBytes()).toString('base64')
  const block = (root: string) => Buffer.from(JSON.stringify({ merkle_root: root, timestamp: 1_600_000_000 }))
  const root = Buffer.from(digest).reverse().toString('hex')
  const replies = [{ bytes: Buffer.from('a'.repeat(64)) }, { bytes: block(root) }]
  const node = require('javascript-opentimestamps/src/bitcoin.js').BitcoinNode
  const local = mock.method(node, 'readBitcoinConf', () => { assert.fail('local node must not be read') })
  transport([...replies, ...replies, { bytes: Buffer.from('a'.repeat(64)) }, { bytes: block('b'.repeat(64)) }])
  assert.equal((await verifyProof(encoded, digest.toString('hex'))).verified, true)
  assert.equal((await attemptUpgrade(encoded, digest.toString('hex'))).status, 'upgraded')
  assert.equal((await verifyProof(encoded, digest.toString('hex'))).verified, false)
  assert.equal(local.mock.callCount(), 0)
})

test('content digest mismatch refuses network before verification', async () => {
  const calls = transport([])
  const proof = OpenTimestamps.DetachedTimestampFile.fromHash(new OpenTimestamps.Ops.OpSHA256(), digest)
  ;(proof.timestamp as { attestations: unknown[] }).attestations.push(new Notary.PendingAttestation(calendar))
  const result = await verifyProof(Buffer.from(proof.serializeToBytes()).toString('base64'), 'f'.repeat(64))
  assert.equal(result.verified, false)
  if (!result.verified) assert.equal(result.reason, 'sha_mismatch')
  assert.equal(calls.length, 0)
})

test('all calendar failures cannot produce a successful empty stamp', async () => {
  transport(Array.from({ length: 4 }, () => ({ status: 302, headers: { location: 'http://127.0.0.1' } })))
  await assert.rejects(stampMp4(Buffer.from('synthetic fixture')), /SUTRA_OTS_STAMP_FAILED/)
})
