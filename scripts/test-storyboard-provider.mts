import test from 'node:test'
import assert from 'node:assert/strict'
import { generateStoryboard, storyboardProvider, storyboardRequest } from '../src/lib/storyboard-provider.ts'

const valid = { idea: 'Une carafe en situation', format: '9:16', durationTarget: 'short' } as const
const scene = { visual_prompt: 'An actual glass carafe', description: 'La carafe sur la table.', duration_seconds: 5, transition: 'cut' }
const signal = new AbortController().signal
const fakeUser = 'a9be8d1e-8020-46e4-8052-44b9fc8b0a08'

test('default remains the existing SMARANA route and only server configuration can opt in', async () => {
  assert.equal(storyboardProvider(undefined), 'smarana')
  assert.equal(storyboardProvider(''), 'smarana')
  assert.throws(() => storyboardProvider('openia'), { status: 503 })
  assert.deepEqual(storyboardRequest.parse({ ...valid, provider: 'openai', openAIStoryboard: {}, userId: 'other' }), valid)
  for (const provider of ['smarana', 'openai'] as const) {
    let calls = 0
    const storyboard = await generateStoryboard(valid, fakeUser, provider, signal, async options => {
      calls++
      assert.equal(options.userId, fakeUser)
      assert.equal(options.appSlug, 'sutra')
      assert.equal(options.openAIStoryboard?.signal, provider === 'openai' ? signal : undefined)
      assert.match(options.system, /9:16/)
      assert.match(options.message, /Une carafe en situation/)
      return { text: '\x60\x60\x60json\n' + JSON.stringify({ scenes: [scene] }) + '\n\x60\x60\x60' }
    })
    assert.deepEqual(storyboard.scenes, [scene])
    assert.equal(calls, 1)
  }
})

test('invalid fields, invalid scenes, excessive outputs and incomplete texts are refused', async () => {
  for (const change of [{ idea: '  ' }, { idea: 'a'.repeat(5001) }, { format: '9:9' }, { durationTarget: 4 }]) {
    assert.equal(storyboardRequest.safeParse({ ...valid, ...change }).success, false)
  }
  const cases = ['unfinished', ' '.repeat(65537), { scenes: [] }, { scenes: Array(15).fill(scene) },
    ...[{ description: ' ' }, { transition: 'other' }, { duration_seconds: 0.01 }, { duration_seconds: 121 }].map(
      invalid => ({ scenes: [{ ...scene, ...invalid }] }))]
  for (const item of cases) {
    await assert.rejects(generateStoryboard(valid, fakeUser, 'openai', signal,
      async () => ({ text: typeof item === 'string' ? item : JSON.stringify(item) })), { status: 502 })
  }
})

test('a provider failure never resubmits to the existing paid provider', async () => {
  let calls = 0
  await assert.rejects(generateStoryboard(valid, fakeUser, 'openai', signal, async () => {
    calls++
    throw Error('unavailable')
  }), /unavailable/)
  assert.equal(calls, 1)
})

test('actual POST authenticates, bounds the body, gates OpenAI, sanitises errors and throttles per actor', async t => {
  const { build } = await import('esbuild')
  const fixture = {
    userId: null as string | null, calls: [] as unknown[],
    async run(opts: unknown) { this.calls.push(opts); return { text: JSON.stringify({ scenes: [scene] }) } },
  }
  const oldProvider = process.env.SUTRA_STORYBOARD_PROVIDER
  t.after(() => {
    if (oldProvider === undefined) delete process.env.SUTRA_STORYBOARD_PROVIDER
    else process.env.SUTRA_STORYBOARD_PROVIDER = oldProvider
    Reflect.deleteProperty(globalThis, '__sutraStoryboardProviderTest')
  })
  Reflect.set(globalThis, '__sutraStoryboardProviderTest', fixture)
  const { outputFiles } = await build({
    entryPoints: ['src/app/api/storyboard/route.ts'], bundle: true, platform: 'node',
    format: 'cjs', write: false, packages: 'external', plugins: [{
      name: 'storyboard-fixtures', setup(b) {
        b.onResolve({ filter: /^(@purama\/smarana|@\/lib\/supabase-server)$/ },
          args => ({ path: args.path, namespace: 'fixture' }))
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === '@purama/smarana'
          ? 'export class OpenAIStoryboardError extends Error { constructor(code){ super("private"); this.code=code }}; export const smarana = { ask: opts => globalThis.__sutraStoryboardProviderTest.run(opts) }'
          : 'export const createServerClient = async () => ({auth:{getUser: async () => ({data:{user: globalThis.__sutraStoryboardProviderTest.userId ? { id: globalThis.__sutraStoryboardProviderTest.userId } : null}, error:null})}})' }))
      },
    }],
  })
  const { createRequire } = await import('node:module')
  const bundle = { exports: {} as { POST?: (req: Request) => Promise<Response> } }
  new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), bundle, bundle.exports)
  const POST = bundle.exports.POST!
  const post = (body = JSON.stringify(valid), headers: Record<string, string> = {}) => POST(new Request('http://localhost/api/storyboard', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body,
  }))
  process.env.SUTRA_STORYBOARD_PROVIDER = 'openai'
  assert.equal((await post('bad')).status, 401)
  fixture.userId = fakeUser
  assert.equal((await post(undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403)
  assert.equal((await post(undefined, { 'Content-Type': 'text/plain' })).status, 415)
  assert.equal((await post('bad')).status, 400)
  assert.equal((await post('x'.repeat(32769))).status, 413)
  assert.equal((await post(JSON.stringify({ ...valid, format: 'a:b' }))).status, 400)
  assert.equal(fixture.calls.length, 0)
  process.env.SUTRA_STORYBOARD_PROVIDER = 'unknown'
  assert.equal((await post()).status, 503)
  process.env.SUTRA_STORYBOARD_PROVIDER = 'smarana'
  const legacy = await post(JSON.stringify({ ...valid, provider: 'openai' }))
  assert.equal(legacy.status, 200)
  assert.deepEqual(await legacy.json(), { scenes: [scene] })
  assert.equal(Reflect.has(fixture.calls[0] as object, 'openAIStoryboard'), false)
  process.env.SUTRA_STORYBOARD_PROVIDER = 'openai'
  for (let idx = 0; idx < 6; idx++) assert.equal((await post()).status, 200)
  const limited = await post()
  assert.equal(limited.status, 429)
  assert.ok(Number(limited.headers.get('retry-after')) > 0)
  assert.equal(fixture.calls.length, 7)
  fixture.userId = '6181709a-0ce5-4aa5-ab35-0417072ed3f5'
  fixture.run = async () => { throw Error('private text, credentials or prompt') }
  const failed = await post()
  assert.equal(failed.status, 500)
  assert.doesNotMatch(await failed.text(), /private|credentials|prompt/)
})

