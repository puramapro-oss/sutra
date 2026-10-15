// Pattern reused from T01's isolated PostgreSQL runner; never opens a shared DB.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const root = resolve(import.meta.dirname, '../..')
const mode = process.argv[2] || 'history'
if (!['history', 'history-t01', 'legacy-cas'].includes(mode)) throw new Error('Unknown PostgreSQL fixture')
const fixture = mode === 'legacy-cas' ? 'qa/t06-social-recovery-20261014/test-postgres.mts' : 'qa/t06-integrated-retest-20261015/history-routes.test.mts'
const label = mode === 'legacy-cas' ? 'postgres-cas-tests' : mode === 'history-t01' ? 'postgres-t01' : 'postgres'
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t06-pg-')), data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const childEnvironment = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', SUTRA_TEST_SOCIAL_HISTORY_FIXTURE: mode === 'history-t01' ? 't01' : 'canonical',
  PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
function run(command, args, name) {
  const result = spawnSync(command, args, { cwd: root, env: childEnvironment, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 })
  if (name) writeFileSync(join(import.meta.dirname, name + '.log'), (result.stdout || '') + (result.stderr || ''))
  if (result.status !== 0) throw new Error('T06_PRIVATE_PG_CHECK_FAILED: ' + (name || command))
}
let started = false
const receipt = { status: 'RUNNING', command: `${process.execPath} qa/t06-integrated-retest-20261015/run-postgres.mjs ${mode}`, fixture, mode, pgBin: bin, database: 'private-loopback-only', clusterPreserved: directory, stopped: false }
try {
  run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8'])
  run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'])
  started = true
  run(process.execPath, ['--experimental-test-module-mocks', '--experimental-vm-modules', '--import', 'tsx', '--test', '--test-reporter=tap', fixture], label)
  receipt.status = 'PASS'
  process.stdout.write(`PASS PostgreSQL T06 ${mode}\n`)
} catch (error) {
  receipt.status = 'FAIL'
  throw error
} finally {
  if (started) { run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']); receipt.stopped = true }
  writeFileSync(join(import.meta.dirname, label + '-result.json'), JSON.stringify(receipt, null, 2) + '\n')
  process.stdout.write('Own isolated PostgreSQL cluster stopped and preserved\n')
}
