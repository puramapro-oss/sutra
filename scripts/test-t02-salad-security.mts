// Independent security audit of the actual base implementation, entirely offline.
// Known gaps deliberately FAIL: these are remote-release blockers, not a green gate.
// See qa/t02-salad-security-20261014/README.md for the exact isolated command.
import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const OWNER = 'matiss.frasne@gmail.com'
const CLIENT = 'client@example.test'
const MARKER = 'T02_SYNTHETIC_PRIVATE_ERROR_NOT_A_REAL_SECRET'
const WORKER = 'https://worker.example.test'
const params = { prompt: 'fixture', width: 1280, height: 720, duration: 6 }
const calls: Array<{ url: string; init?: RequestInit }> = []
const logs: unknown[] = []
const uploads: string[] = []
const signatures: Array<{ path: string; ttl: number }> = []
let responder: (url: string, init?: RequestInit) => Response | Promise<Response>
let authUser: { id: string; email: string } | null
let submittedInput: Record<string, unknown> | undefined
let profileOwner: unknown

const service = {
  from: (table: string) => {
    assert.equal(table, 'profiles')
    return { select: () => ({ eq: (_key: string, id: string) => {
      profileOwner = id
      return { single: async () => ({ data: { id, plan: 'free', preferred_quality: '720p' } }) }
    } }) }
  },
  storage: { from: (bucket: string) => {
    assert.equal(bucket, 'sutra-assets')
    return {
      upload: async (path: string) => { uploads.push(path); return { error: null } },
      createSignedUrl: async (path: string, ttl: number) => {
        signatures.push({ path, ttl })
        return { data: { signedUrl: 'https://storage.example.test/synthetic-signed-result' }, error: null }
      },
    }
  } },
}
await mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
await mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: authUser }, error: null }) } }),
} })
await mock.module('../src/lib/ltx-helpers.ts', { namedExports: {
  logVideoGeneration: async (entry: unknown) => { logs.push(entry) },
} })
await mock.module('../src/lib/wan.ts', { namedExports: { getWanDimensions: () => ({ width: 1280, height: 720 }) } })
await mock.module('../src/lib/media-probe.ts', { namedExports: {
  assertMediaProbeAvailable: async () => {},
  // Media decoding belongs to T05. Only trust boundaries are exercised here.
  verifyVideoBytes: async () => ({ width: 1280, height: 720, duration: 6 }),
} })
await mock.module('../src/lib/pipeline-submit.ts', { namedExports: {
  submissionIdentity: (key: string) => ({ key: `${key}-fixture`, requestHash: 'synthetic' }),
  submitVideoJob: async (_profile: unknown, job: { input: Record<string, unknown> }) => {
    submittedInput = job.input
    return { id: 'fixture-job', status: 'queued' }
  },
  submissionErrorStatus: () => 500,
} })
await mock.module('../src/lib/video-worker.ts', { namedExports: {
  runVideoJob: () => { throw new Error('T02_WORKER_EXECUTION_FORBIDDEN') },
} })
await mock.module('../src/lib/video-queue.ts', { namedExports: {
  claimJobByKey: async () => null, cancelJobByKey: async () => false,
  completeQuotaForFinishedJob: async () => false, finishJob: async () => {},
} })
await mock.module('../src/lib/ltx-utils.ts', { namedExports: { clampQualityToPlan: () => '720p' } })

const local = await import('../src/lib/local-engine.ts')
const media = await import('../src/lib/private-media.ts')
const { uploadToStorage } = await import('../src/lib/storage.ts')
const { POST } = await import('../src/app/api/production/route.ts')

beforeEach(() => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = WORKER
  process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.example.test'
  calls.length = logs.length = uploads.length = signatures.length = 0
  authUser = { id: 'customer-a', email: CLIENT }
  submittedInput = undefined
  profileOwner = undefined
  responder = () => { throw new Error('T02_UNEXPECTED_FETCH') }
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    return responder(url, init)
  }
})

test('T02-P01 production: forged owner email/id/org cannot select the personal engine', async () => {
  const response = await POST(new Request('https://sutra.example.test/api/production', {
    method: 'POST', body: JSON.stringify({ step: 'script', idea: 'fixture', userEmail: OWNER,
      userId: 'owner-forged', organizationId: 'org-forged', engine: 'wan-classic' }),
  }))
  assert.equal(response.status, 202)
  assert.equal(profileOwner, 'customer-a')
  assert.equal(submittedInput?.userId, 'customer-a')
  assert.equal(submittedInput?.userEmail, CLIENT)
  assert.equal(submittedInput?.organizationId, undefined)
  assert.equal(local.shouldUseLocalEngine(submittedInput!.userEmail as string), false)
  assert.equal(calls.length, 0)
})

