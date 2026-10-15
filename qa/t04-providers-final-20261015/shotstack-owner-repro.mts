// Owner T05/T01 only: desired invariant; intentionally FAILS on base cb3f893.
// No product modification and no real provider request. Resume GET only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleFinalVideo } from '../../src/lib/shotstack.ts'

test('Shotstack resumed polling must reject a body completed after local cancellation', async () => {
  process.env.SHOTSTACK_API_KEY = 'synthetic-shotstack-key'
  process.env.SHOTSTACK_ENV = 'stage'
  const controller = new AbortController()
  let calls = 0
  const stub = test.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++
    assert.notEqual(init?.method, 'POST')
    return new Response(new ReadableStream({ start(stream) {
      setTimeout(() => {
        stream.enqueue(new TextEncoder().encode(JSON.stringify({ response: {
          status: 'done', url: 'https://cdn.example.test/result.mp4', duration: 5,
        } })))
        stream.close()
      }, 120)
    } }))
  })
  const timer = setTimeout(() => controller.abort(), 10)
  try {
    await assert.rejects(assembleFinalVideo({
      signal: controller.signal, renderJob: { id: 'fixture-render' },
      clips: [{ url: 'https://cdn.example.test/input.mp4', type: 'stock', duration: 5 }],
      voiceUrl: '', musicUrl: '', musicVolume: 0, subtitles: [], transitions: 'none', format: '16:9', quality: '720p',
    }, { measureAudio: async () => ({ voice: null, music: null }) }))
    assert.equal(calls, 1)
  } finally { clearTimeout(timer); stub.mock.restore() }
})
