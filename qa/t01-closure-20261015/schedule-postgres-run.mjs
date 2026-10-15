// Reuses the existing private-cluster/offline approach; never inherits credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const here = import.meta.dirname, root = resolve(here, '../..')
const pattern = '', prefix = 'schedule-'
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t01-schedule-pg-')), data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const run = (command, args, log) => {
  const r = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 120_000 })
  writeFileSync(join(here, `${prefix}${log}.log`), (r.stdout || '') + (r.stderr || ''))
  return r
}
const requireSuccess = (r, step) => { if (r.status !== 0 || r.error) throw new Error(`PRIVATE_PG_${step}_FAILED (exit ${r.status}); see owned log`) }
let started = false
try {
  requireSuccess(run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8',
    '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=20', '-c', 'shared_buffers=16MB'], 'pg-init'), 'INIT')
  requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start'), 'START')
  started = true
  const tests = ['qa/t01-closure-20261015/schedule-postgres.test.mts']
  const args = ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-timeout=15000', '--test-concurrency=1', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...tests]
  const result = run(process.execPath, args, 'api-postgres')
  const files = [...tests, 'src/app/api/auto/config/route.ts', 'src/lib/auto-schedule-validation.ts', 'package-lock.json']
  writeFileSync(join(here, `${prefix}api-postgres.json`), JSON.stringify({ command: [process.execPath, ...args], exit_code: result.status,
    environment: 'private disposable loopback PostgreSQL; no ambient credentials; external sockets and secret files denied',
    minimal_fixture_schema: true, network_provider_calls: 0,
    source_sha256: Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])) }, null, 2) + '\n')
  process.exitCode = result.status ?? 1
} finally {
  if (started) {
    requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop'), 'STOP')
  }
  process.stdout.write(`PRIVATE_CLUSTER_${started ? 'STOPPED' : 'NOT_STARTED'} ${directory}\n`)
}
