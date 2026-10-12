import test, { mock as nodeMock } from 'node:test'
import assert from 'node:assert/strict'
import type { LtxJob, LtxExecution } from '../src/lib/ltx-v2.ts'
nodeMock.module('../src/lib/media-download.ts', { namedExports: {
  downloadMediaBytes: fixtureDownload, downloadVideoBytes: fixtureDownload,
} })
async function fixtureDownload(url: string) {
  const res = await globalThis.fetch(url)
  if (!res.ok) throw new Error('fixture download failure')
  return Buffer.from(await res.arrayBuffer())
}
const { LtxJobError } = await import('../src/lib/ltx-v2.ts')
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-only'
process.env.LTX_API_KEY = 'test-only'
const { generateVideoSmart, retakeVideo, extendVideo } = await import('../src/lib/ltx.ts')
const { generateMusicWithFallback, generateMusicWithProvenance, generateVoiceWithProvenance, generateVisualWithFallback, ProviderOperationError } = await import('../src/lib/fallbacks.ts')
const { submitVideoJob, pollVideoJob, RunpodJobError } = await import('../src/lib/runpod.ts')
const { generateWanVideo } = await import('../src/lib/wan.ts')
const { cheapestCapableEngines } = await import('../src/lib/provider-pricing.ts')
let calls: Array<{ url: string; init?: RequestInit }> = []
function mock(handler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => { throw new Error('lost response') }) {
  calls = []
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return handler(String(url), init) }
}
function execution(): LtxExecution {
  const rows = new Map<string, LtxJob>()
  return { operationKey: 'scene', store: {
    async load(key) { return rows.get(key) ?? null },
    async compareAndSet(key, r, next) {
      if (r === null ? rows.has(key) : rows.get(key)?.revision !== r) return false
      rows.set(key, structuredClone(next)); return true
    },
  } }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('smart: missing durable context, insufficient plan, long scene and lost reference fail before spend', async () => {
  mock()
  await assert.rejects(generateVideoSmart('p', 'creator', null), /DURABLE_CONTEXT/)
  await assert.rejects(generateVideoSmart('p', 'creator', null, { userId: 'user', videoId: 'video' }), /DURABLE_CONTEXT/)
  await assert.rejects(generateVideoSmart('p', 'starter', null, { quality: '4k' }), /EXCEEDS_PLAN/)
  await assert.rejects(generateVideoSmart('p', 'enterprise', null, { duration: 12 }), /SCENE_SPLIT/)
  await assert.rejects(generateVideoSmart('p', 'free', null, { imageUri: 'https://input.test/i.png' }), /UNSUPPORTED_REFERENCE/)
  await assert.rejects(generateVideoSmart('p', 'creator', null, { lastFrameUri: 'https://input.test/i.png' }), /REQUIRES_FIRST_FRAME/)
  assert.equal(calls.length, 0)
})

test('smart paid timeout never invokes WAN and restart reuses submission barrier', async () => {
  mock()
  const context = execution()
  for (let i = 0; i < 2; i++) await assert.rejects(generateVideoSmart('p', 'creator', null, { execution: context }))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.ltx.io/v2/text-to-video')
})

test('visual fallback never converts an uncertain paid outcome to stock or WAN', async () => {
  mock()
  await assert.rejects(generateVisualWithFallback('p', '720p', null, 'creator', '16:9', false, { execution: execution() }))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.ltx.io/v2/text-to-video')
})

test('existing LTX intent or execution never becomes stock when credentials or plan change', async () => {
  delete process.env.LTX_API_KEY
  delete process.env.RUNPOD_API_KEY
  delete process.env.RUNPOD_ENDPOINT_ID
  process.env.PEXELS_API_KEY = 'test-only'
  try {
    for (const plan of ['creator', 'free'] as const) {
      for (const track of [
        { job: { current: { endpoint: '/text-to-video', fingerprint: 'legacy', started: true as const, id: 'paid-job' }, save: async () => {} } },
        { execution: execution() },
      ]) {
        mock(() => json({ videos: [] }))
        await assert.rejects(generateVisualWithFallback('p', '720p', null, plan, '16:9', false, track))
        assert.equal(calls.length, 0, `no stock or new provider request for ${plan}`)
      }
    }
  } finally { process.env.LTX_API_KEY = 'test-only'; delete process.env.PEXELS_API_KEY }
})

test('a configured WAN cannot replace an explicit LTX execution', async () => {
  process.env.RUNPOD_API_KEY = 'test-only'; process.env.RUNPOD_ENDPOINT_ID = 'test-endpoint'
  mock()
  try {
    await assert.rejects(generateVideoSmart('p', 'free', null, { execution: execution() }), /RESUME_CONFLICT/)
    assert.equal(calls.length, 0)
  } finally { delete process.env.RUNPOD_API_KEY; delete process.env.RUNPOD_ENDPOINT_ID }
})

test('smart: source provenance includes job/cost/timeout/quota, excludes signed output URL', async () => {
  const T = '2026-10-12T10:00:00.000Z'
  mock((url, init) => init?.method === 'POST' ? json({ id: 'job-smart', created_at: T }, 202) : url.startsWith('https://api.ltx.io') ? json({ id: 'job-smart', created_at: T, completed_at: T, status: 'completed', result: { video_url: 'https://output.test/v.mp4?signature=redacted' } }) : new Response(new Uint8Array([1])))
  const result = await generateVideoSmart('p', 'creator', null, { execution: execution(), duration: 5 })
  assert.equal(result.engine, 'ltx-fast'); assert.equal(result.duration, 6)
  assert.equal(result.provenance?.id, 'job-smart')
  assert.equal(result.provenance?.remoteStatus, 'completed')
  assert.equal(result.provenance?.cost.estimated, 0.36)
  assert.equal(result.provenance?.cost.actual, null)
  assert.equal(result.provenance?.timeoutMs, 300_000)
  assert.equal(result.provenance?.quota.remaining, null)
  assert.ok(!JSON.stringify(result.provenance).includes('signature'))
})

test('retake and extend wrappers use real editing endpoints, never seed/last-frame regeneration', async () => {
  for (const [fn, body, endpoint] of [
    [retakeVideo, { video_uri: 'https://input.test/v.mp4', start_time: 1, duration: 2 }, 'retake'],
    [extendVideo, { video_uri: 'https://input.test/v.mp4', duration: 3, context: 2 }, 'extend'],
  ] as const) {
    mock()
    await assert.rejects(fn(body as never, { ...execution(), inputMedia: { width: 1920, height: 1080, fps: 24, durationSeconds: 8 } }))
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, `https://api.ltx.io/v2/${endpoint}`)
    const payload = JSON.parse(String(calls[0].init?.body))
    assert.equal(payload.video_uri, body.video_uri); assert.ok(!('seed' in payload)); assert.ok(!('image_uri' in payload))
  }
})

