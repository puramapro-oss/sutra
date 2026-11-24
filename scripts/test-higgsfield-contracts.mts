import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HiggsfieldError, compareHiggsfieldUsd, parseHiggsfieldUsd,
  validateHiggsfieldCinemaRequest, validateHiggsfieldIdempotencyKey,
} from '../src/lib/higgsfield-contract.ts'
import {
  createHiggsfieldClient, higgsfieldRequestFingerprint,
  type HiggsfieldEstimate, type HiggsfieldRequestHandle, type HiggsfieldSubmissionOptions,
} from '../src/lib/higgsfield.ts'

// Every transport is injected. These tests cannot generate paid media.
const ORIGIN = 'https://api.higgsfield.ai'
const ENDPOINT = ORIGIN + '/higgsfield/cinema-studio/4.0'
const REQUEST_ID = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff'
const KEY = 'intent-persisted-by-caller-1'
const CREDENTIALS = 'offline-key:offline-secret'
const INPUT = { prompt: 'A quiet invented city at sunrise.', duration: 5, resolution: '720p' }
const HANDLE: HiggsfieldRequestHandle = {
  requestId: REQUEST_ID,
  statusUrl: ORIGIN + '/requests/' + REQUEST_ID + '/status',
  cancelUrl: ORIGIN + '/requests/' + REQUEST_ID + '/cancel',
}
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const accepted = (extra: Record<string, unknown> = {}, status = 200) => json({
  request_id: REQUEST_ID, status: 'queued', status_url: HANDLE.statusUrl,
  cancel_url: HANDLE.cancelUrl, expires_after: 604800, ...extra,
}, status)
const quoteResponse = (usd = '0.1000') => json({ usd })
type Step = Response | Error | ((url: string, init?: RequestInit) => Response | Promise<Response>)
function harness(steps: Step[]) {
  let time = Date.parse('2026-11-11T12:00:00.000Z')
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const client = createHiggsfieldClient({
    credentials: CREDENTIALS, now: () => time,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init })
      const next = steps.shift()
      if (next instanceof Error) throw next
      assert.ok(next, 'Unexpected HTTP request: no live fallback exists')
      return typeof next === 'function' ? next(String(url), init) : next
    },
  })
  return { client, calls, advance: (ms: number) => { time += ms } }
}
function execution(estimate: HiggsfieldEstimate, patch: Partial<HiggsfieldSubmissionOptions> = {}): HiggsfieldSubmissionOptions {
  return {
    estimate, budget: { approved: true, maxUsd: '0.10' },
    intent: { idempotencyKey: KEY, fingerprint: estimate.fingerprint },
    ...patch,
  }
}
const code = (expected: string) => (error: unknown) => {
  assert.ok(error instanceof HiggsfieldError)
  assert.equal(error.code, expected)
  assert.equal(error.retrySubmission, false)
  assert.equal(error.fallbackAllowed, false)
  return true
}
function safeError(error: unknown, expected: string) {
  assert.ok(error instanceof HiggsfieldError)
  assert.equal(error.code, expected)
  const display = String(error) + JSON.stringify(error) + (error.stack ?? '')
  for (const secret of [CREDENTIALS, 'signed-url-secret', 'provider-body-secret']) {
    assert.ok(!display.includes(secret), 'Sensitive data leaked through an error')
  }
  assert.ok(!('cause' in error))
  return error
}

test('Cinema schema preserves omissions, accepts exact control values and typed references', () => {
  assert.deepEqual(validateHiggsfieldCinemaRequest({ prompt: 'Ocean' }), { prompt: 'Ocean' })
  const input = {
    prompt: '<<<image_2>>> walks with <<<video_1>>> and <<<audio_1>>>.',
    duration: 30, resolution: '480p', aspect_ratio: '21:9', generate_audio: false,
    image_urls: ['https://media.test/a.png', 'https://media.test/b.png?token=signed-url-secret'],
    video_urls: ['https://media.test/a.mp4'], audio_urls: ['https://media.test/a.wav'],
    era: '1960s', genre: 'noir', light: 'contre-jour', pacing: 'single-shot',
    camera_lens: 'vintage-anamorphic', camera_model: '35mm-film',
    camera_aperture: 'f14-wide-open', camera_movement: 'aerial-pullback',
    color_palette: 'twilight-fable',
  }
  assert.deepEqual(validateHiggsfieldCinemaRequest(input), input)
})

