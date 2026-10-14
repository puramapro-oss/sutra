import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { executeProductionStep, type ProductionJobInput } from '../../src/lib/production-pipeline.ts'

// Exercise the default production adapter; only HTTP and durable storage are doubles.
// The runner supplies a fresh synthetic environment and denies external sockets.
const input: ProductionJobInput = {
  step: 'music', userId: 'fixture-user', userEmail: null, userPlan: 'empire', genPlan: 'empire',
  qualityCap: '1080p', mediaFormat: '16:9', idea: 'fixture', template: 'youtube',
  format: '16:9', voice: null, musicStyle: 'cinematic', tone: null, previousData: {},
  brandKit: null, requestKey: 'fixture-request',
}
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

for (const boundary of ['submit-network', 'submit-503', 'poll-network', 'poll-403', 'result-write', 'result-ack', 'stage-ack', 'success']) {
  test(`default Suno production adapter: ${boundary} cannot cause a second paid submission`, async () => {
    process.env.SUNO_API_KEY = 'fixture-only'
    process.env.SUNO_API_BASE_URL = 'https://api.sunoapi.org/api/v1'
    const durable: Record<string, unknown> = {}
    let submissions = 0, polls = 0, fault = true
    globalThis.fetch = async (request, init) => {
      const url = String(request)
      assert.ok(init?.signal, 'the adapter supplies a deadline')
      if (url === 'https://api.sunoapi.org/api/v1/generate') {
        assert.equal(init?.method, 'POST')
        assert.equal(durable['music:started'], true, 'intent committed before the HTTP submission')
        submissions++
        if (boundary === 'submit-network') throw new Error('FIXTURE_CONNECTION_LOST')
        if (boundary === 'submit-503') return json({}, 503)
        return json({ code: 200, data: { taskId: 'fixture-song' } })
      }
      assert.equal(url, 'https://api.sunoapi.org/api/v1/generate/record-info?taskId=fixture-song')
      assert.ok(!init?.method || init.method === 'GET')
      assert.deepEqual(durable['music:suno'], { taskId: 'fixture-song' }, 'GET requires a durably acknowledged immutable task ID')
      polls++
      if (boundary === 'poll-network') throw new Error('FIXTURE_POLL_LOST')
      if (boundary === 'poll-403') return json({}, 403)
      return json({ code: 200, data: { taskId: 'fixture-song', status: 'SUCCESS', response: { taskId: 'fixture-song', sunoData: [{ id: 'fixture-song', audio_url: 'https://media.fixture.invalid/music.mp3' }] } } })
    }
    const run = () => executeProductionStep(input, { steps: structuredClone(durable) }, {
      onStepResolved: async (key, value) => {
        if (fault && boundary === 'result-write' && key === 'music') {
          fault = false
          throw new Error('FIXTURE_DB_WRITE_FAILED')
        }
        durable[key] = structuredClone(value)
        if (fault && ((boundary === 'result-ack' && key === 'music') || (boundary === 'stage-ack' && key === 'stage:music'))) {
          fault = false
          throw new Error('FIXTURE_DB_ACK_LOST')
        }
      },
    })
    if (boundary === 'success') await run()
    else await assert.rejects(run)
    const callsBeforeRestart = { submissions, polls }
    if (['result-write', 'result-ack', 'stage-ack', 'success'].includes(boundary)) {
      assert.equal(await run(), 'https://media.fixture.invalid/music.mp3')
      assert.equal((durable['stage:music'] as { status: string }).status, 'complete')
    } else if (['poll-network', 'poll-403'].includes(boundary)) {
      await assert.rejects(run, error => {
        assert.equal((error as { taskId?: string }).taskId, 'fixture-song')
        return true
      })
      assert.equal(durable['stage:music'], undefined)
    } else {
      await assert.rejects(run, /SUTRA_RECONCILIATION_REQUIRED: music/)
      assert.equal(durable['stage:music'], undefined)
    }
    assert.equal(polls, callsBeforeRestart.polls + (['poll-network', 'poll-403', 'result-write'].includes(boundary) ? 1 : 0),
      'only an acknowledged task ID allows a read-only recovery request')
    assert.equal(submissions, 1)
  })
}

test('default Suno adapter: unconfirmed intent never reaches HTTP', async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('UNEXPECTED_HTTP') }
  await assert.rejects(executeProductionStep(input, { steps: {} }, {
    onStepResolved: async () => { throw new Error('FIXTURE_INTENT_NOT_CONFIRMED') },
  }), /FIXTURE_INTENT_NOT_CONFIRMED/)
  assert.equal(calls, 0)
})
