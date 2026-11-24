// Explicit one-shot GET evidence, private selected stdin only; no account data serialization.
import { readFileSync } from 'node:fs'
import { inspect, elevenFailure } from './diagnostic.mjs'
import { parseSelected, planReads, probe } from '../t04-provider-validation-20261014/probe.mjs'
import { validateAccess } from '../t04-salad-access-20261015/validate-access.mjs'
import { listVoices } from '../../src/lib/elevenlabs.ts'
import { searchVideos, searchImages } from '../../src/lib/pexels.ts'
import { providerRecord } from '../../src/lib/provider-response.ts'

try {
  if (process.argv[2] !== '--authorized-free-reads') throw new Error()
  const source = readFileSync(0, 'utf8')
  if (source.length > 65536) throw new Error()
  const { values, metadata } = inspect(source)
  const configNames = ['RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY',
    'SHOTSTACK_ENV', 'SUNO_API_KEY', 'SUNO_API_BASE_URL', 'SUNO_BASE_URL', 'LTX_API_KEY']
  const selected = parseSelected(source.split(/\r?\n/).filter(line => configNames.some(n => line.startsWith(`${n}=`))).join('\n'))
  const results: Record<string, unknown> = {}
  let requests = 0
  for (const plan of planReads(selected)) {
    const result = await probe(plan)
    results[plan.provider] = result
    requests += result.reason === 'READ_ALLOWLIST_REJECTED' ? 0 : 1
  }
  const salad = await validateAccess(values)
  results.salad = { ...salad, authentication: salad.status === 'PASS_READ_ONLY' ? 'SCOPED_READ_CONFIRMED' : 'UNPROVEN',
    credits: 'NON_TESTE', generation: 'NON_TESTE' }
  requests += salad.requests
  const nativeFetch = globalThis.fetch
  for (const [name, variable, url, operation] of [
    ['elevenlabs', 'ELEVENLABS_API_KEY', 'https://api.elevenlabs.io/v1/voices', listVoices],
    ['pexels-video', 'PEXELS_API_KEY', 'https://api.pexels.com/v1/videos/search?query=nature&per_page=1&orientation=landscape', () => searchVideos('nature', 1)],
    ['pexels-image', 'PEXELS_API_KEY', 'https://api.pexels.com/v1/search?query=nature&per_page=1&orientation=landscape', () => searchImages('nature', 1)],
  ] as const) {
    if (!values[variable]) {
      results[name] = { status: 'BLOQUE', cause: 'MALFORMED_OR_ABSENT_LOCAL_CONFIGURATION', requests: 0, authentication: 'NON_TESTE' }
      continue
    }
    process.env[variable] = values[variable]
    let calls = 0; let http: number | undefined; let diagnostic: unknown
    globalThis.fetch = async (request, init) => {
      const header = name === 'elevenlabs' ? 'xi-api-key' : 'Authorization'
      if (String(request) !== url || (init?.method ?? 'GET') !== 'GET' || calls !== 0
        || init?.redirect !== 'error' || new Headers(init?.headers).get(header) !== values[variable]) throw new Error()
      calls++; requests++
      const response = await nativeFetch(request, init); http = response.status
      if (name === 'elevenlabs' && !response.ok) {
        const body = await providerRecord(response.clone(), init.signal ?? AbortSignal.timeout(5000), 65536).catch(() => null)
        diagnostic = elevenFailure(response.status, body)
      }
      return response
    }
    try {
      const items = await operation()
      results[name] = { status: 'PASS', http, requests: calls, contract: 'ACTUAL_ADAPTER_PARSED', itemCount: items.length,
        authentication: 'CATALOG_READ_CONFIRMED', credits: 'NON_TESTE', generation: 'NON_TESTE' }
    } catch {
      results[name] = diagnostic ?? { status: 'BLOQUE', http, cause: http === 200 ? 'RESPONSE_CONTRACT' : 'TRANSPORT_OR_HTTP', requests: calls }
    } finally { globalThis.fetch = nativeFetch; delete process.env[variable] }
  }
  results.ltx = { status: 'NON_TESTE', reason: 'NO_DOCUMENTED_FREE_ACCOUNT_ENDPOINT_OR_EXISTING_JOB_ID',
    authentication: 'NON_TESTE', credits: 'NON_TESTE', generation: 'NON_TESTE' }
  process.stdout.write(JSON.stringify({ observedAt: new Date().toISOString(), source: '~/.env.purama.master',
    base: 'f36013ae8b3bd7d9a702f7aebfdff1ac430c05f5', metadata,
    configuration: configNames.map(name => ({ name, present: Boolean(selected[name]), source: selected[name] ? 'master' : 'absent' })),
    results, requests, retries: 0, mutations: 0, rawResponsesPersisted: false, generation: 'NON_TESTE' }) + '\n')
} catch { process.stderr.write('READ_FAILED_REDACTED\n'); process.exitCode = 1 }
