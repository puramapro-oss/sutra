import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { searchStock } from '../../src/lib/stock.ts'

try {
  if (process.argv[2] !== '--authorized-free-read') throw new Error()
  const key = parse(readFileSync(0, 'utf8')).UNSPLASH_ACCESS_KEY
  if (!/^[A-Za-z0-9._~-]{8,512}$/.test(key ?? '')) throw new Error()
  process.env.UNSPLASH_ACCESS_KEY = key
  const nativeFetch = globalThis.fetch
  let requests = 0; let http: number | undefined
  globalThis.fetch = async (request, init) => {
    if (String(request) !== 'https://api.unsplash.com/search/photos?query=nature&per_page=20&orientation=landscape&content_filter=high'
      || init?.method !== 'GET' || init.redirect !== 'error' || requests !== 0
      || new Headers(init.headers).get('Authorization') !== `Client-ID ${key}`) throw new Error()
    requests++
    const response = await nativeFetch(request, init)
    http = response.status
    return response
  }
  let result: Record<string, unknown>
  try {
    const items = await searchStock({ query: 'nature', type: 'photo' })
    result = { status: 'PASS', contract: 'ACTUAL_ADAPTER_PARSED', itemCount: items.length,
      authentication: 'CATALOG_READ_CONFIRMED' }
  } catch {
    result = { status: 'BLOQUE', authentication: http === 200 ? 'READ_ACCEPTED_CONTRACT_FAILED' : 'UNPROVEN',
      cause: http === 200 ? 'RESPONSE_CONTRACT' : 'TRANSPORT_OR_HTTP' }
  } finally { globalThis.fetch = nativeFetch; delete process.env.UNSPLASH_ACCESS_KEY }
  process.stdout.write(JSON.stringify({ observedAt: new Date().toISOString(), provider: 'unsplash',
    base: 'ab935e59ca4e39776630f05b2ba6c0422c74ec62', source: '~/.env.purama.master',
    variable: 'UNSPLASH_ACCESS_KEY', http, requests, retries: 0, mutations: 0,
    rawResponsesPersisted: false, generation: 'NON_TESTE', ...result }) + '\n')
} catch { process.stderr.write('UNSPLASH_READ_FAILED_REDACTED\n'); process.exitCode = 1 }
