import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { generateMusic } from '../src/lib/suno.ts'
import { providerConfigStatus } from '../src/lib/env.ts'
import { POST } from '../src/app/api/webhooks/suno/route.ts'
const originalFetch = globalThis.fetch
const names = ['SUNO_API_KEY', 'SUNO_API_BASE_URL', 'SUNO_BASE_URL', 'NEXT_PUBLIC_APP_URL'] as const
const before = names.map(name => process.env[name])
afterEach(() => { globalThis.fetch = originalFetch; names.forEach((name, i) => {
  if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]
}) })
const params = { prompt: 'Calm piano without vocals', style: 'ambient' as const, duration: 20 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const accepted = () => json({ code: 200, data: { taskId: 'task-1' } })
const complete = (song: unknown = { id: 'track-1', audio_url: 'https://media.invalid/music.mp3' }) =>
  json({ code: 200, data: { taskId: 'task-1', status: 'SUCCESS', response: { taskId: 'task-1', sunoData: [song] } } })
function setup(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  process.env.SUNO_API_KEY = 'fixture-only-key'
  process.env.SUNO_API_BASE_URL = 'https://api.sunoapi.org/api/v1'
  process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.fixture.invalid'
  globalThis.fetch = async (url, init) => handler(String(url), init)
}
test('SunoAPI explicit V6 custom instrumental contract and authenticated task polling', async () => {
  let calls = 0
  setup((url, init) => {
    calls++
    assert.ok(init?.signal)
    assert.equal(init?.redirect, 'error')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-only-key')
    if (calls === 1) {
      assert.equal(url, 'https://api.sunoapi.org/api/v1/generate')
      assert.equal(init?.method, 'POST')
      assert.deepEqual(JSON.parse(String(init?.body)), { customMode: true, instrumental: true, model: 'V6',
        style: 'ambient: Calm piano without vocals', duration: 20, callBackUrl: 'https://sutra.fixture.invalid/api/webhooks/suno' })
      return accepted()
    }
    assert.equal(url, 'https://api.sunoapi.org/api/v1/generate/record-info?taskId=task-1')
    return complete()
  })
  assert.deepEqual(await generateMusic(params), { id: 'track-1', audio_url: 'https://media.invalid/music.mp3' })
  assert.equal(calls, 2)
})
test('SunoAPI config rejects unsupported/credentialed URLs before sending a key', async () => {
  let calls = 0
  setup(() => { calls++; return accepted() })
  for (const url of ['https://api.suno.ai/v1', 'https://evil.invalid/api/v1', 'http://api.sunoapi.org/api/v1',
    'https://private@api.sunoapi.org/api/v1', 'https://api.sunoapi.org/api/v1?token=private']) {
    process.env.SUNO_API_BASE_URL = url
    await assert.rejects(generateMusic(params), /URL fournisseur/)
    assert.equal(providerConfigStatus('suno').configured, false)
    assert.ok(!JSON.stringify(providerConfigStatus('suno')).includes(url))
  }
  assert.equal(calls, 0)
  delete process.env.SUNO_API_BASE_URL
  delete process.env.SUNO_BASE_URL
  assert.equal(providerConfigStatus('suno').configured, false)
  await assert.rejects(generateMusic(params), /SUNO_API_BASE_URL requis/)
})
test('SunoAPI explicit current URL wins over legacy alias without mutating it', async () => {
  setup((_url, init) => init?.method === 'POST' ? accepted() : complete())
  process.env.SUNO_BASE_URL = 'https://api.suno.ai/v1'
  assert.equal(providerConfigStatus('suno').configured, true)
  await generateMusic(params)
  assert.equal(process.env.SUNO_BASE_URL, 'https://api.suno.ai/v1')
})
test('SunoAPI bounds input before any submission', async () => {
  let calls = 0
  setup(() => { calls++; return accepted() })
  for (const duration of [0, 9, 361, Number.NaN]) await assert.rejects(generateMusic({ ...params, duration }), /parametres invalides/)
  await assert.rejects(generateMusic({ ...params, prompt: 'x'.repeat(1001) }), /parametres invalides/)
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  await assert.rejects(generateMusic(params), /HTTPS/)
  assert.equal(calls, 0)
})
test('SunoAPI body-level rejection and uncertain transport never resubmit or reflect diagnostics', async () => {
  for (const code of [401, 429, 500]) {
    let calls = 0
    setup(() => { calls++; return json({ code, msg: 'PRIVATE_DIAGNOSTIC' }) })
    await assert.rejects(generateMusic(params), error => error instanceof Error &&
      error.message === `Suno: code fournisseur ${code}`)
    assert.equal(calls, 1)
  }
  let calls = 0
  setup(() => { calls++; throw new Error('PRIVATE_TRANSPORT') })
  await assert.rejects(generateMusic(params), error => error instanceof Error && !error.message.includes('PRIVATE_TRANSPORT'))
  assert.equal(calls, 1)
})
test('SunoAPI task mismatch, failed/unknown status and untrusted media fail closed', async () => {
  const bad = [
    () => json({ code: 200, data: { taskId: 'other', status: 'SUCCESS' } }),
    ...['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR', 'bogus']
      .map(status => () => json({ code: 200, data: { taskId: 'task-1', status, errorMessage: 'PRIVATE_DIAGNOSTIC' } })),
    ...['javascript:alert(1)', 'http://media.invalid/music.mp3', 'https://private@media.invalid/music.mp3']
      .map(audio_url => () => complete({ id: 'track-1', audio_url })),
    () => complete({ id: {}, audio_url: 'https://media.invalid/music.mp3' }),
  ]
  for (const response of bad) {
    let submissions = 0
    setup((_url, init) => { if (init?.method === 'POST') { submissions++; return accepted() } return response() })
    await assert.rejects(generateMusic(params), error => error instanceof Error && !error.message.includes('PRIVATE_DIAGNOSTIC'))
    assert.equal(submissions, 1)
  }
})
test('SunoAPI callback is acknowledgement only and has no body/storage/provider dependency', async () => {
  setup(() => { throw new Error('UNEXPECTED_PROVIDER_CALL') })
  const response = POST()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), { code: 200 })
})