test('Cinema rejects unsupported fields, web-only resolution, coercion, auto and invalid durations', () => {
  for (const patch of [
    { seed: 1 }, { mode: 'video_edit' }, { model: 'cinematic_studio_video_4_0' },
    { resolution: '1080p' }, { resolution: '4K' }, { duration: 3 }, { duration: 31 },
    { duration: 4.5 }, { duration: '5' }, { duration: NaN }, { duration: Infinity },
    { generate_audio: 'true' }, { genre: 'general' }, { genre: 'auto' },
    { camera_movement: 'dolly_in' }, { camera_aperture: 'f/4' },
    { color_palette: 'unverified' }, { prompt: '' }, { prompt: ' \n\t' }, { prompt: null },
  ]) assert.throws(() => validateHiggsfieldCinemaRequest({ ...INPUT, ...patch }), code('HIGGSFIELD_INVALID_REQUEST'))
})

test('reference tokens enforce one-based indices, media types and complete delimiters', () => {
  for (const prompt of [
    '<<<image_0>>>', '<<<image_2>>>', '<<<video_1>>>', '<<<audio_1>>>',
    '<<<image_-1>>>', '<<<image_01>>>', '<<<image_1.0>>>', '<<<unknown_1>>>',
    '<<<image_9007199254740993>>>', '<<<image_1', 'image_1>>>', '<<< image_1>>>',
  ]) {
    assert.throws(() => validateHiggsfieldCinemaRequest({
      prompt, image_urls: ['https://media.test/a.png'],
    }), code('HIGGSFIELD_INVALID_REQUEST'))
  }
})

test('reference arrays respect the published per-type and aggregate bounds', () => {
  const input = {
    prompt: '<<<image_30>>> with <<<video_10>>> and <<<audio_10>>>',
    image_urls: Array.from({ length: 30 }, (_, i) => 'https://media.test/' + i + '.png'),
    video_urls: Array.from({ length: 10 }, (_, i) => 'https://media.test/' + i + '.mp4'),
    audio_urls: Array.from({ length: 10 }, (_, i) => 'https://media.test/' + i + '.wav'),
  }
  assert.deepEqual(validateHiggsfieldCinemaRequest(input), input)
  for (const name of ['image_urls', 'video_urls', 'audio_urls'] as const) {
    assert.throws(() => validateHiggsfieldCinemaRequest({
      ...input, [name]: [...input[name], 'https://media.test/extra'],
    }), code('HIGGSFIELD_INVALID_REQUEST'))
  }
})

test('invalid reference URLs and input accessor exceptions are redacted', () => {
  for (const url of [
    'http://media.test/a.png', 'file:///secret', 'data:image/png;base64,aaaa',
    'https://user:provider-body-secret@media.test/a.png', 'https://media.test/a.png#secret',
    ' https://media.test/a.png', 'https://media.test/a\n.png',
  ]) assert.throws(() => validateHiggsfieldCinemaRequest({ prompt: url, image_urls: [url] }), code('HIGGSFIELD_INVALID_REQUEST'))
  assert.throws(() => validateHiggsfieldCinemaRequest({
    get prompt() { throw new Error(CREDENTIALS) },
  }), (e) => Boolean(safeError(e, 'HIGGSFIELD_INVALID_REQUEST')))
})

test('USD parsing and comparison never round through a JavaScript number', () => {
  assert.equal(parseHiggsfieldUsd('0001.23000'), '1.23')
  assert.equal(parseHiggsfieldUsd('000.000'), '0')
  assert.equal(compareHiggsfieldUsd('0.300000000000000001', '0.3'), 1)
  assert.equal(compareHiggsfieldUsd('9007199254740993.01', '9007199254740992.99'), 1)
  assert.equal(compareHiggsfieldUsd('1.100', '1.10'), 0)
  assert.equal(compareHiggsfieldUsd('0.999999999999999999', '1'), -1)
  for (const bad of [1, null, '', ' 1', '1 ', '-1', '1e-2', '.1', '1.', 'NaN', 'Infinity', '9'.repeat(257)]) {
    assert.throws(() => parseHiggsfieldUsd(bad), code('HIGGSFIELD_INVALID_USD'))
  }
})

