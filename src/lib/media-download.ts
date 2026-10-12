// Server-only downloader. URLs are never passed to FFmpeg or to an unpinned fetch.
import dns from 'node:dns/promises'
import https from 'node:https'
import { isIP } from 'node:net'
import type { LookupFunction } from 'node:net'
import { MAX_VIDEO_BYTES } from './media-probe'

function ipv6Number(address: string): bigint {
  const [left, right = ''] = address.split('::')
  const a = left ? left.split(':') : []
  const b = right ? right.split(':') : []
  return [...a, ...Array(8 - a.length - b.length).fill('0'), ...b]
    .reduce((value, word) => (value << BigInt(16)) + BigInt(`0x${word}`), BigInt(0))
}

/** Conservative public-unicast policy; translation/tunnel and reserved ranges fail closed. */
export function isPublicMediaAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99)
      || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
      || (a === 203 && b === 0 && c === 113))
  }
  if (isIP(address) !== 6 || address.includes('.') || address.includes('%')) return false
  const value = ipv6Number(address)
  const inRange = (base: string, bits: number) =>
    value >> BigInt(128 - bits) === ipv6Number(base) >> BigInt(128 - bits)
  return inRange('2000::', 3) && !inRange('2001::', 23) && !inRange('2001:db8::', 32)
    && !inRange('2002::', 16) && !inRange('3fff::', 20)
}

export function validateMediaUrl(value: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('SUTRA_MEDIA_INVALID_URL') }
  if (value.length > 8192 || url.protocol !== 'https:' || url.username || url.password
      || (url.port && url.port !== '443') || url.hash) throw new Error('SUTRA_MEDIA_INVALID_URL')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !isPublicMediaAddress(host)) throw new Error('SUTRA_MEDIA_PRIVATE_ADDRESS')
  return url
}

async function resolvePublic(url: URL, signal: AbortSignal) {
  if (signal.aborted) throw new Error('SUTRA_MEDIA_DOWNLOAD_ABORTED')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const family = isIP(hostname)
  if (family) return { address: hostname, family }
  const addresses = await new Promise<Awaited<ReturnType<typeof dns.lookup>> | Array<{ address: string; family: number }>>((resolve, reject) => {
    const abort = () => reject(new Error('SUTRA_MEDIA_DOWNLOAD_TIMEOUT'))
    signal.addEventListener('abort', abort, { once: true })
    dns.lookup(hostname, { all: true, verbatim: true }).then(resolve, () => reject(new Error('SUTRA_MEDIA_DNS_FAILED')))
      .finally(() => signal.removeEventListener('abort', abort))
  })
  if (signal.aborted) throw new Error('SUTRA_MEDIA_DOWNLOAD_ABORTED')
  if (!Array.isArray(addresses) || !addresses.length || addresses.some(a => !isPublicMediaAddress(a.address))) {
    throw new Error('SUTRA_MEDIA_PRIVATE_ADDRESS')
  }
  return addresses[0]
}

export type MediaDownloadKind = 'video' | 'audio' | 'image' | 'media' | 'archive'
export interface MediaDownloadOptions {
  maxBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
}