test('music: no configured provider means explicit error, never empty success', async () => {
  delete process.env.SUNO_API_KEY; delete process.env.RIFFUSION_API_KEY; delete process.env.REPLICATE_API_TOKEN
  mock()
  await assert.rejects(generateMusicWithFallback('p', 'calm', 10), /NOT_CONFIGURED/)
  assert.equal(calls.length, 0)
})

test('music: failed primary submission never cascades to other paid providers', async () => {
  process.env.SUNO_API_KEY = 'test-only'; process.env.RIFFUSION_API_KEY = 'test-only'; process.env.REPLICATE_API_TOKEN = 'test-only'
  mock()
  await assert.rejects(generateMusicWithFallback('p', 'calm', 10), /PROVIDER_RESULT_UNKNOWN/)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.includes('suno'))
})

test('quality/cost selection: absent configuration excluded, invalid/too-long duration never underdelivered', () => {
  delete process.env.LTX_API_KEY; delete process.env.RUNPOD_API_KEY; delete process.env.RUNPOD_ENDPOINT_ID
  assert.deepEqual(cheapestCapableEngines({ format: '16:9', quality: '4k', durationSeconds: 6 }), [])
  process.env.LTX_API_KEY = 'test-only'
  const params = { format: '16:9', quality: '4k', durationSeconds: 6 } as const
  assert.deepEqual(cheapestCapableEngines(params).map(c => c.engine.id), ['ltx-2-3-fast', 'ltx-2-3-pro'])
  assert.deepEqual(cheapestCapableEngines({ ...params, durationSeconds: 12 }), [])
  assert.deepEqual(cheapestCapableEngines({ ...params, durationSeconds: NaN }), [])
  assert.deepEqual(cheapestCapableEngines({ ...params, durationSeconds: -1 }), [])
})