test('fingerprints preserve exact request identity across key order, omissions, arrays and retention', () => {
  assert.equal(higgsfieldRequestFingerprint(INPUT), higgsfieldRequestFingerprint({
    resolution: '720p', duration: 5, prompt: INPUT.prompt,
  }))
  assert.notEqual(higgsfieldRequestFingerprint({ prompt: 'Ocean' }), higgsfieldRequestFingerprint({ prompt: 'Ocean', duration: 5 }))
  const media = ['https://media.test/one.png', 'https://media.test/two.png']
  assert.notEqual(higgsfieldRequestFingerprint({ prompt: 'Ocean', image_urls: media }),
    higgsfieldRequestFingerprint({ prompt: 'Ocean', image_urls: [...media].reverse() }))
  assert.notEqual(higgsfieldRequestFingerprint(INPUT), higgsfieldRequestFingerprint(INPUT, { expiresAfterSeconds: 3600 }))
  for (const expiresAfterSeconds of [3599, 604801, 3600.5, NaN]) {
    assert.throws(() => higgsfieldRequestFingerprint(INPUT, { expiresAfterSeconds }), code('HIGGSFIELD_INVALID_RETENTION'))
  }
})

test('idempotency keys are caller supplied visible ASCII, with no automatic repair', () => {
  assert.equal(validateHiggsfieldIdempotencyKey('a'.repeat(255)), 'a'.repeat(255))
  for (const key of ['', undefined, null, 'a'.repeat(256), 'white space', 'bad\nheader', 'é']) {
    assert.throws(() => validateHiggsfieldIdempotencyKey(key), code('HIGGSFIELD_INVALID_IDEMPOTENCY_KEY'))
  }
})

test('server guard and credential validation fail before transport', () => {
  for (const credentials of ['', 'Bearer secret', 'secret\ninjection']) {
    assert.throws(() => createHiggsfieldClient({ credentials }), code('HIGGSFIELD_CREDENTIALS_REQUIRED'))
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  try {
    assert.throws(() => createHiggsfieldClient({ credentials: CREDENTIALS }), code('HIGGSFIELD_SERVER_ONLY'))
    assert.throws(() => higgsfieldRequestFingerprint(INPUT), code('HIGGSFIELD_SERVER_ONLY'))
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('estimate uses the estimate route, exact JSON, Key auth and a frozen truthful quote', async () => {
  const h = harness([quoteResponse()])
  const quote = await h.client.estimate(INPUT)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, ORIGIN + '/estimate/higgsfield/cinema-studio/4.0')
  assert.deepEqual(JSON.parse(String(h.calls[0].init?.body)), INPUT)
  assert.equal(new Headers(h.calls[0].init?.headers).get('Authorization'), 'Key ' + CREDENTIALS)
  assert.equal(new Headers(h.calls[0].init?.headers).get('Idempotency-Key'), null)
  assert.equal(h.calls[0].init?.cache, 'no-store')
  assert.equal(h.calls[0].init?.redirect, 'error')
  assert.equal(h.calls[0].init?.credentials, 'omit')
  assert.equal(quote.usd, '0.1')
  assert.equal(quote.actualUsd, null)
  assert.equal(quote.fingerprint, higgsfieldRequestFingerprint(INPUT))
  assert.ok(Object.isFrozen(quote))
})

test('missing, refused, malformed and insufficient budgets block the paid POST', async () => {
  const h = harness([quoteResponse('0.300000000000000001')])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, undefined as never), code('HIGGSFIELD_BUDGET_REQUIRED'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { budget: { approved: false } })), code('HIGGSFIELD_BUDGET_NOT_AUTHORIZED'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { budget: { approved: true, maxUsd: 'NaN' } })), code('HIGGSFIELD_INVALID_BUDGET'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { budget: { approved: true, maxUsd: '0.3' } })), code('HIGGSFIELD_BUDGET_EXCEEDED'))
  assert.equal(h.calls.length, 1)
})

