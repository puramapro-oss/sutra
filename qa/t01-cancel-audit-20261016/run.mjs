// Private local cluster only; never attach to an existing server or inherit credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const here = import.meta.dirname
const root = resolve(here, '../..')
const bin = '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t01-cancel-pg-'))
const data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const label = process.argv[2] === 'before' ? 'before' : 'after'
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  T03_SQL_PROPOSAL: label === 'after' ? '1' : '0', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const run = (command, args, log) => {
  const r = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 120_000 })
  writeFileSync(join(here, `${label}-${log}.log`), (r.stdout || '') + (r.stderr || ''))
  return r
}
const requireSuccess = (result, step) => { if (result.status !== 0 || result.error) throw new Error(`PRIVATE_PG_${step}_FAILED (exit ${result.status}); see owned log`) }
let started = false
try {
  requireSuccess(run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8',
    '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=20', '-c', 'shared_buffers=16MB'], 'pg-init'), 'INIT')
  requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start'), 'START')
  started = true
  const args = ['--import', 'tsx', '--test', join(root, 'qa/t01-final-20261015/durable-postgres.test.mts')]
  const result = run(process.execPath, args, 'postgres')
  const files = ['migrations/v10_durable_jobs_quota.sql', 'migrations/v11_pipeline_checkpoints.sql', 'src/data/setup-schema.ts',
    'migrations/sutra_auto.sql', 'migrations/20261006_auto_occurrence_integrity.sql', 'qa/t01-final-20261015/durable-postgres.test.mts',
    'migrations/20261014_durable_checkpoint_integrity.sql', 'src/lib/pipeline-state.ts',
    'migrations/20261015_final_durable_integrity.sql']
  writeFileSync(join(here, `${label}-postgres.json`), JSON.stringify({ command: [process.execPath, ...args], exit_code: result.status,
    environment: 'private disposable loopback PostgreSQL; no ambient credentials; external sockets and secrets denied',
    proposal_applied_only_to_fixture: label === 'after', source_sha256: Object.fromEntries(files.map(path => [path,
      createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])) }, null, 2) + '\n')
  process.exitCode = result.status ?? 1
} finally {
  if (started) requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop'), 'STOP')
  process.stdout.write(`PRIVATE_CLUSTER_${started ? 'STOPPED' : 'NOT_STARTED'} ${directory}\n`)
}
