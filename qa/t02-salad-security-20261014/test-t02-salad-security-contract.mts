// Read-only tests of the real T04 contract. T02_SALAD_TARGET selects its worktree.
// Only synthetic configuration/journal/transport. No provision, GPU, secret or socket.
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const target = process.env.T02_SALAD_TARGET
if (!target) throw new Error('T02_SALAD_TARGET_REQUIRED: select the real product worktree explicitly')
const product = (path: string) => pathToFileURL(resolve(target, 'src/lib', path)).href
await mock.module(product('media-probe.ts'), { namedExports: {
  assertMediaProbeAvailable: async () => {}, MAX_VIDEO_BYTES: 64 * 1024 * 1024,
  verifyVideoBytes: async () => ({ width: 1280, height: 736, duration: 97 / 16 }),
} })
const { saladConfig } = await import(product('salad/config.ts'))
const { createSaladClient } = await import(product('salad/client.ts'))
const { createComfyBridge } = await import(product('salad/engine.ts'))
const { createSaladWorker } = await import(product('salad/worker.ts'))
const { PROTOCOL, MODEL, sha256, identity } = await import(product('salad/contracts.ts'))

const MARKER = 'T02_SYNTHETIC_PRIVATE_ERROR_NOT_A_REAL_SECRET'
const GATEWAY_TOKEN = 't02-fixture-gateway-credential-synthetic-only'
const WORKER_TOKEN = 't02-fixture-worker-credential-synthetic-only'
const profile = { width: 1280, height: 736, num_frames: 97, fps: 16 }
const input = { prompt: 'synthetic security fixture', profile }
function config() {
  const now = Date.now()
  return { enabled: true, gatewayUrl: 'https://t02-fixture.salad.cloud', gatewayApiKey: GATEWAY_TOKEN,
    workerToken: WORKER_TOKEN, requestTimeoutMs: 1000, generationTimeoutMs: 1000,
    qualification: { id: 't02-fixture', evidenceSha256: 'a'.repeat(64), verifiedAt: now - 1000,
      image: `registry.example.test/fixture@sha256:${'b'.repeat(64)}`, architecture: 'linux/amd64', cuda: '12.4',
      gpu: 'synthetic', vramMiB: 1, requiredFreeVramMiB: 1, model: MODEL,
      modelSha256: 'c'.repeat(64), encoderSha256: 'd'.repeat(64), vaeSha256: 'e'.repeat(64), profiles: [profile] },
    // These are test constants, not a quote, authorization or qualification.
    quote: { currency: 'USD', hourlyRate: 0.1, observedAt: now - 1000, expiresAt: now + 60000,
      source: 'salad-approved-quote', evidenceSha256: 'f'.repeat(64) },
  }
}
type Row = Record<string, unknown> & { id: string; scope: string; fingerprint: string; revision: number; status: string }
function journal(kind = 'submission-intent') {
  const rows = new Map<string, Row>()
  return { kind, rows, load: async (id: string) => rows.get(id) ?? null,
    reserve: async (row: Row) => { rows.set(row.id, structuredClone(row)); return 'created' },
    compareAndSet: async (_previous: Row, next: Row) => { rows.set(next.id, structuredClone(next)); return true },
  }
}
function capabilityResponse(active: ReturnType<typeof config>) {
  return Response.json({ protocol: PROTOCOL, provider: 'salad', state: 'ready', qualification: active.qualification,
    operations: ['text-to-video'], audio: false, native4k: false, maxConcurrent: 1, quotaRemaining: null, quote: active.quote,
    generationTimeoutMs: active.generationTimeoutMs })
}
const guardedFetch: typeof fetch = async () => { throw new Error('T02_UNEXPECTED_NETWORK_ATTEMPT') }
globalThis.fetch = guardedFetch

test('T02-C01 Salad disabled by default, no network or implicit credentials', async () => {
  const client = createSaladClient(undefined, journal(), guardedFetch)
  assert.equal((await client.capabilities()).state, 'disabled')
  await assert.rejects(() => client.submit('owner:org', 'op', input, 1), /SALAD_DISABLED/)
})