test('foreign, forged, changed and expired estimates never authorize submission', async () => {
  const h = harness([quoteResponse()])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution({ ...quote })), code('HIGGSFIELD_ESTIMATE_REQUIRED'))
  const other = harness([])
  await assert.rejects(other.client.submit(INPUT, execution(quote)), code('HIGGSFIELD_ESTIMATE_REQUIRED'))
  await assert.rejects(h.client.submit({ ...INPUT, prompt: 'changed' }, execution(quote)), code('HIGGSFIELD_ESTIMATE_MISMATCH'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { expiresAfterSeconds: 3600 })), code('HIGGSFIELD_ESTIMATE_MISMATCH'))
  h.advance(60_000)
  await assert.rejects(h.client.submit(INPUT, execution(quote)), code('HIGGSFIELD_ESTIMATE_EXPIRED'))
  assert.equal(h.calls.length, 1)
  assert.equal(other.calls.length, 0)
})

test('a persisted intent fingerprint and valid key are mandatory', async () => {
  const h = harness([quoteResponse()])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution(quote, { intent: undefined as never })), code('HIGGSFIELD_DURABLE_INTENT_REQUIRED'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { intent: { idempotencyKey: KEY, fingerprint: '0'.repeat(64) } })), code('HIGGSFIELD_DURABLE_INTENT_REQUIRED'))
  await assert.rejects(h.client.submit(INPUT, execution(quote, { intent: { idempotencyKey: 'bad\nkey', fingerprint: quote.fingerprint } })), code('HIGGSFIELD_INVALID_IDEMPOTENCY_KEY'))
  assert.equal(h.calls.length, 1)
})

test('submission and successive GETs keep one request and expose output without downloading it', async () => {
  const h = harness([
    quoteResponse(), accepted(),
    json({ request_id: REQUEST_ID, status: 'queued' }),
    json({ request_id: REQUEST_ID, status: 'in_progress' }),
    json({ request_id: REQUEST_ID, status: 'completed',
      video: { url: 'https://media.test/output.mp4?token=signed-url-secret' },
      expires_at: '2026-11-18T12:00:00.000Z' }),
  ])
  const quote = await h.client.estimate(INPUT)
  const receipt = await h.client.submit(INPUT, execution(quote))
  assert.equal(receipt.requestId, REQUEST_ID)
  assert.equal(receipt.expiresAfterSeconds, 604800)
  assert.equal(h.calls[1].url, ENDPOINT)
  assert.equal(new Headers(h.calls[1].init?.headers).get('Idempotency-Key'), KEY)
  assert.equal((await h.client.poll(receipt)).terminal, false)
  assert.equal((await h.client.poll(receipt)).status, 'in_progress')
  const final = await h.client.poll(receipt)
  assert.equal(final.terminal, true)
  assert.equal(final.videoUrl, 'https://media.test/output.mp4?token=signed-url-secret')
  assert.equal(final.expiresAt, '2026-11-18T12:00:00.000Z')
  assert.equal(h.calls.length, 5, 'the adapter does not download or resubmit')
  for (const call of h.calls) {
    assert.equal(new URL(call.url).origin, ORIGIN)
    assert.equal(call.init?.redirect, 'error')
    assert.equal(call.init?.cache, 'no-store')
  }
})

test('explicit same-intent replay keeps the key, JSON and request ID; receipt status may still be queued', async () => {
  const h = harness([quoteResponse(), accepted({}, 202), accepted(), json({
    request_id: REQUEST_ID, status: 'completed', video: { url: 'https://media.test/output.mp4' },
  })])
  const quote = await h.client.estimate(INPUT)
  const first = await h.client.submit(INPUT, execution(quote))
  const replay = await h.client.submit(INPUT, execution(quote))
  assert.equal(replay.requestId, first.requestId)
  assert.equal(replay.status, 'queued')
  assert.equal(h.calls[1].init?.body, h.calls[2].init?.body)
  assert.equal(new Headers(h.calls[2].init?.headers).get('Idempotency-Key'), KEY)
  assert.equal((await h.client.poll(replay)).status, 'completed')
})

