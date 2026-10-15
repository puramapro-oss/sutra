// Explicit one-shot free GETs. Input is selected master lines through private stdin.
// Never output URLs, headers, credentials, account identifiers or response bodies.
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { parseSelected, planReads, probe } from '../t04-provider-validation-20261014/probe.mjs'
import { listVoices } from '../../src/lib/elevenlabs.ts'
import { searchVideos, searchImages } from '../../src/lib/pexels.ts'

try {
  if (process.argv[2] !== '--authorized-free-reads') throw new Error()
  const input = readFileSync(0, 'utf8')
  if (input.length > 65536) throw new Error()
  const catalogNames = ['PEXELS_API_KEY', 'ELEVENLABS_API_KEY']
  const catalogLines = input.split(/\r?\n/).filter(line => catalogNames.some(name => line.startsWith(`${name}=`)))
  const values = parseSelected(input)
  const metadata: Array<{ name: string; present: boolean; source: string; format: string }> = []
  for (const name of catalogNames) {
    const lines = catalogLines.filter(line => line.startsWith(`${name}=`))
    const raw = lines[0]?.slice(name.length + 1).trim()
    let key: string | undefined
    if (lines.length === 1 && raw && !/[`$\\\r\n\0]/.test(raw)) key = parse(lines[0])[name]
    const valid = typeof key === 'string' && /^[A-Za-z0-9._~-]{8,512}$/.test(key)
    metadata.push({ name, present: lines.length > 0, source: lines.length ? 'master' : 'absent', format: valid ? 'TRANSPORT_SAFE' : 'ABSENT_OR_UNSUPPORTED' })
    if (valid) process.env[name] = key!
    else delete process.env[name]
  }
  const names = ['RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY',
    'SHOTSTACK_ENV', 'SUNO_API_KEY', 'SUNO_API_BASE_URL', 'SUNO_BASE_URL', 'LTX_API_KEY']
  for (const name of names) metadata.push({ name, present: Boolean(values[name]), source: values[name] ? 'master' : 'absent', format: values[name] ? 'PARSED_STATIC' : 'ABSENT' })
  const results: Record<string, unknown> = {}
  let requests = 0
  for (const plan of planReads(values)) {
    results[plan.provider] = await probe(plan)
    // probe rejects a plan before fetch; count actual calls below for catalogs only.
    requests += (results[plan.provider] as { reason?: string }).reason === 'READ_ALLOWLIST_REJECTED' ? 0 : 1
  }
  const nativeFetch = globalThis.fetch
  for (const [name, variable, call] of [
    ['elevenlabs-voices', 'ELEVENLABS_API_KEY', listVoices],
    ['pexels-video', 'PEXELS_API_KEY', () => searchVideos('nature', 1)],
    ['pexels-image', 'PEXELS_API_KEY', () => searchImages('nature', 1)],
  ] as const) {
    if (!process.env[variable]) { results[name] = { status: 'BLOQUE', reason: 'MISSING_OR_INVALID_FIELD', name: variable, requests: 0 }; continue }
    let http: number | undefined
    let calls = 0
    globalThis.fetch = async (url, init) => {
      const permitted = ['https://api.elevenlabs.io/v1/voices',
        'https://api.pexels.com/v1/videos/search?query=nature&per_page=1&orientation=landscape',
        'https://api.pexels.com/v1/search?query=nature&per_page=1&orientation=landscape']
      if (!permitted.includes(String(url)) || (init?.method ?? 'GET') !== 'GET' || calls !== 0) throw new Error()
      calls++; requests++
      const response = await nativeFetch(url, init); http = response.status
      return response
    }
    try {
      const items = await call()
      results[name] = { status: 'PASS', http, contract: 'ADAPTER_PARSED', authentication: 'CATALOG_READ_CONFIRMED', itemCount: items.length,
        credits: 'NON_TESTE', generation: 'NON_TESTE', requests: calls }
    } catch {
      results[name] = { status: 'BLOQUE', ...(http ? { http } : {}), authentication: 'UNPROVEN',
        reason: http === 401 || http === 403 ? 'AUTH_OR_SCOPE_REFUSED' : http === 429 ? 'RATE_LIMIT'
          : http === 200 ? 'INVALID_RESPONSE_CONTRACT' : 'TRANSPORT_OR_HTTP_ERROR', requests: calls }
    } finally { globalThis.fetch = nativeFetch }
  }
  process.stdout.write(JSON.stringify({ observedAt: new Date().toISOString(), source: '~/.env.purama.master', metadata,
    results, requests, mutations: 0, retries: 0, generation: 'NON_TESTE' }, null, 2) + '\n')
} catch { process.stderr.write('T04_FREE_READS_BLOCKED_REDACTED\n'); process.exitCode = 1 }