const mediaTypes: Record<MediaDownloadKind, readonly string[]> = {
  video: ['video/mp4'],
  archive: ['application/zip', 'application/x-zip-compressed'],
  media: ['video/mp4', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'image/png', 'image/jpeg', 'image/webp'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'],
  image: ['image/png', 'image/jpeg', 'image/webp'],
}

function hasMediaSignature(bytes: Buffer, kind: MediaDownloadKind, mime: string): boolean {
  const matches = (types: string[], signature: boolean) => signature && (mime === 'application/octet-stream' || types.includes(mime))
  if (bytes.length < 12) return false
  if (kind === 'archive') return bytes.readUInt32LE(0) === 0x04034b50
  if (kind === 'media') return (['video', 'audio', 'image'] as const).some(type =>
    (mime === 'application/octet-stream' || mediaTypes[type].includes(mime)) && hasMediaSignature(bytes, type, mime))
  if (kind === 'video') return bytes.toString('ascii', 4, 8) === 'ftyp'
  if (kind === 'image') return matches(['image/png'], bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || matches(['image/jpeg'], bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    || matches(['image/webp'], bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
  return matches(['audio/mpeg', 'audio/mp3'], bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0))
    || matches(['audio/aac'], bytes[0] === 255 && (bytes[1] & 0xf6) === 0xf0)
    || matches(['audio/wav', 'audio/x-wav', 'audio/wave'], bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE')
    || matches(['audio/mp4', 'audio/x-m4a'], bytes.toString('ascii', 4, 8) === 'ftyp')
    || matches(['audio/ogg'], bytes.toString('ascii', 0, 4) === 'OggS')
}

/** Compatibility entry point. Container decoding remains the media-probe owner's responsibility. */
export async function downloadVideoBytes(value: string, options: MediaDownloadOptions = {}): Promise<Buffer> {
  return downloadMediaBytes(value, { ...options, kind: 'video' })
}

/** HTTPS only, DNS pinned per hop, bounded streaming, no forwarded credentials or remote playlists. */
export async function downloadMediaBytes(value: string, options: MediaDownloadOptions & { kind: MediaDownloadKind }): Promise<Buffer> {
  const { kind } = options
  if (!Object.hasOwn(mediaTypes, kind)) throw new Error('SUTRA_MEDIA_INVALID_KIND')
  const maxBytes = options.maxBytes ?? MAX_VIDEO_BYTES
  const timeoutMs = options.timeoutMs ?? 60_000
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 12 || maxBytes > 100 * 1024 * 1024
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('SUTRA_MEDIA_INVALID_DOWNLOAD_LIMIT')
  const deadline = AbortSignal.timeout(timeoutMs)
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline
  let url = validateMediaUrl(value)
  for (let redirects = 0; redirects <= 3; redirects++) {
    const address = await resolvePublic(url, signal)
    // Node must not perform a second DNS lookup after validation (DNS rebinding).
    const lookup = ((_hostname, lookupOptions, callback) => {
      if (typeof lookupOptions === 'object' && lookupOptions.all) callback(null, [address])
      else callback(null, address.address, address.family)
    }) as LookupFunction
    const response = await new Promise<Buffer | URL>((resolve, reject) => {
      const request = https.request(url, {
        method: 'GET', agent: false, lookup, signal,
        headers: { Accept: [...mediaTypes[kind], 'application/octet-stream'].join(', '), 'Accept-Encoding': 'identity' },
      }, res => {
        const fail = (code: string) => { res.destroy(); reject(new Error(code)) }
        res.on('error', () => reject(new Error('SUTRA_MEDIA_DOWNLOAD_INTERRUPTED')))
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
          try {
            if (redirects === 3 || !res.headers.location) return fail('SUTRA_MEDIA_REDIRECT_LIMIT')
            const next = validateMediaUrl(new URL(res.headers.location, url).href)
            res.destroy()
            resolve(next)
          } catch { fail('SUTRA_MEDIA_INVALID_REDIRECT') }
          return
        }
        if (res.statusCode !== 200) return fail(`SUTRA_MEDIA_HTTP_${res.statusCode ?? 0}`)
        const mime = res.headers['content-type']?.split(';')[0].trim().toLowerCase()
        if (!mime || ![...mediaTypes[kind], 'application/octet-stream'].includes(mime)) return fail('SUTRA_MEDIA_INVALID_MIME')
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') return fail('SUTRA_MEDIA_UNEXPECTED_ENCODING')
        const declared = res.headers['content-length']
        if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return fail('SUTRA_MEDIA_INVALID_SIZE')
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) return fail('SUTRA_MEDIA_INVALID_SIZE')
          chunks.push(chunk)
        })
        res.on('end', () => {
          if (declared && size !== Number(declared)) return fail('SUTRA_MEDIA_TRUNCATED_DOWNLOAD')
          const bytes = Buffer.concat(chunks, size)
          if (!hasMediaSignature(bytes, kind, mime)) return fail('SUTRA_MEDIA_INVALID_SIGNATURE')
          resolve(bytes)
        })
      })
      request.on('error', () => reject(new Error(signal.aborted ? 'SUTRA_MEDIA_DOWNLOAD_TIMEOUT' : 'SUTRA_MEDIA_DOWNLOAD_FAILED')))
      request.end()
    })
    if (Buffer.isBuffer(response)) return response
    url = response
  }
  throw new Error('SUTRA_MEDIA_REDIRECT_LIMIT')
}