test('one quote cannot fund another key, and one key cannot change request fingerprint', async () => {
  const h = harness([quoteResponse(), accepted(), quoteResponse()])
  const quote = await h.client.estimate(INPUT)
  await h.client.submit(INPUT, execution(quote))
  await assert.rejects(h.client.submit(INPUT, execution(quote, {
    intent: { idempotencyKey: 'another-intent', fingerprint: quote.fingerprint },
  })), code('HIGGSFIELD_ESTIMATE_ALREADY_USED'))
  const changed = { ...INPUT, prompt: 'Changed scene' }
  const newQuote = await h.client.estimate(changed)
  await assert.rejects(h.client.submit(changed, execution(newQuote)), code('HIGGSFIELD_IDEMPOTENCY_CONFLICT'))
  assert.equal(h.calls.filter(c => c.url === ENDPOINT).length, 1)
})

test('lost response never causes an automatic retry; explicit replay uses the identical key', async () => {
  const h = harness([quoteResponse(), new Error('provider-body-secret ' + CREDENTIALS), accepted()])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution(quote)), (error) => {
    assert.equal(safeError(error, 'HIGGSFIELD_NETWORK_ERROR').submissionUncertain, true)
    return true
  })
  assert.equal(h.calls.length, 2)
  assert.equal((await h.client.submit(INPUT, execution(quote))).requestId, REQUEST_ID)
  assert.equal(h.calls[1].init?.body, h.calls[2].init?.body)
  assert.equal(new Headers(h.calls[2].init?.headers).get('Idempotency-Key'), KEY)
})

for (const status of [401, 403, 408, 409, 422, 423, 429, 502, 503]) {
  test('HTTP ' + status + ' is redacted, preserved and never automatically retried', async () => {
    const h = harness([quoteResponse(), json({
      detail: 'provider-body-secret ' + CREDENTIALS + ' https://media.test/?token=signed-url-secret',
    }, status, { 'Retry-After': '12' })])
    const quote = await h.client.estimate(INPUT)
    await assert.rejects(h.client.submit(INPUT, execution(quote)), (error) => {
      const failure = safeError(error, 'HIGGSFIELD_HTTP_ERROR')
      assert.equal(failure.httpStatus, status)
      assert.equal(failure.submissionUncertain, [408, 409, 423].includes(status) || status >= 500)
      assert.equal(failure.retryAfterSeconds, 12)
      return true
    })
    assert.equal(h.calls.length, 2)
  })
}

for (const [name, url] of [
  ['other origin', 'https://attacker.test/requests/' + REQUEST_ID + '/status'],
  ['suffix host', 'https://api.higgsfield.ai.attacker.test/requests/' + REQUEST_ID + '/status'],
  ['userinfo', 'https://api.higgsfield.ai@attacker.test/requests/' + REQUEST_ID + '/status'],
  ['credentials', 'https://secret@api.higgsfield.ai/requests/' + REQUEST_ID + '/status'],
  ['port', 'https://api.higgsfield.ai:8443/requests/' + REQUEST_ID + '/status'],
  ['query', HANDLE.statusUrl + '?token=signed-url-secret'],
  ['fragment', HANDLE.statusUrl + '#fragment'],
  ['other request', ORIGIN + '/requests/00000000-0000-0000-0000-000000000000/status'],
  ['wrong path', ORIGIN + '/requests/' + REQUEST_ID + '/cancel'],
]) {
  test('untrusted status URL rejected without sending credentials: ' + name, async () => {
    const h = harness([])
    await assert.rejects(h.client.poll({ ...HANDLE, statusUrl: url }), code('HIGGSFIELD_INVALID_REQUEST_HANDLE'))
    assert.equal(h.calls.length, 0)
  })
}

test('an unsafe cancel URL is blocked before transport', async () => {
  const h = harness([])
  await assert.rejects(h.client.cancel({ ...HANDLE, cancelUrl: 'https://attacker.test/cancel' }), code('HIGGSFIELD_INVALID_REQUEST_HANDLE'))
  assert.equal(h.calls.length, 0)
})