test('T02-P02 production: unauthenticated request rejected before JSON or queue access', async () => {
  authUser = null
  const response = await POST(new Request('https://sutra.example.test/api/production', { method: 'POST', body: '{' }))
  assert.equal(response.status, 401)
  assert.equal(submittedInput, undefined)
  assert.equal(profileOwner, undefined)
  assert.equal(calls.length, 0)
})

test('T02-P03 customer cannot reach the worker even with attacker-like configured URL', async () => {
  process.env.LOCAL_VIDEO_API_URL = 'http://169.254.169.254/latest/meta-data'
  assert.equal(await local.tryLocalRoute({ ...params, plan: 'free', quality: '720p', userEmail: CLIENT }), null)
  assert.equal(calls.length, 0)
})

for (const [name, url] of Object.entries({ credentials: 'https://u:p@worker.example.test',
  query: `${WORKER}?token=synthetic`, fragment: `${WORKER}#fragment`, protocol: 'file:///tmp/fixture' })) {
  test(`T02-P04 invalid worker URL rejects ${name} before fetch`, async () => {
    process.env.LOCAL_VIDEO_API_URL = url
    await assert.rejects(() => local.generateLocalVideo(params), /SUTRA_LOCAL_INVALID_URL/)
    assert.equal(calls.length, 0)
  })
}

test('T02-P05 foreign worker output is refused before second fetch', async () => {
  responder = () => Response.json({ video_url: 'http://169.254.169.254/latest/meta-data' })
  await assert.rejects(() => local.generateLocalVideo(params), /SUTRA_LOCAL_FOREIGN_VIDEO_URL/)
  assert.equal(calls.length, 1)
})

test('T02-P06 generation and result fetch explicitly forbid redirects', async () => {
  responder = url => url === `${WORKER}/` ? Response.json({ video_url: '/files/job-fixture.mp4' }) : new Response('fixture-bytes')
  await local.generateLocalVideo(params)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.init?.redirect === 'error'))
})

test('T02-P07 worker HTTP response body cannot leak through client error', async () => {
  responder = () => new Response(MARKER, { status: 503 })
  await assert.rejects(() => local.generateLocalVideo(params), { message: 'SUTRA_LOCAL_HTTP_503' })
})

test('T02-P08 transport error is expunged from owner route and generation log', async () => {
  responder = () => { throw new Error(MARKER) }
  await assert.rejects(() => local.tryLocalRoute({ ...params, plan: 'free', quality: '720p', userEmail: OWNER }),
    error => error instanceof Error && error.message.startsWith('SUTRA_LOCAL_FAILED:') && !error.message.includes(MARKER))
  assert.equal(logs.length, 1)
  assert.ok(!JSON.stringify(logs).includes(MARKER))
})

test('T02-P09 concurrent worker outputs with identical filenames remain owner scoped', async () => {
  const urls = await Promise.all(['owner-a', 'owner-b'].map(owner => media.withMediaOwner(owner, async () => {
    await Promise.resolve()
    return uploadToStorage('worker/job-fixture.mp4', Buffer.from('fixture'), 'video/mp4')
  })))
  assert.deepEqual(uploads.sort(), ['owners/owner-a/worker/job-fixture.mp4', 'owners/owner-b/worker/job-fixture.mp4'])
  assert.notEqual(urls[0], urls[1])
  await assert.rejects(() => media.withMediaOwner('owner-b', () => media.resolveMediaUrl(urls[0])), /SUTRA_MEDIA_ACCESS_DENIED/)
  assert.equal(signatures.length, 0)
  await media.withMediaOwner('owner-a', () => media.resolveMediaUrl(urls[0]))
  assert.deepEqual(signatures, [{ path: 'owners/owner-a/worker/job-fixture.mp4', ttl: 300 }])
})

test('T02-P10 worker output without owner context cannot touch storage', async () => {
  await assert.rejects(() => uploadToStorage('worker/job.mp4', Buffer.from('fixture'), 'video/mp4'), /SUTRA_STORAGE_UPLOAD_FAILED/)
  assert.equal(uploads.length, 0)
})

