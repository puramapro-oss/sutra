// Owner T05/T01 only: desired invariant; intentionally FAILS on base cb3f893.
// No product modification and no real provider request. Resume GET only.
import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleFinalVideo, durableRenderJob } from '../../src/lib/shotstack.ts'

test('Shotstack resumed polling must reject a body completed after local cancellation', async () => {
  process.env.SHOTSTACK_API_KEY = 'synthetic-shotstack-key'
  process.env.SHOTSTACK_ENV = 'stage'
  const controller = new AbortController()
  let calls = 0
  const stub = test.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++
    assert.notEqual(init?.method, 'POST')
    let timer: ReturnType<typeof setTimeout>
    return new Response(new ReadableStream({ start(stream) {
      timer = setTimeout(() => {
        stream.enqueue(new TextEncoder().encode(JSON.stringify({ response: {
          status: 'done', url: 'https://cdn.example.test/result.mp4', duration: 5,
        } })))
        stream.close()
      }, 120)
    }, cancel() { clearTimeout(timer) } }))
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

test('Shotstack cancelled submission retains a late remote ID without accepting completion or resubmitting', async () => {
  process.env.SHOTSTACK_API_KEY = 'synthetic-shotstack-key'
  process.env.SHOTSTACK_ENV = 'stage'
  const controller = new AbortController(), steps: Record<string, unknown> = {}
  let calls = 0
  const stub = test.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    calls++; assert.equal(init?.method, 'POST')
    let timer: ReturnType<typeof setTimeout>
    return new Response(new ReadableStream({
      start(stream) { timer = setTimeout(() => { stream.enqueue(new TextEncoder().encode(JSON.stringify({ response: { id: 'late-id' } }))); stream.close() }, 120) },
      cancel() { clearTimeout(timer) },
    }))
  })
  const timer = setTimeout(() => controller.abort(), 10)
  try {
    await assert.rejects(assembleFinalVideo({
      signal: controller.signal, renderJob: durableRenderJob(steps),
      clips: [{ url: 'https://cdn.example.test/input.mp4', type: 'stock', duration: 5 }],
      voiceUrl: '', musicUrl: '', musicVolume: 0, subtitles: [], transitions: 'none', format: '16:9', quality: '720p',
    }, { measureAudio: async () => ({ voice: null, music: null }) }))
    assert.equal(steps.assembly_submission_started, true)
    // A received submission ID is a durable reconciliation receipt, not render completion.
    assert.equal(steps.assembly_render_id, 'late-id')
    assert.equal(durableRenderJob(steps).id, 'late-id')
    assert.equal(calls, 1)
  } finally { clearTimeout(timer); stub.mock.restore() }
})