test('opaque request IDs are supported and unsafe path fragments fail before transport', async () => {
  const requestId = 'req_Cinema4-2026'
  const statusUrl = ORIGIN + '/requests/' + requestId + '/status'
  const cancelUrl = ORIGIN + '/requests/' + requestId + '/cancel'
  const h = harness([
    quoteResponse(), accepted({ request_id: requestId, status_url: statusUrl, cancel_url: cancelUrl }),
    json({ request_id: requestId, status: 'in_progress' }), new Response(null, { status: 202 }),
  ])
  const quote = await h.client.estimate(INPUT)
  const receipt = await h.client.submit(INPUT, execution(quote))
  assert.equal(receipt.requestId, requestId)
  assert.equal((await h.client.poll(receipt)).requestId, requestId)
  assert.equal((await h.client.cancel(receipt)).requestId, requestId)
  for (const unsafeId of ['', '../other', 'a/b', 'a%2fb', 'a?b', 'a#b', 'a'.repeat(256)]) {
    await assert.rejects(h.client.poll({
      requestId: unsafeId,
      statusUrl: ORIGIN + '/requests/' + unsafeId + '/status',
      cancelUrl: ORIGIN + '/requests/' + unsafeId + '/cancel',
    }), code('HIGGSFIELD_INVALID_REQUEST_HANDLE'))
  }
  assert.equal(h.calls.length, 4)
})

test('malformed paid receipts retain a safe request ID but never trust provider URLs', async () => {
  const h = harness([quoteResponse(), accepted({ status_url: 'https://attacker.test/?token=signed-url-secret' })])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution(quote)), (error) => {
    const failure = safeError(error, 'HIGGSFIELD_INVALID_SUBMISSION_RESPONSE')
    assert.equal(failure.submissionUncertain, true)
    assert.equal(failure.requestId, REQUEST_ID)
    return true
  })
  assert.equal(h.calls.length, 2)
})

test('idempotency replay returning a different remote identity is not accepted', async () => {
  const changedId = '00000000-0000-0000-0000-000000000000'
  const h = harness([quoteResponse(), accepted(), accepted({
    request_id: changedId, status_url: ORIGIN + '/requests/' + changedId + '/status',
    cancel_url: ORIGIN + '/requests/' + changedId + '/cancel',
  })])
  const quote = await h.client.estimate(INPUT)
  await h.client.submit(INPUT, execution(quote))
  await assert.rejects(h.client.submit(INPUT, execution(quote)), code('HIGGSFIELD_INVALID_SUBMISSION_RESPONSE'))
})

test('invalid JSON, missing estimate and nondecimal estimates do not authorize generation', async () => {
  for (const response of [
    new Response('provider-body-secret'), json(null), json({}), json({ usd: 0.1 }),
    json({ usd: 'NaN' }), json({ usd: '-0.1' }), quoteResponse('1e-3'),
  ]) {
    const h = harness([response])
    await assert.rejects(h.client.estimate(INPUT), (error) => {
      assert.ok(error instanceof HiggsfieldError)
      safeError(error, error.code)
      return true
    })
    assert.equal(h.calls.length, 1)
  }
})

test('non-JSON paid response is uncertain and sanitized, not proof that generation failed', async () => {
  const h = harness([quoteResponse(), new Response('provider-body-secret ' + CREDENTIALS)])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution(quote)), (error) => {
    assert.equal(safeError(error, 'HIGGSFIELD_INVALID_RESPONSE').submissionUncertain, true)
    return true
  })
  assert.equal(h.calls.length, 2)
})

test('responses above 64 KiB are rejected with and without Content-Length', async () => {
  const large = JSON.stringify({ usd: '0.1', padding: 's'.repeat(65536) })
  const headerCases: HeadersInit[] = [{}, { 'Content-Length': String(Buffer.byteLength(large)) }]
  for (const headers of headerCases) {
    const h = harness([new Response(large, { headers })])
    await assert.rejects(h.client.estimate(INPUT), code('HIGGSFIELD_INVALID_RESPONSE'))
    assert.equal(h.calls.length, 1)
  }
})

