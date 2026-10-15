import test from 'node:test'
import assert from 'node:assert/strict'
import { createLtxClient, type LtxJob, type LtxJobStore } from '../../src/lib/ltx-v2.ts'

const date = '2026-10-15T20:00:00.000Z'
const accepted = { id: 'job-fixture', created_at: date }
const completed = { ...accepted, status: 'completed', completed_at: date, result: { video_url: 'https://media.example.test/video.mp4' } }
const input = { model: 'ltx-2-3-fast', prompt: 'Fixture', duration: 6, resolution: '1280x720' } as const
function fixture(fetch: typeof globalThis.fetch) {
  process.env.LTX_API_KEY = 'synthetic-ltx-key'
  const rows = new Map<string, LtxJob>()
  const store: LtxJobStore = {
    async load(key) { return structuredClone(rows.get(key) ?? null) },
    async compareAndSet(key, expected, next) {
      if (expected === null ? rows.has(key) : rows.get(key)?.revision !== expected) return false
      rows.set(key, structuredClone(next)); return true
    },
  }
  return { client: createLtxClient({ fetch }), execution: { store, operationKey: 'fixture-operation' } }
}
function delayed(body: unknown, status: number) {
  let timer: ReturnType<typeof setTimeout>
  return new Response(new ReadableStream({
    start(controller) { timer = setTimeout(() => { controller.enqueue(new TextEncoder().encode(JSON.stringify(body))); controller.close() }, 120) },
    cancel() { clearTimeout(timer); return new Promise(() => {}) },
  }), { status })
}
test('LTX aborted submission body remains uncertain, never a new paid POST', async () => {
  let calls = 0
  const h = fixture(async () => { calls++; return delayed(accepted, 202) })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10)
  try {
    await assert.rejects(h.client.submit('text-to-video', input, { ...h.execution, signal: controller.signal }), { code: 'LTX_SUBMISSION_UNKNOWN' })
    await assert.rejects(h.client.submit('text-to-video', input, h.execution), { code: 'LTX_SUBMISSION_REQUIRES_RECONCILIATION' })
    assert.equal(calls, 1)
  } finally { clearTimeout(timer) }
})
for (const explicitAbort of [true, false]) test(`LTX polling body respects ${explicitAbort ? 'local cancellation' : 'remaining deadline'} and keeps same ID`, async () => {
  let calls = 0
  const h = fixture(async () => { calls++; return calls === 1 ? new Response(JSON.stringify(accepted), { status: 202 }) : delayed(completed, 200) })
  const job = await h.client.submit('text-to-video', input, h.execution)
  const controller = new AbortController()
  // Also keeps Node alive while AbortSignal.timeout's timer is unref'ed.
  const timer = setTimeout(() => controller.abort(), explicitAbort ? 10 : 200)
  try {
    await assert.rejects(h.client.poll(job, { ...h.execution, signal: explicitAbort ? controller.signal : undefined }, 10), {
      code: explicitAbort ? 'LTX_WAIT_CANCELLED_REMOTE_UNCHANGED' : 'LTX_POLL_TRANSIENT',
    })
    assert.equal((await h.execution.store.load(job.key))?.id, 'job-fixture')
    assert.equal((await h.execution.store.load(job.key))?.state, 'accepted')
    assert.equal(calls, 2)
  } finally { clearTimeout(timer) }
})