test('the actual SMARANA dependency preserves SUTRA admission, cancellation and accounting', async t => {
  const { build } = await import('esbuild')
  const { createRequire } = await import('node:module')
  const { dirname } = await import('node:path')
  const require = createRequire(import.meta.url)
  const entry = require.resolve('@purama/smarana')
  const success = { content: [{ type: 'text', text: JSON.stringify({ scenes: [scene] }) }],
    stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } }
  const calls = { sql: [] as string[], ledger: [] as string[], connect: 0, release: 0, anthropic: 0, openai: 0 }
  const ledger = {
    async query(sql: string) {
      calls.ledger.push(sql)
      return { rows: sql.trimStart().startsWith('INSERT') ? [{ id: 'fixture-reservation' }] : [] }
    },
    release() { calls.release++ },
  }
  let connect = async () => ledger
  let anthropic = async (_body: unknown, _request?: { signal?: AbortSignal }): Promise<unknown> => success
  let upstreamStatus = 200
  const fixture = {
    pool: {
      async query(sql: string) { calls.sql.push(sql); return { rows: [], rowCount: 1 } },
      async connect() { calls.connect++; return connect() },
    },
    anthropic(body: unknown, request?: { signal?: AbortSignal }) {
      calls.anthropic++
      return anthropic(body, request)
    },
  }
  const marker = '__sutraActualSmaranaTest'
  Reflect.set(globalThis, marker, fixture)
  const originalFetch = globalThis.fetch
  const env = {
    SMARANA_BENCH_PROVIDER: 'anthropic', OPENAI_API_KEY: 'fixture-only',
    SUTRA_STORYBOARD_PROVIDER: 'openai', SUTRA_STORYBOARD_OPENAI_MODEL: 'gpt-test',
    SUTRA_STORYBOARD_OPENAI_DAILY_LIMIT: '3',
    SUTRA_STORYBOARD_OPENAI_RATES: JSON.stringify({ model: 'gpt-test', input: 2, cached: 0.2, write: 3, output: 5 }),
  }
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  Object.assign(process.env, env)
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://api.openai.com/v1/responses')
    calls.openai++
    assert.equal(init?.signal?.aborted, false)
    return upstreamStatus !== 200 ? new Response('fixture upstream error', { status: upstreamStatus })
      : Response.json({ model: 'gpt-test', status: 'completed', usage: { input_tokens: 10, output_tokens: 2 },
        output: [{ type: 'message', role: 'assistant', status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify({ scenes: [scene] }) }] }] })
  }
  t.after(() => {
    globalThis.fetch = originalFetch
    Reflect.deleteProperty(globalThis, marker)
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const { outputFiles } = await build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
    packages: 'external', plugins: [{
      name: 'smarana-storage-and-provider-fixtures', setup(b) {
        b.onResolve({ filter: /^\.\/db\.ts$/ }, args => args.resolveDir === dirname(entry)
          ? { path: 'db', namespace: 'smarana-fixture' } : undefined)
        b.onResolve({ filter: /^@anthropic-ai\/sdk$/ }, () => ({ path: 'anthropic', namespace: 'smarana-fixture' }))
        b.onLoad({ filter: /.*/, namespace: 'smarana-fixture' }, args => ({ contents: args.path === 'db'
          ? `export const getPool = () => globalThis.${marker}.pool`
          : `export default class Anthropic { messages = { create: (...args) => globalThis.${marker}.anthropic(...args) } }` }))
      },
    }],
  })
  const bundle = { exports: {} as { smarana: { ask: Parameters<typeof generateStoryboard>[4] } } }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, bundle, bundle.exports)
  const ask = bundle.exports.smarana.ask
  function reset() {
    calls.sql.length = 0; calls.ledger.length = 0
    calls.connect = 0; calls.release = 0; calls.anthropic = 0; calls.openai = 0
    connect = async () => ledger
    anthropic = async () => success
    upstreamStatus = 200
  }

  await t.test('an already cancelled default request reaches neither storage nor a provider', async () => {
    reset()
    await assert.rejects(generateStoryboard(valid, fakeUser, 'smarana', AbortSignal.abort(), ask), { name: 'AbortError' })
    assert.deepEqual(calls, { sql: [], ledger: [], connect: 0, release: 0, anthropic: 0, openai: 0 })
  })
  await t.test('an active default request still produces one valid storyboard and records its usage', async () => {
    reset()
    assert.deepEqual(await generateStoryboard(valid, fakeUser, 'smarana', signal, ask), { scenes: [scene] })
    assert.equal(calls.anthropic, 1)
    assert.equal(calls.openai, 0)
    assert.equal(calls.sql.filter(sql => sql.includes('INSERT INTO smarana.usage')).length, 1)
  })
  await t.test('cancelling an in-flight default request reaches its provider without a retry', async () => {
    reset()
    const cancel = new AbortController()
    const entered = Promise.withResolvers<void>()
    const response = Promise.withResolvers<unknown>()
    anthropic = async (_body, request) => {
      entered.resolve()
      request?.signal?.addEventListener('abort', () => response.reject(request.signal!.reason), { once: true })
      return response.promise
    }
    let observed: unknown
    const pending = generateStoryboard(valid, fakeUser, 'smarana', cancel.signal, ask)
      .then(value => { observed = value }, error => { observed = error })
    try {
      await entered.promise
      cancel.abort()
      await new Promise(resolve => setImmediate(resolve))
      assert.ok(observed instanceof Error)
      assert.equal(observed.name, 'AbortError')
    } finally {
      response.reject(cancel.signal.reason)
      await pending
    }
    assert.equal(calls.anthropic, 1)
    assert.equal(calls.openai, 0)
  })
  await t.test('an active OpenAI request passes the real adapter and settles once', async () => {
    reset()
    assert.deepEqual(await generateStoryboard(valid, fakeUser, 'openai', signal, ask), { scenes: [scene] })
    assert.equal(calls.connect, 1)
    assert.equal(calls.ledger.filter(sql => sql === 'COMMIT').length, 1)
    assert.equal(calls.sql.length, 1)
    assert.equal(calls.openai, 1)
    assert.equal(calls.anthropic, 0)
  })
  await t.test('an already cancelled OpenAI request has no reservation or provider call', async () => {
    reset()
    await assert.rejects(generateStoryboard(valid, fakeUser, 'openai', AbortSignal.abort(), ask), { code: 'TIMEOUT' })
    assert.deepEqual(calls, { sql: [], ledger: [], connect: 0, release: 0, anthropic: 0, openai: 0 })
  })
  await t.test('OpenAI cancellation returns while a stalled reservation completes once', async () => {
    reset()
    const cancel = new AbortController()
    const entered = Promise.withResolvers<void>()
    const reserved = Promise.withResolvers<typeof ledger>()
    connect = async () => { entered.resolve(); return reserved.promise }
    let observed: unknown
    const pending = generateStoryboard(valid, fakeUser, 'openai', cancel.signal, ask)
      .then(value => { observed = value }, error => { observed = error })
    try {
      await entered.promise
      cancel.abort()
      await new Promise(resolve => setImmediate(resolve))
      assert.equal((observed as { code?: string })?.code, 'TIMEOUT')
    } finally {
      reserved.resolve(ledger)
      await pending
      await new Promise(resolve => setImmediate(resolve))
    }
    assert.equal(calls.ledger.filter(sql => sql === 'COMMIT').length, 1)
    assert.equal(calls.release, 1)
    assert.equal(calls.openai, 0)
    assert.equal(calls.anthropic, 0)
  })
  await t.test('an OpenAI upstream failure never falls back to the default provider', async () => {
    reset()
    upstreamStatus = 429
    await assert.rejects(generateStoryboard(valid, fakeUser, 'openai', signal, ask), { code: 'UPSTREAM' })
    assert.equal(calls.connect, 1)
    assert.equal(calls.openai, 1)
    assert.equal(calls.anthropic, 0)
    assert.equal(calls.sql.length, 0)
  })
})