test('a stalled body cannot outlive the response deadline even if cancel never settles', async () => {
  const body = new ReadableStream<Uint8Array>({
    cancel: () => new Promise<void>(() => {}),
  })
  let calls = 0
  const client = createHiggsfieldClient({
    credentials: CREDENTIALS, requestTimeoutMs: 10,
    fetch: async () => { calls++; return new Response(body) },
  })
  let fallback: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    fallback = setTimeout(() => reject(new Error('Response body deadline exceeded')), 300)
  })
  try {
    await assert.rejects(Promise.race([client.poll(HANDLE), deadline]), code('HIGGSFIELD_INVALID_RESPONSE'))
  } finally { clearTimeout(fallback) }
  assert.equal(calls, 1)
})

test('HTTP error disposal never waits for a hostile stream cancellation', async () => {
  const body = new ReadableStream<Uint8Array>({
    cancel: () => new Promise<void>(() => {}),
  })
  const h = harness([new Response(body, { status: 502 })])
  let fallback: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    fallback = setTimeout(() => reject(new Error('Error disposal waited indefinitely')), 300)
  })
  try {
    await assert.rejects(Promise.race([h.client.poll(HANDLE), deadline]), code('HIGGSFIELD_HTTP_ERROR'))
  } finally { clearTimeout(fallback) }
  assert.equal(h.calls.length, 1)
})

test('poll validates request identity, states, URLs and completion output', async () => {
  for (const payload of [
    { request_id: 'other', status: 'completed' },
    { request_id: REQUEST_ID, status: 'cancelled' },
    { request_id: REQUEST_ID, status: 'completed' },
    { request_id: REQUEST_ID, status: 'completed', video: { url: 'http://media.test/output.mp4' } },
    { request_id: REQUEST_ID, status: 'failed', expires_at: 'not-a-time' },
    { request_id: REQUEST_ID, status: 'queued', status_url: 'https://attacker.test/status' },
  ]) {
    const h = harness([json(payload)])
    await assert.rejects(h.client.poll(HANDLE), code('HIGGSFIELD_INVALID_POLL_RESPONSE'))
    assert.equal(h.calls.length, 1)
  }
})

test('failed, moderated and canceled jobs are terminal and do not trigger replacements', async () => {
  for (const status of ['failed', 'nsfw', 'canceled']) {
    const h = harness([json({ request_id: REQUEST_ID, status, error: 'provider-body-secret' })])
    const result = await h.client.poll(HANDLE)
    assert.equal(result.status, status)
    assert.equal(result.terminal, true)
    assert.equal(result.videoUrl, null)
    assert.equal(result.expiresAt, null)
    assert.ok(!JSON.stringify(result).includes('provider-body-secret'))
    assert.equal(h.calls.length, 1)
  }
})

test('cancel accepts the documented empty 202 and asks for a subsequent status check', async () => {
  const h = harness([new Response(null, { status: 202 }), json({ request_id: REQUEST_ID, status: 'canceled' })])
  const result = await h.client.cancel(HANDLE)
  assert.deepEqual(result, { requestId: REQUEST_ID, acknowledged: true, needsStatusCheck: true })
  assert.equal(h.calls[0].url, HANDLE.cancelUrl)
  assert.equal(h.calls[0].init?.method, 'POST')
  assert.equal(h.calls[0].init?.body, undefined)
  assert.equal((await h.client.poll(HANDLE)).status, 'canceled')
})

test('late cancellation and status 404 remain explicit without resubmission', async () => {
  const h = harness([json({ detail: 'provider-body-secret' }, 400), json({}, 404)])
  await assert.rejects(h.client.cancel(HANDLE), code('HIGGSFIELD_HTTP_ERROR'))
  await assert.rejects(h.client.poll(HANDLE), code('HIGGSFIELD_HTTP_ERROR'))
  assert.equal(h.calls.filter(c => c.url === ENDPOINT).length, 0)
})

