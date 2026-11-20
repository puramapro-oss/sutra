/** Port-level acceptance for a future adapter, NOT a WanGP implementation. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pipelineSteps } from '../../src/lib/pipeline-state'
import { durableLtxJob } from '../../src/lib/ltx-workflow'

test('future visual callback resumes a durable ID without submitting again; duplicate delivery shares one operation', async () => {
  const durable: Record<string, unknown> = {}
  let submissions = 0, polls = 0
  const execute = async (duplicates = 1) => {
    const memory = structuredClone(durable)
    const hooks = { onStepResolved: async (key: string, value: unknown) => { durable[key] = structuredClone(value) } }
    const port = durableLtxJob(memory, 'scene:0:ltx', hooks.onStepResolved)
    const step = pipelineSteps(memory, hooks)
    return Promise.all(Array.from({ length: duplicates }, () => step('scene:0', async () => {
      if (!port.current?.id) {
        await port.save({ endpoint: 'fixture://future-visual', fingerprint: 'fixture-request-hash', started: true })
        submissions++
        await port.save({ ...port.current!, id: 'fixture-remote-id', status: 'processing' })
        throw new Error('WORKER_INTERRUPTED_AFTER_ID_CHECKPOINT')
      }
      polls++
      assert.equal(port.current.id, 'fixture-remote-id')
      return { url: 'https://fixture.invalid/raw.mp4' }
    }, true, Boolean(port.current?.id))))
  }
  await assert.rejects(execute(), /WORKER_INTERRUPTED/)
  const recovered = await execute(12)
  assert.equal(submissions, 1); assert.equal(polls, 1)
  assert.equal(recovered.length, 12)
  await execute(); assert.equal(submissions, 1); assert.equal(polls, 1)
})

test('lost submission response without durable ID quarantines a future callback, with no fallback submission', async () => {
  const durable: Record<string, unknown> = {}
  let submissions = 0
  const execute = () => pipelineSteps(structuredClone(durable), {
    onStepResolved: async (key, value) => { durable[key] = value },
  })('scene:0', async () => { submissions++; throw new Error('RESPONSE_LOST_AFTER_SUBMISSION') }, true)
  await assert.rejects(execute(), /RESPONSE_LOST/)
  await assert.rejects(execute(), /SUTRA_RECONCILIATION_REQUIRED/)
  assert.equal(submissions, 1)
})
