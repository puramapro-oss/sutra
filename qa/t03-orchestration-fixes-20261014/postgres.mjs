// Disposable local cluster, fixtures only. No remote DB or inherited credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const here = import.meta.dirname
const root = resolve(here, '../..')
const bin = '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t03-finish-pg-'))
const data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const run = (command, args, log) => {
  const r = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 120_000 })
  if (log) writeFileSync(join(here, log), (r.stdout || '') + (r.stderr || ''))
  if (log === 'postgres.log') writeFileSync(join(here, 'postgres.json'), JSON.stringify({
    command: [command, ...args], exit_code: r.status, environment: 'disposable private loopback PostgreSQL; external sockets and secrets denied',
    source_sha256: Object.fromEntries(['src/lib/video-queue.ts', 'migrations/v10_durable_jobs_quota.sql', 'migrations/v11_pipeline_checkpoints.sql',
      'qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts'].map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])),
  }, null, 2) + '\n')
  if (r.status !== 0 || r.error) throw new Error(`Fixture command failed; see ${log || 'cluster setup'} (exit ${r.status})`)
}
let started = false
try {
  run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8'], 'pg-init.log')
  run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start.log')
  started = true
  run(process.execPath, ['--import', 'tsx', '--test', join(here, 'finish-postgres.test.mts')], 'postgres.log')
} finally {
  if (started) run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop.log')
  process.stdout.write(`PRIVATE_CLUSTER_STOPPED ${directory}\n`)
}