test('poll requires 200 and cancel requires 202 even with plausible JSON', async () => {
  const h = harness([json({ request_id: REQUEST_ID, status: 'queued' }, 201), json({ status: 'canceled' })])
  await assert.rejects(h.client.poll(HANDLE), code('HIGGSFIELD_INVALID_POLL_RESPONSE'))
  await assert.rejects(h.client.cancel(HANDLE), code('HIGGSFIELD_INVALID_CANCEL_RESPONSE'))
})

test('provider redirects are rejected and do not leak authorization to another origin', async () => {
  const redirected = accepted()
  Object.defineProperty(redirected, 'redirected', { value: true })
  Object.defineProperty(redirected, 'url', { value: 'https://attacker.test/?token=signed-url-secret' })
  const h = harness([quoteResponse(), redirected])
  const quote = await h.client.estimate(INPUT)
  await assert.rejects(h.client.submit(INPUT, execution(quote)), (e) => Boolean(safeError(e, 'HIGGSFIELD_REDIRECT_REJECTED')))
  assert.equal(h.calls.length, 2)
  assert.ok(h.calls.every(c => c.init?.redirect === 'error' && new URL(c.url).origin === ORIGIN))
})

test('aborted local work stops before transport and never pretends to cancel the remote job', async () => {
  const h = harness([quoteResponse()])
  const quote = await h.client.estimate(INPUT)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(h.client.submit(INPUT, execution(quote, { signal: controller.signal })), code('HIGGSFIELD_LOCAL_ABORT_REMOTE_UNCHANGED'))
  await assert.rejects(h.client.poll(HANDLE, { signal: controller.signal }), code('HIGGSFIELD_LOCAL_ABORT_REMOTE_UNCHANGED'))
  assert.equal(h.calls.length, 1)
})

test('transport timeout is bounded and redacts the original fetch error', async () => {
  let calls = 0
  const client = createHiggsfieldClient({
    credentials: CREDENTIALS, requestTimeoutMs: 10,
    fetch: async (_url, init) => {
      calls++
      return await new Promise<Response>((_resolve, reject) => {
        const fallback = setTimeout(() => reject(new Error('Abort signal was not delivered')), 300)
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(fallback)
          reject(new Error(CREDENTIALS + ' signed-url-secret'))
        }, { once: true })
      })
    },
  })
  await assert.rejects(client.poll(HANDLE), (e) => Boolean(safeError(e, 'HIGGSFIELD_NETWORK_ERROR')))
  assert.equal(calls, 1)
})

test('process restart needs a fresh estimate while the caller keeps the same persisted intent', async () => {
  const before = harness([quoteResponse(), accepted()])
  const oldQuote = await before.client.estimate(INPUT)
  const persisted = execution(oldQuote)
  const receipt = await before.client.submit(INPUT, persisted)
  const after = harness([quoteResponse(), accepted(), json({ request_id: REQUEST_ID, status: 'queued' })])
  await assert.rejects(after.client.submit(INPUT, persisted), code('HIGGSFIELD_ESTIMATE_REQUIRED'))
  const newQuote = await after.client.estimate(INPUT)
  assert.equal(newQuote.fingerprint, persisted.intent.fingerprint)
  const replay = await after.client.submit(INPUT, { ...persisted, estimate: newQuote })
  assert.equal(replay.requestId, receipt.requestId)
  assert.equal(new Headers(after.calls[1].init?.headers).get('Idempotency-Key'), KEY)
  await after.client.poll(receipt)
})

test('retention is included in the intent and sent unchanged on explicit retries', async () => {
  const h = harness([quoteResponse(), accepted({ expires_after: 3600 }), accepted({ expires_after: 3600 })])
  const quote = await h.client.estimate(INPUT, { expiresAfterSeconds: 3600 })
  const context = execution(quote, { expiresAfterSeconds: 3600 })
  await h.client.submit(INPUT, context)
  await h.client.submit(INPUT, context)
  for (const call of h.calls.filter(c => c.url === ENDPOINT)) {
    assert.equal(new Headers(call.init?.headers).get('Hf-Expires-After'), '3600')
    assert.equal(new Headers(call.init?.headers).get('Idempotency-Key'), KEY)
  }
})
