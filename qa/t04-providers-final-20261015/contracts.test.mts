import test from 'node:test'
import assert from 'node:assert/strict'
import { searchVideos, searchImages } from '../../src/lib/pexels.ts'
import { cloneVoice, listVoices } from '../../src/lib/elevenlabs.ts'
import { readScope, selected } from '../t04-final-providers-20261015/salad-read.mjs'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const photo = { id: 1, url: 'https://www.pexels.com/photo/1', width: 640, height: 480,
  src: { original: 'https://images.pexels.com/photo.jpg' }, photographer: 'Author' }
const video = { id: 1, url: 'https://www.pexels.com/video/1', duration: 3,
  video_files: [{ id: 2, quality: 'hd', width: 640, height: 480, link: 'https://videos.pexels.com/video.mp4' }] }
test.beforeEach(() => {
  process.env.PEXELS_API_KEY = 'contract-fixture'
  process.env.ELEVENLABS_API_KEY = 'contract-fixture'
})
test.afterEach(() => { test.mock.restoreAll() })

for (const [name, search] of [['video', searchVideos], ['image', searchImages]] as const) {
  for (const status of [401, 403, 404, 429, 500]) test(`Pexels ${name}: HTTP ${status} is an explicit failure, one GET`, async () => {
    let calls = 0
    test.mock.method(globalThis, 'fetch', async () => { calls++; return json({ secret: 'untrusted response' }, status) })
    await assert.rejects(search('ocean'), new RegExp(`Pexels.*${status}`))
    assert.equal(calls, 1)
  })
  test(`Pexels ${name}: malformed schema is not an empty search`, async () => {
    test.mock.method(globalThis, 'fetch', async () => json({}))
    await assert.rejects(search('ocean'), /Pexels.*INVALID_RESPONSE/)
  })
  test(`Pexels ${name}: missing credential is explicit and never calls network`, async () => {
    delete process.env.PEXELS_API_KEY
    test.mock.method(globalThis, 'fetch', async () => { assert.fail('network forbidden') })
    await assert.rejects(search('ocean'), { code: 'SUTRA_ENV_MISSING' })
  })
  test(`Pexels ${name}: real empty result remains empty; transport is bounded`, async () => {
    test.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
      assert.equal(init?.redirect, 'error'); assert.ok(init?.signal)
      return json({ videos: [], photos: [] })
    })
    assert.deepEqual(await search('ocean'), [])
  })
  test(`Pexels ${name}: unsafe result cannot escape as usable media`, async () => {
    test.mock.method(globalThis, 'fetch', async () => json({
      videos: [{ ...video, video_files: [{ ...video.video_files[0], link: 'http://127.0.0.1/media' }] }],
      photos: [{ ...photo, src: { original: 'http://127.0.0.1/media' } }],
    }))
    await assert.rejects(search('ocean'), /Pexels.*INVALID_RESPONSE/)
  })
  test(`Pexels ${name}: success preserves provenance and never fabricates cost`, async () => {
    test.mock.method(globalThis, 'fetch', async () => json({ videos: [video], photos: [photo] }))
    const result = await search('ocean')
    assert.equal(result.length, 1); assert.equal(result[0].provider, 'pexels')
    assert.equal(result[0].sourcePage, name === 'image' ? photo.url : video.url)
  })
}
test('ElevenLabs clone: malformed voice ID cannot become success', async () => {
  test.mock.method(globalThis, 'fetch', async () => json({ voice_id: { unsafe: true } }))
  await assert.rejects(cloneVoice({ name: 'fixture', audioFile: Buffer.from('fixture') }), /ElevenLabs.*invalide/)
})
test('ElevenLabs list: malformed entry cannot become a selectable voice', async () => {
  test.mock.method(globalThis, 'fetch', async () => json({ voices: [{ voice_id: 17, name: null }] }))
  await assert.rejects(listVoices(), /ElevenLabs.*invalide/)
})
test('ElevenLabs clone/list: reject redirects and bound body parsing', async () => {
  test.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal)
    return json({ voice_id: 'fixture-voice', voices: [{ voice_id: 'fixture-voice', name: 'Voice', preview_url: null }] })
  })
  assert.equal(await cloneVoice({ name: 'fixture', audioFile: Buffer.from('fixture') }), 'fixture-voice')
  assert.equal((await listVoices())[0].voice_id, 'fixture-voice')
})
test('Salad exact requested NAME fields work for free scoped reads', async () => {
  const values = selected('SALAD_API_KEY=fixture-salad-key-000\nSALAD_ORGANIZATION_NAME=fixture-org\nSALAD_PROJECT_NAME=fixture-project')
  let calls = 0
  const result = await readScope('groups', values, { fetchImpl: async (url, init) => {
    calls++; assert.equal(String(url), 'https://api.salad.com/api/public/organizations/fixture-org/projects/fixture-project/containers')
    assert.equal(init?.method, 'GET'); return json({ items: [] })
  } })
  assert.equal(result.status, 'PASS'); assert.equal(calls, 1)
})
test('Salad conflicting legacy and NAME scopes fail before any request', async () => {
  let calls = 0
  const result = await readScope('groups', { SALAD_API_KEY: 'fixture-salad-key-000', SALAD_ORGANIZATION: 'old-org',
    SALAD_ORGANIZATION_NAME: 'new-org', SALAD_PROJECT: 'fixture-project' }, { fetchImpl: async () => { calls++; return json({ items: [] }) } })
  assert.equal(result.status, 'BLOQUE'); assert.equal(calls, 0)
})

test('Pexels keeps MP4 variants while ignoring legitimate dimensionless HLS variants', async () => {
  test.mock.method(globalThis, 'fetch', async () => json({ videos: [{ ...video, video_files: [
    ...video.video_files, { id: 3, quality: 'hls', width: null, height: null, file_type: 'video/mp4', link: 'https://videos.pexels.com/playlist.m3u8' },
  ] }] }))
  assert.equal((await searchVideos('ocean'))[0].url, video.video_files[0].link)
})
for (const [name, search] of [['Pexels video', () => searchVideos('ocean')], ['Pexels image', () => searchImages('ocean')],
  ['ElevenLabs clone', () => cloneVoice({ name: 'fixture', audioFile: Buffer.from('fixture') })], ['ElevenLabs list', listVoices]] as const) {
  test(`${name}: malformed JSON and oversized bodies reject`, async () => {
    const stub = test.mock.method(globalThis, 'fetch', async () => new Response('{'))
    await assert.rejects(search())
    stub.mock.mockImplementation(async () => new Response('{}', { headers: { 'content-length': '3000000' } }))
    await assert.rejects(search())
    assert.equal(stub.mock.callCount(), 2, 'one request per explicit call; no retry')
  })
  test(`${name}: body timeout survives a stream ignoring the fetch signal`, async () => {
    const controller = new AbortController()
    test.mock.method(AbortSignal, 'timeout', () => controller.signal)
    const stub = test.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
      start() { setTimeout(() => controller.abort(), 10) },
      cancel() { return new Promise(() => {}) },
    })))
    await assert.rejects(search())
    assert.equal(stub.mock.callCount(), 1)
  })
}