for (const status of ['FAILED', 'CANCELLED', 'TIMED_OUT']) {
  test(`RunPod: terminal ${status} retains job and never invokes retry/cancel`, async () => {
    process.env.RUNPOD_API_KEY = 'test-only'; process.env.RUNPOD_ENDPOINT_ID = 'endpoint-test'
    mock(() => json({ id: 'wan-job', status, error: 'private-input-never-logged' }))
    await assert.rejects(pollVideoJob('wan-job'), (e) => {
      assert.ok(e instanceof RunpodJobError); assert.equal(e.provenance.id, 'wan-job')
      assert.equal(e.provenance.remoteStatus, status); assert.equal(e.retrySubmission, false)
      assert.ok(!e.message.includes('private-input')); return true
    })
    assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/status/wan-job'))
    assert.equal(calls[0].init?.cache, 'no-store')
  })
}

test('RunPod: network/unknown status/404/local timeout retain remote identity for explicit resumption', async () => {
  for (const response of [null, json({ status: 'new-state' }), json({}, 404), json({ status: 'IN_PROGRESS' })]) {
    mock(() => { if (!response) throw new Error('lost'); return response })
    await assert.rejects(pollVideoJob('wan-job', undefined, 1), (e) => {
      assert.ok(e instanceof RunpodJobError); assert.equal(e.provenance.id, 'wan-job'); assert.equal(e.retrySubmission, false); return true
    })
    assert.ok(calls.length <= 1); assert.ok(calls.every(c => c.init?.method !== 'POST'))
  }
})

test('RunPod: uncertain submit is one request with explicit unknown outcome', async () => {
  mock()
  await assert.rejects(submitVideoJob({ prompt: 'p' }), (e) => {
    assert.ok(e instanceof RunpodJobError); assert.equal(e.code, 'SUBMISSION_UNKNOWN')
    assert.equal(e.provenance.id, null); assert.equal(e.retrySubmission, false); return true
  })
  assert.equal(calls.length, 1)
})

test('WAN: success carries job/status/unknown GPU cost; download failure resumes that job', async () => {
  for (const failedDownload of [false, true]) {
    mock((url, init) => init?.method === 'POST' ? json({ id: 'wan-job', status: 'IN_QUEUE' }) : url.includes('/status/') ? json({ id: 'wan-job', status: 'COMPLETED', output: { video_url: 'https://output.test/wan.mp4' } }) : failedDownload ? json({}, 403) : new Response(new Uint8Array([1, 2])))
    const operation = generateWanVideo({ prompt: 'p', userEmail: null })
    if (failedDownload) await assert.rejects(operation, (e) => {
      assert.ok(e instanceof RunpodJobError); assert.equal(e.provenance.id, 'wan-job'); assert.equal(e.provenance.remoteStatus, 'COMPLETED'); return true
    })
    else {
      const result = await operation
      assert.equal(result.provenance.id, 'wan-job'); assert.equal(result.provenance.remoteStatus, 'COMPLETED')
      assert.equal(result.provenance.cost.estimated, null); assert.equal(result.provenance.cost.actual, null)
      assert.equal(result.provenance.quota.remaining, null); assert.equal(result.native4k, false)
    }
    assert.equal(calls.filter(c => c.init?.method === 'POST').length, 1)
    assert.equal(calls[2].init?.headers, undefined)
  }
})