for (const [name, gatewayUrl] of Object.entries({
  http: 'http://t02-fixture.salad.cloud', metadata: 'https://169.254.169.254',
  loopback: 'https://127.0.0.1', ipv6: 'https://[::1]', numeric: 'https://2130706433',
  suffixSpoof: 'https://t02-fixture.salad.cloud.evil.example', credentials: 'https://user:synthetic@t02-fixture.salad.cloud',
  query: 'https://t02-fixture.salad.cloud?token=synthetic', fragment: 'https://t02-fixture.salad.cloud#fixture',
  customPort: 'https://t02-fixture.salad.cloud:444', path: 'https://t02-fixture.salad.cloud/v1/jobs',
})) {
  test(`T02-C02 Salad URL rejects ${name}`, () => {
    assert.throws(() => saladConfig({ ...config(), gatewayUrl }), /SALAD_INVALID_GATEWAY/)
  })
}

test('T02-C03 Gateway and worker credentials must differ', () => {
  assert.throws(() => saladConfig({ ...config(), workerToken: GATEWAY_TOKEN }), /SALAD_DISTINCT_CREDENTIALS_REQUIRED/)
})

test('T02-C04 malformed credentials are rejected without reflecting their value', () => {
  assert.throws(() => saladConfig({ ...config(), workerToken: `${MARKER}\r\nInjected: value` }),
    (error: Error) => error.message === 'SALAD_INVALID_CONFIG')
})

test('T02-C05 capability GET sends both credentials only as headers and forbids redirects', async () => {
  const active = config()
  let count = 0
  const client = createSaladClient(active, journal(), async (url: string, options: RequestInit) => {
    count++
    assert.equal(url, `${active.gatewayUrl}/v1/capabilities`)
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    const headers = new Headers(options.headers)
    assert.equal(headers.get('authorization'), `Bearer ${WORKER_TOKEN}`)
    assert.equal(headers.get('salad-api-key'), GATEWAY_TOKEN)
    return capabilityResponse(active)
  })
  await client.capabilities()
  assert.equal(count, 1)
})

test('T02-C06 network errors never expose credentials to capability callers', async () => {
  const client = createSaladClient(config(), journal(), async () => { throw new Error(`${MARKER} ${GATEWAY_TOKEN}`) })
  await assert.rejects(() => client.capabilities(), { message: 'SALAD_CAPABILITIES_UNREACHABLE' })
})

test('T02-C07 foreign job scope/fingerprint rejected before accepting any result', async () => {
  const active = config(), store = journal()
  const client = createSaladClient(active, store, async (url: string, options: RequestInit) => {
    if (url.endsWith('/capabilities')) return capabilityResponse(active)
    assert.equal(options.method, 'POST')
    const request = JSON.parse(String(options.body))
    const row = store.rows.get(request.id)!
    assert.ok(!String(options.body).includes(GATEWAY_TOKEN) && !String(options.body).includes(WORKER_TOKEN))
    return Response.json({ ...row, scope: '0'.repeat(64), fingerprint: '1'.repeat(64), status: 'succeeded',
      artifact: { key: row.id, sha256: '2'.repeat(64), bytes: 3 } })
  })
  const result = await client.submit('authenticated-owner:org-a', 'operation-a', input, 1)
  assert.equal(result.status, 'unknown')
  assert.equal(result.artifact, null)
})

