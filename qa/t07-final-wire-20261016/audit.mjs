// Bounded backend-owner reproduction, not an alternative audit implementation.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setupSchema } from '../../src/data/setup-schema.ts'
import { startWire } from './wire.mjs'

const output = resolve('qa/t07-final-wire-20261016', process.env.T07_OUTPUT)
await mkdir(output)
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'legal-test@example.invalid' }
const wire = await startWire(user), requestId = randomUUID(), results = []
const post = body => wire.handle(new Request('http://localhost/api/production', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))
try {
  const begin = setupSchema.indexOf('CREATE TABLE IF NOT EXISTS sutra.activity_logs ('), end = setupSchema.indexOf('\n);', begin)
  assert.ok(begin >= 0 && end > begin)
  await wire.sql(setupSchema.slice(begin, end + 3))
  wire.faults.loseSubmit = true
  assert.equal((await post({ step: 'script', idea: 'Audit gratuit sans fournisseur', template: 'youtube', format: '16:9', requestId })).status, 503)
  const response = await post({ step: 'cancel', targetStep: 'script', requestId, idea: 'Audit gratuit sans fournisseur' })
  assert.equal(response.status, 200); assert.equal((await response.json()).data.cancelled, true)
  const job = (await wire.sql('SELECT id,status,created_at,updated_at FROM video_jobs')).rows[0]
  assert.equal(job.status, 'cancelled'); assert.ok(job.updated_at >= job.created_at)
  const quota = (await wire.sql('SELECT reserved,released FROM video_quota_counters')).rows[0]
  assert.deepEqual(quota, { reserved: 0, released: 1 })
  results.push({ name: 'canonical cancellation and quota', status: 'PASS', job, quota })
  const events = (await wire.sql('SELECT id,user_id,type,description,metadata,created_at FROM activity_logs WHERE user_id=$1', [user.id])).rows
  const triggers = (await wire.sql("SELECT tgname FROM pg_trigger WHERE tgrelid='sutra.video_jobs'::regclass AND NOT tgisinternal")).rows
  const functionBody = (await wire.sql("SELECT pg_get_functiondef('sutra.cancel_video_job(text)'::regprocedure) AS definition")).rows[0].definition
  assert.ok(events.length >= 1, 'AUDIT_GAP: cancellation acknowledged, but no canonical activity event for the actor/job')
  assert.equal(events.length, 1)
  assert.equal(events[0].type, 'video_cancelled')
  assert.deepEqual(events[0].metadata, { job_id: job.id, kind: 'production', previous_status: 'queued', provider_submitted: false })
  const progress = (await wire.sql('SELECT progress FROM video_jobs WHERE id=$1', [job.id])).rows[0].progress
  assert.equal(progress.effects['activity_logs:cancelled'], events[0].id)
  results.push({ name: 'durable cancellation activity event', status: 'PASS', events, triggers })
  await wire.reopen()
  const repeated = await post({ step: 'cancel', targetStep: 'script', requestId, idea: 'Audit gratuit sans fournisseur' })
  assert.equal(repeated.status, 200); assert.equal((await repeated.json()).data.cancelled, false)
  const recovered = await wire.handle(new Request(`http://localhost/api/production?requestId=${requestId}&targetStep=script`))
  assert.equal(recovered.status, 200); assert.equal((await recovered.json()).status, 'cancelled')
  assert.deepEqual((await wire.sql('SELECT id,user_id,type,description,metadata,created_at FROM activity_logs WHERE user_id=$1', [user.id])).rows, events)
  assert.deepEqual((await wire.sql('SELECT reserved,released FROM video_quota_counters')).rows[0], quota)
  results.push({ name: 'restart and repeated API cancellation preserve one audit receipt and one quota release', status: 'PASS' })
  await writeFile(resolve(output, 'cancel-function.sql'), functionBody)
} catch (error) {
  results.push({ name: 'durable cancellation activity event', status: 'FAIL', message: error.message,
    activityEvents: (await wire.sql('SELECT * FROM activity_logs')).rows,
    triggers: (await wire.sql("SELECT tgname FROM pg_trigger WHERE tgrelid='sutra.video_jobs'::regclass AND NOT tgisinternal")).rows })
  await writeFile(resolve(output, 'cancel-function.sql'), (await wire.sql("SELECT pg_get_functiondef('sutra.cancel_video_job(text)'::regprocedure) AS definition")).rows[0].definition)
  process.exitCode = 1
} finally {
  await wire.close(output)
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ baseCommit: process.env.T07_CANDIDATE_SHA,
    scope: 'canonical production handler + canonical cancellation SQL; minimal canonical activity table; no deployed audit certification', results }, null, 2) + '\n')
  for (const result of results) process.stdout.write(`${result.status} ${result.name}${result.message ? ': ' + result.message : ''}\n`)
}