test('music: legacy URL API never silently substitutes another configured provider', async () => {
  delete process.env.SUNO_API_KEY
  process.env.RIFFUSION_API_KEY = 'test-only'; process.env.REPLICATE_API_TOKEN = 'test-only'
  mock()
  await assert.rejects(generateMusicWithFallback('p', 'calm', 10), /NOT_CONFIGURED/)
  assert.equal(calls.length, 0)
  mock(() => json({ id: 'prediction', status: 'succeeded', output: 'https://output.test/music.mp3' }))
  const result = await generateMusicWithProvenance('p', 'calm', 10, 'stable-audio')
  assert.equal(result.provider, 'stable-audio'); assert.equal(result.cost.actual, null)
  assert.equal(result.contractStatus, 'legacy_not_live_verified'); assert.equal(calls.length, 1)
})


test('voice/music: uncertain spend is permanent for the existing queue, with safe provenance', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-only'; process.env.SUNO_API_KEY = 'test-only'
  for (const run of [() => generateVoiceWithProvenance('p', 'voice-id'), () => generateMusicWithProvenance('p', 'calm', 10, 'suno')]) {
    mock()
    await assert.rejects(run(), (e) => {
      assert.ok(e instanceof ProviderOperationError)
      assert.equal(e.retrySubmission, false); assert.equal(e.remoteStatus, 'unknown'); assert.equal(e.cost.actual, null); return true
    })
    assert.equal(calls.length, 1)
  }
  mock(() => new Response(new Uint8Array([1, 2])))
  const voice = await generateVoiceWithProvenance('p', 'voice-id')
  assert.equal(voice.provider, 'elevenlabs'); assert.equal(voice.remoteStatus, 'completed'); assert.equal(voice.cost.actual, null)
})

test('visual: storage failure after paid WAN/LTX success retains job, never generates a fallback', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only'
  process.env.RUNPOD_API_KEY = 'test-only'; process.env.RUNPOD_ENDPOINT_ID = 'endpoint-test'
  process.env.LTX_API_KEY = 'test-only'
  for (const plan of ['free', 'creator'] as const) {
    const T = '2026-10-12T10:00:00.000Z'
    mock((url, init) => {
      if (url.startsWith('https://database.invalid/')) return json({ message: 'private-storage-failure' }, 403)
      if (url.includes('runpod.ai')) return url.includes('/status/')
        ? json({ id: 'wan-upload', status: 'COMPLETED', output: 'https://output.test/v.mp4' })
        : json({ id: 'wan-upload', status: 'IN_QUEUE' })
      if (url.includes('api.ltx.io')) return init?.method === 'POST'
        ? json({ id: 'ltx-upload', created_at: T }, 202)
        : json({ id: 'ltx-upload', created_at: T, completed_at: T, status: 'completed', result: { video_url: 'https://output.test/v.mp4' } })
      if (url.startsWith('https://output.test/')) return new Response(new Uint8Array([1]))
      throw new Error('unexpected network')
    })
    await assert.rejects(generateVisualWithFallback('p', '720p', null, plan, '16:9', false, plan === 'creator' ? { execution: execution() } : {}), (e) => {
      assert.ok(e instanceof RunpodJobError || e instanceof LtxJobError)
      assert.ok(e.code.includes('UPLOAD_FAILED_RESUME_SAME_JOB')); assert.equal(e.fallbackAllowed, false)
      assert.ok(!e.message.includes('private-storage-failure'))
      if (e instanceof RunpodJobError) { assert.equal(e.provenance.id, 'wan-upload') }
      else assert.equal(e.job?.id, 'ltx-upload')
      return true
    })
    assert.equal(calls.filter(c => c.init?.method === 'POST' && !c.url.includes('database.invalid')).length, 1)
  }
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})
