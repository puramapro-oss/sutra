// OTS 0.4.9 has no injectable transport. Replace its network adapters once;
// serialization, Merkle operations and Bitcoin attestation verification stay upstream.
// Never patch global HTTP/request or temporarily restore unsafe methods across awaits.
import dns from 'node:dns/promises'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import OpenTimestamps, { type DetachedTimestampFile } from 'javascript-opentimestamps'
// @ts-expect-error upstream ships no declarations for this internal adapter
import Calendar from 'javascript-opentimestamps/src/calendar.js'
// @ts-expect-error upstream ships no declarations for this internal adapter
import Esplora from 'javascript-opentimestamps/src/esplora.js'
// @ts-expect-error upstream ships no declarations for the binary parser
import Context from 'javascript-opentimestamps/src/context.js'
// @ts-expect-error upstream ships no declarations for the timestamp parser
import Timestamp from 'javascript-opentimestamps/src/timestamp.js'
import { isPublicMediaAddress, validateMediaUrl } from './media-download'

const AGGREGATORS = new Set(['a.pool.opentimestamps.org', 'b.pool.opentimestamps.org',
  'a.pool.eternitywall.com', 'ots.btc.catallaxy.com'])
const CALENDAR_SUFFIXES = ['.calendar.opentimestamps.org', '.calendar.eternitywall.com', '.calendar.catallaxy.com']

function calendarUrl(value: string, path: string): URL {
  const url = validateMediaUrl(value)
  if (url.search || (!AGGREGATORS.has(url.hostname)
    && !CALENDAR_SUFFIXES.some(suffix => url.hostname.endsWith(suffix)))) throw new Error('SUTRA_OTS_INVALID_URL')
  return new URL(path, url)
}

/** Fixed destination set, pinned public DNS, no redirects, cookies or credentials. */
async function requestBytes(url: URL, body?: Buffer, maxBytes = 10_000): Promise<Buffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  const { signal } = controller
  try {
    const addresses = await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
      const abort = () => reject(new Error('SUTRA_OTS_TIMEOUT'))
      signal.addEventListener('abort', abort, { once: true })
      dns.lookup(url.hostname, { all: true, verbatim: true }).then(resolve, () => reject(new Error('SUTRA_OTS_DNS_FAILED')))
        .finally(() => signal.removeEventListener('abort', abort))
    })
    if (signal.aborted) throw new Error('SUTRA_OTS_TIMEOUT')
    if (!addresses.length || addresses.some(address => !isPublicMediaAddress(address.address))) throw new Error('SUTRA_OTS_PRIVATE_ADDRESS')
    const address = addresses[0]
    const lookup: LookupFunction = (_hostname, options, callback) => {
      if (typeof options === 'object' && options.all) callback(null, [address])
      else callback(null, address.address, address.family)
    }
    return await new Promise<Buffer>((resolve, reject) => {
      const request = https.request(url, {
        method: body ? 'POST' : 'GET', agent: false, lookup, signal,
        headers: { Accept: 'application/vnd.opentimestamps.v1, application/json, text/plain',
          'Accept-Encoding': 'identity', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': String(body.length) } : {}) },
      }, response => {
        const fail = (message: string) => { response.destroy(); reject(new Error(message)) }
        response.on('error', () => reject(new Error('SUTRA_OTS_INTERRUPTED')))
        if (response.statusCode !== 200) return fail('SUTRA_OTS_HTTP_REJECTED')
        if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') return fail('SUTRA_OTS_ENCODING_REJECTED')
        const declared = response.headers['content-length']
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return fail('SUTRA_OTS_SIZE_REJECTED')
        let size = 0
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) return fail('SUTRA_OTS_SIZE_REJECTED')
          chunks.push(chunk)
        })
        response.on('end', () => {
          if (declared && size !== Number(declared)) return fail('SUTRA_OTS_SIZE_REJECTED')
          resolve(Buffer.concat(chunks, size))
        })
      })
      request.on('error', () => reject(new Error(signal.aborted ? 'SUTRA_OTS_TIMEOUT' : 'SUTRA_OTS_REQUEST_FAILED')))
      request.end(body)
    })
  } catch (error) {
    if (error instanceof Error && /^SUTRA_OTS_[A-Z_]+$/.test(error.message)) throw error
    throw new Error('SUTRA_OTS_REQUEST_FAILED')
  } finally { clearTimeout(timer) }
}

type TimestampNode = { msg: ArrayLike<number>; ops: Map<unknown, TimestampNode>; attestations: unknown[] }

