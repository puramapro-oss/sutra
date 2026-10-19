// Private loopback cluster only; no source secrets or remote database access.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '../..')
const label = process.argv[2] ?? 'partner-pg'
assert.match(label, /^[a-z0-9-]+$/)
const output = join(import.meta.dirname, label)
mkdirSync(output)
const cluster = mkdtempSync(join(tmpdir(), 'sutra-t01-partner-'))
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture', PGDATABASE: 'sutra_ci_partner_local',
  SUTRA_DISPOSABLE_DB: '1', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const commands = []
const run = (name, cmd, args) => {
  const result = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 })
  writeFileSync(join(output, name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''))
  commands.push({ name, command: [cmd, ...args], exit: result.status, error: result.error?.code })
  assert.equal(result.status, 0, `${name} failed; see bounded fixture log`)
  return result.stdout
}
let started = false, stopped = false
try {
  run('init', join(bin, 'initdb'), ['-D', join(cluster, 'data'), '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8', '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=24', '-c', 'shared_buffers=16MB'])
  run('start', join(bin, 'pg_ctl'), ['-D', join(cluster, 'data'), '-l', join(cluster, 'server.log'), '-o', `-h 127.0.0.1 -k ${cluster} -p ${port}`, '-w', 'start']); started = true
  run('create', join(bin, 'createdb'), ['sutra_ci_partner_local'])
  run('tests', process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-concurrency=1', 'qa/t01-certification-20261019/partner-postgres.test.mts'])
  run('backup', join(bin, 'pg_dump'), ['--format=custom', '--file=' + join(output, 'private.dump')])
  run('create-restore', join(bin, 'createdb'), ['sutra_ci_partner_restored'])
  run('restore', join(bin, 'pg_restore'), ['--exit-on-error', '--dbname=sutra_ci_partner_restored', join(output, 'private.dump')])
  const sql = "SELECT count(*), md5(string_agg(row_to_json(s)::text,',' ORDER BY id)) FROM sutra.partner_scans s"
  const before = run('rows-before', join(bin, 'psql'), ['-AtX', '-c', sql])
  const restored = run('rows-restored', join(bin, 'psql'), ['--dbname=sutra_ci_partner_restored', '-AtX', '-c', sql])
  assert.equal(restored, before, 'restored history exact')
} catch (error) { process.exitCode = 1; process.stderr.write(String(error.message) + '\n') }
finally {
  if (started) { run('stop', join(bin, 'pg_ctl'), ['-D', join(cluster, 'data'), '-m', 'fast', '-w', 'stop']); stopped = true }
  const paths = ['migrations/20261019_partner_scan_atomic.sql', 'migrations/20261019_partner_scan_atomic.rollback.sql', 'src/app/api/partner/scan/[code]/route.ts', 'qa/t01-certification-20261019/partner-postgres.test.mts']
  const hashes = Object.fromEntries(paths.map(p => [p, createHash('sha256').update(readFileSync(join(root, p))).digest('hex')]))
  writeFileSync(join(output, 'receipt.json'), JSON.stringify({ commands, hashes, cluster, stopped, providerCalls: 0, remoteChanges: 0, result: process.exitCode ? 'FAIL' : 'PASS' }, null, 2) + '\n')
  process.stdout.write(`Private PostgreSQL: ${process.exitCode ? 'FAIL' : 'PASS'}; stopped=${stopped}\n`)
}
