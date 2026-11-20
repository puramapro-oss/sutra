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