function assertBoundedTimestamp(root: unknown) {
  const pending = [{ node: root as TimestampNode, depth: 0 }]
  const seen = new Set<TimestampNode>()
  let attestations = 0
  while (pending.length) {
    const { node, depth } = pending.pop()!
    if (seen.has(node)) continue
    seen.add(node); attestations += node.attestations.length
    if (seen.size > 256 || depth > 64 || attestations > 64 || node.msg.length > 4096) {
      throw new Error('SUTRA_OTS_PROOF_TOO_COMPLEX')
    }
    for (const child of node.ops.values()) pending.push({ node: child, depth: depth + 1 })
  }
}

function assertCanonicalBytes(bytes: Uint8Array, canonical: ArrayLike<number>) {
  if (canonical.length !== bytes.length || bytes.some((byte, index) => byte !== canonical[index])) {
    throw new Error('SUTRA_OTS_INVALID_ENCODING')
  }
}

/** Enforce the same resource limits before persisting a newly merged receipt. */
export function serializeOtsProof(proof: DetachedTimestampFile) {
  try {
    assertBoundedTimestamp(proof.timestamp)
    const bytes = proof.serializeToBytes()
    if (!bytes.length || bytes.length > 64_000) throw new Error('SUTRA_OTS_INVALID_SIZE')
    return bytes
  } catch { throw new Error('SUTRA_OTS_INVALID_PROOF') }
}

/** Strict admission for stored proofs before upgrade or Bitcoin verification. */
export function parseOtsProof(bytes: Buffer | Uint8Array) {
  try {
    if (!bytes.length || bytes.length > 64_000) throw new Error('SUTRA_OTS_INVALID_SIZE')
    const proof = OpenTimestamps.DetachedTimestampFile.deserialize(bytes)
    assertCanonicalBytes(bytes, serializeOtsProof(proof))
    return proof
  } catch { throw new Error('SUTRA_OTS_INVALID_PROOF') }
}

function parseTimestamp(bytes: Buffer, digest: Uint8Array) {
  try {
    if (!bytes.length || bytes.length > 10_000) throw new Error('SUTRA_OTS_INVALID_SIZE')
    const context = new Context.StreamDeserialization(bytes)
    const timestamp = Timestamp.deserialize(context, Array.from(digest))
    context.assertEof()
    assertBoundedTimestamp(timestamp)
    // EOF alone misses overruns and ignored bytes inside nested attestations.
    const serialized = new Context.StreamSerialization()
    timestamp.serialize(serialized)
    assertCanonicalBytes(bytes, serialized.getOutput())
    return timestamp
  } catch { throw new Error('SUTRA_OTS_INVALID_RESPONSE') }
}

Calendar.RemoteCalendar.prototype.submit = async function (this: { url: string }, digest: Uint8Array) {
  return parseTimestamp(await requestBytes(calendarUrl(this.url, '/digest'), Buffer.from(digest)), digest)
}
Calendar.RemoteCalendar.prototype.getTimestamp = async function (this: { url: string }, digest: Uint8Array) {
  return parseTimestamp(await requestBytes(calendarUrl(this.url, `/timestamp/${Buffer.from(digest).toString('hex')}`)), digest)
}
Esplora.prototype.blockhash = async function (height: number) {
  if (!Number.isSafeInteger(height) || height < 0) throw new Error('SUTRA_OTS_INVALID_HEIGHT')
  const hash = (await requestBytes(new URL(`https://blockstream.info/api/block-height/${height}`))).toString('utf8')
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('SUTRA_OTS_INVALID_BLOCK_HASH')
  return hash
}
Esplora.prototype.block = async function (hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('SUTRA_OTS_INVALID_BLOCK_HASH')
  const bytes = await requestBytes(new URL(`https://blockstream.info/api/block/${hash}`), undefined, 64_000)
  let block: { merkle_root?: unknown; timestamp?: unknown }
  try { block = JSON.parse(bytes.toString('utf8')) }
  catch { throw new Error('SUTRA_OTS_INVALID_BLOCK') }
  if (!block || typeof block.merkle_root !== 'string' || !/^[a-f0-9]{64}$/.test(block.merkle_root)
    || !Number.isSafeInteger(block.timestamp) || (block.timestamp as number) <= 0) throw new Error('SUTRA_OTS_INVALID_BLOCK')
  return { merkleroot: block.merkle_root, time: block.timestamp }
}
