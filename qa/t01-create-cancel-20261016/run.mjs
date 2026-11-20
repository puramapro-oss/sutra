// Reuses the existing private-cluster/offline approach; never inherits credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const here = import.meta.dirname, root = resolve(here, '../..')
const prefix = process.argv[2] || 'first-'
if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error('Invalid receipt name')
const candidate = process.argv.find(arg => arg.startsWith('--candidate='))?.slice(12) || spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error('Invalid candidate SHA')
if ((await import('node:fs')).existsSync(join(here, prefix + 'browser'))) throw new Error('Receipt already exists')
const bin = '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t07-wire-pg-')), data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  T07_CANDIDATE_SHA: candidate, T07_CANCEL_ONLY: process.argv.includes('--cancel-only') ? '1' : '0',
  SUTRA_DISPOSABLE_DB: '1', CRON_SECRET: 'synthetic-local-cron-only', T07_OUTPUT: prefix + 'browser', SUTRA_T07_PGDATA: data, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const run = (command, args, log) => {
  const r = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 300_000 })
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
  const tests = ['qa/t01-create-cancel-20261016/browser.mjs']
  const args = ['--experimental-test-module-mocks', '--import', 'tsx', ...tests]
  const result = run(process.execPath, args, 'browser')
  const files = ['src/hooks/useCreateRequest.ts', 'src/hooks/useVideoGeneration.ts', 'src/lib/create-intent-client.ts', 'src/app/api/create/status/route.ts', 'src/app/(dashboard)/create/page.tsx', 'src/components/production/ProductionRequestStatus.tsx', 'src/lib/video-queue.ts', 'migrations/20261015_final_durable_integrity.sql', 'qa/t01-create-cancel-20261016/browser.mjs', 'qa/t01-create-cancel-20261016/checks.mjs', 'qa/t07-final-wire-20261016/wire.mjs']
  const exitCode = result.status
  writeFileSync(join(here, `${prefix}execution.json`), JSON.stringify({ base: candidate, workingDelta: true, exitCode,
    environment: 'private disposable loopback PostgreSQL; no ambient credentials; external sockets and secret files denied',
    source_sha256: Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')])) }, null, 2))
  process.exitCode = exitCode ?? 1
} finally {
  if (started) {
    try { requireSuccess(run(process.execPath, [join(root, 'qa/t07-final-wire-20261016/settle.mjs')], 'settlement'), 'SETTLEMENT') }
    finally { requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop'), 'STOP') }
  }
  process.stdout.write(`PRIVATE_CLUSTER_${started ? 'STOPPED' : 'NOT_STARTED'} ${directory}\n`)
}