// Real adapter source, unmodified. VM intercepts imports/listen/fetch, so the test
// never creates a socket, runs ffmpeg/ffprobe, writes media, or invokes a GPU.
async function adapterFixture(upstream: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const source = await readFile(new URL('./comfyui-engine-server.mjs', import.meta.url), 'utf8')
  const messages: string[] = []
  const upstreamCalls: string[] = []
  const listeners: unknown[] = []
  type ResponseCapture = { writeHead: (code: number) => void; end: (body?: string | Buffer) => void }
  type RequestFixture = AsyncIterable<string> & { method: string; url: string; headers: Record<string, string> }
  let handler: (req: RequestFixture, res: ResponseCapture) => Promise<void>
  const forbidden = () => { throw new Error('T02_GPU_FILESYSTEM_PROCESS_FORBIDDEN') }
  const context = vm.createContext({ Buffer, URL, Error, Response, AbortSignal, FormData, Blob,
    process: { argv: ['node', 'fixture', '7861', 'http://comfy.example.test'] },
    console: { log: (...args: unknown[]) => messages.push(args.join(' ')), error: (...args: unknown[]) => messages.push(args.join(' ')) },
    setTimeout: forbidden,
    fetch: async (url: string, init?: RequestInit) => { upstreamCalls.push(url); return upstream(url, init) },
  })
  const imports: Record<string, Record<string, unknown>> = {
    'node:http': { default: { createServer: (callback: typeof handler) => {
      handler = callback
      return { listen: (port: number, host: string) => { listeners.push({ port, host }) } }
    } } },
    'node:child_process': { spawn: forbidden },
    'node:fs': { mkdirSync: forbidden, writeFileSync: forbidden },
    'node:os': { homedir: () => '/synthetic-home' },
    'node:path': { join: (...parts: string[]) => parts.join('/') },
  }
  const adapterModule = new vm.SourceTextModule(source, { context })
  await adapterModule.link(specifier => {
    const exports = imports[specifier]
    assert.ok(exports, `Unexpected adapter import: ${specifier}`)
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context })
  })
  await adapterModule.evaluate()
  return { messages, upstreamCalls, listeners, request: async (method: string, url: string, body = '{}') => {
    let status = 0, responseBody = ''
    const req: RequestFixture = { method, url, headers: {}, async *[Symbol.asyncIterator]() { yield body } }
    await handler(req, { writeHead: code => { status = code }, end: value => { responseBody = String(value ?? '') } })
    return { status, body: responseBody }
  } }
}

test('T02-P11 historical adapter binds loopback only (no public exposure proven)', async () => {
  const adapter = await adapterFixture(() => { throw new Error('unexpected') })
  assert.deepEqual(adapter.listeners, [{ port: 7861, host: '127.0.0.1' }])
})

// Desired REMOTE security properties below. Failures are evidence for T04/T01;
// they do not assert that the historical loopback adapter is internet-facing.
for (const [name, url] of Object.entries({ plaintext: 'http://worker.example.test', metadata: 'http://169.254.169.254/latest/meta-data' })) {
  test(`T02-S01 remote configuration must reject ${name} destination before health fetch`, async () => {
    process.env.LOCAL_VIDEO_API_URL = url
    responder = () => new Response('ok')
    await local.probeLocalEngine()
    assert.equal(calls.length, 0, 'Unsafe remote destination reached the mocked transport')
  })
}

test('T02-S02 remote generation/result requests require server authentication', async () => {
  responder = url => url === `${WORKER}/` ? Response.json({ video_url: '/files/job.mp4' }) : new Response('fixture')
  await local.generateLocalVideo(params)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    const headers = new Headers(call.init?.headers)
    assert.ok(headers.has('authorization') || headers.has('salad-api-key'), 'Worker call has no server authentication')
  }
})

for (const endpoint of ['/', '/upscale']) {
  test(`T02-S03 remote adapter rejects unauthenticated POST ${endpoint} before ComfyUI`, async () => {
    const adapter = await adapterFixture(() => { throw new Error('synthetic-stop-before-compute') })
    const response = await adapter.request('POST', endpoint, JSON.stringify({ prompt: 'fixture', input_file: 'someone-elses.mp4' }))
    assert.deepEqual({ status: response.status, upstreamCalls: adapter.upstreamCalls.length }, { status: 401, upstreamCalls: 0 })
  })
}

test('T02-S04 remote results reject unauthenticated arbitrary file lookup', async () => {
  const adapter = await adapterFixture(() => new Response('OTHER_OWNER_SYNTHETIC_OUTPUT'))
  const response = await adapter.request('GET', '/files?filename=other-job.mp4&subfolder=other-owner&type=output')
  assert.equal(response.status, 401, 'Arbitrary ComfyUI result was returned without owner/job authentication')
  assert.equal(adapter.upstreamCalls.length, 0)
})

for (const endpoint of ['/health', '/files?filename=fixture.mp4', '/']) {
  test(`T02-S05 remote adapter expunges synthetic upstream error on ${endpoint}`, async () => {
    const adapter = await adapterFixture(() => { throw new Error(MARKER) })
    const response = await adapter.request(endpoint === '/' ? 'POST' : 'GET', endpoint)
    assert.deepEqual({ responseLeak: response.body.includes(MARKER), logLeak: adapter.messages.join(' ').includes(MARKER) },
      { responseLeak: false, logLeak: false }, 'Raw upstream errors must stay out of responses and logs')
  })
}
