// Disposable worker process: SQL persistence is real; provider is a pure fixture.
import assert from 'node:assert/strict'
import pg from 'pg'
import { pipelineSteps } from '../../src/lib/pipeline-state'
if (process.env.PGHOST !== '127.0.0.1' || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('PRIVATE_FIXTURE_REQUIRED')
const [id, worker] = process.argv.slice(2)
const client = new pg.Client({ options: '-c search_path=sutra,public' })
await client.connect()
const row = (await client.query('SELECT * FROM video_jobs WHERE id=$1', [id])).rows[0]
assert.equal(row.locked_by, worker)
const done = row.progress.steps ?? {}
let polls = 0
const hooks = {
  heartbeat: async () => { await client.query('SELECT heartbeat_video_job_v2($1,$2,600)', [id, worker]) },
  onStepResolved: async (key: string, value: unknown) => {
    await client.query('SELECT checkpoint_video_job_v2($1,$2,$3,NULL)', [id, worker, { steps: { [key]: value } }])
  },
}
const result = await pipelineSteps(done, hooks)('video', async () => {
  if (!done.remote) {
    await hooks.onStepResolved('remote', { id: 'accepted-before-exit' })
    process.stdout.write('submitted:1\n')
    process.exit(23) // Owned process only; no client close or graceful worker completion.
  }
  assert.equal(done.remote.id, 'accepted-before-exit'); polls++
  return 'https://fixture.invalid/recovered.mp4'
}, true, Boolean(done.remote))
assert.equal(result, 'https://fixture.invalid/recovered.mp4')
await client.end()
process.stdout.write(`submitted:0 polled:${polls}\n`)