test('T02-C08 result download binds fixed job path, both auth headers, bytes hash and redirects', async () => {
  const active = config(), store = journal()
  const bytes = Buffer.from('synthetic-video-not-a-media-proof')
  const ids = identity('authenticated-owner:org-a', 'operation-a', input, active.qualification.id)
  const row = { protocol: PROTOCOL, ...ids, revision: 1, status: 'succeeded', submittedAt: Date.now(),
    reconcileAfter: Date.now() + 1000, provider: 'salad', model: MODEL, qualificationId: active.qualification.id,
    estimatedComputeUsd: 0, actualUsd: null, costBasis: 'approved-hourly-quote-times-timeout-excludes-idle-storage-network',
    quoteEvidenceSha256: active.quote.evidenceSha256, quotaRemaining: null, timeoutMs: 1000, lastHttpStatus: 200,
    artifact: { key: ids.id, sha256: sha256(bytes), bytes: bytes.length } }
  const client = createSaladClient(active, store, async (url: string, options: RequestInit) => {
    assert.equal(url, `${active.gatewayUrl}/v1/jobs/${ids.id}/media`)
    assert.equal(options.redirect, 'error')
    assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${WORKER_TOKEN}`)
    assert.equal(new Headers(options.headers).get('salad-api-key'), GATEWAY_TOKEN)
    return new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } })
  })
  assert.deepEqual(Buffer.from(await client.download(row, input)), bytes)
  await assert.rejects(() => client.download({ ...row, artifact: { ...row.artifact, sha256: '0'.repeat(64) } }, input),
    { message: 'SALAD_MEDIA_UNVERIFIED' })
})

test('T02-C09 private bridge accepts loopback only, never a remote/metadata host', () => {
  for (const url of ['http://169.254.169.254:80', 'https://127.0.0.1:7861', 'http://localhost:7861',
    'http://127.0.0.1:7861/files', 'http://user:synthetic@127.0.0.1:7861']) {
    assert.throws(() => createComfyBridge(url, guardedFetch), /SALAD_INVALID_PRIVATE_BRIDGE/)
  }
})

for (const output of ['https://evil.example/files', 'http://127.0.0.1:7861/admin', 'http://127.0.0.1:7861/files#fixture']) {
  test(`T02-C10 bridge refuses result URL ${output} without download`, async () => {
    let count = 0
    const bridge = createComfyBridge('http://127.0.0.1:7861', async () => {
      count++
      return Response.json({ video_url: output })
    })
    await assert.rejects(() => bridge.generate(input, 1000), { message: 'SALAD_COMPUTE_UNCERTAIN' })
    assert.equal(count, 1)
  })
}

function workerFixture(active = config()) {
  let touched = 0
  const blocked = async () => { touched++; throw new Error(MARKER) }
  const worker = createSaladWorker(active, {
    journal: { ...journal('exclusive-execution'), load: blocked, reserve: blocked, compareAndSet: blocked },
    artifacts: { get: blocked, put: blocked }, inspect: blocked,
    bridge: { health: blocked, generate: blocked },
  })
  return { worker, touched: () => touched }
}

for (const path of ['/health', '/v1/capabilities', '/v1/jobs', `/v1/jobs/${'a'.repeat(64)}`, `/v1/jobs/${'a'.repeat(64)}/media`]) {
  test(`T02-C11 worker rejects missing/forged auth before touching dependencies: ${path}`, async () => {
    for (const headers of [{}, { authorization: 'Bearer forged' }, { 'Salad-Api-Key': GATEWAY_TOKEN }]) {
      const fixture = workerFixture()
      const response = await fixture.worker.handle(new Request(`https://t02-fixture.salad.cloud${path}`, {
        method: path === '/v1/jobs' ? 'POST' : 'GET', headers: headers as HeadersInit,
      }))
      assert.equal(response.status, 401)
      assert.equal(fixture.touched(), 0)
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
  })
}

test('T02-C12 credentials in query cannot substitute for worker authentication', async () => {
  const fixture = workerFixture()
  const response = await fixture.worker.handle(new Request(`https://t02-fixture.salad.cloud/v1/capabilities?token=${WORKER_TOKEN}`))
  assert.equal(response.status, 401)
  assert.equal(fixture.touched(), 0)
  assert.ok(!(await response.text()).includes(WORKER_TOKEN))
})

test('T02-C13 worker storage errors are expunged, no signed URL or credential returned', async () => {
  const fixture = workerFixture()
  const response = await fixture.worker.handle(new Request(`https://t02-fixture.salad.cloud/v1/jobs/${'a'.repeat(64)}/media`, {
    headers: { authorization: `Bearer ${WORKER_TOKEN}` },
  }))
  assert.equal(response.status, 503)
  assert.equal(fixture.touched(), 1)
  assert.deepEqual(await response.json(), { error: 'SALAD_SAFE_FAILURE' })
})

test('T02-C14 replacing server credential invalidates old bearer for new worker instance', async () => {
  const fixture = workerFixture({ ...config(), workerToken: 't02-rotated-worker-credential-synthetic-only' })
  const response = await fixture.worker.handle(new Request('https://t02-fixture.salad.cloud/health', {
    headers: { authorization: `Bearer ${WORKER_TOKEN}` },
  }))
  assert.equal(response.status, 401)
  assert.equal(fixture.touched(), 0)
})

test('T02-C15 authenticated caller cannot use arbitrary bridge paths through worker wrapper', async () => {
  for (const path of ['/files?filename=other-owner.mp4', '/upscale', '/view', '/v1/jobs/%2e%2e/media']) {
    const fixture = workerFixture()
    const response = await fixture.worker.handle(new Request(`https://t02-fixture.salad.cloud${path}`, {
      headers: { authorization: `Bearer ${WORKER_TOKEN}` },
    }))
    assert.ok([400, 405].includes(response.status))
    assert.equal(fixture.touched(), 0)
  }
})
