// Final exact-candidate replay. Reuses existing tests; all writes stay in this dossier.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const here = import.meta.dirname, root = resolve(here, '../..')
const label = process.argv[2] ?? 'initial'
assert.match(label, /^[a-z0-9-]+$/)
const mode = process.argv[3] ?? 'full'
assert.ok(['full', 'followup'].includes(mode))
const output = join(here, label)
mkdirSync(output) // Never overwrite earlier evidence.
const bin = '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t03-ack-pg-')), data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  T03_PROOF_DIR: output, T03_PG_BIN: bin,
  NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const commands = []
const run = (command, args, log) => {
  const result = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(join(output, `${log}.log`), (result.stdout || '') + (result.stderr || ''))
  commands.push({ command: [command, ...args], log: `${log}.log`, exit_code: result.status, error: result.error?.code })
  return result
}
const requireSuccess = (result, step) => { if (result.status !== 0 || result.error) throw new Error(`PRIVATE_PG_${step}_FAILED; see owned log`) }
const groups = mode === 'followup' ? {
  postgres: ['qa/t03-final-ack-20261019/migration.test.mts'],
  scheduled: ['qa/t01-final-20261015/durable-postgres.test.mts'],
  delivery: ['scripts/test-auto-export-queue.mts', 'scripts/test-social-publication.mts'],
} : {
  postgres: ['qa/t03-durable-closure-20261015/postgres.test.mts', 'qa/t03-durable-reliability-20261014/postgres.test.mts',
    'qa/t03-orchestration-fixes-20261014/finish-postgres.test.mts', 'qa/t03-final-candidate-20261015/api-postgres.test.mts',
    'qa/t03-final-ack-20261019/migration.test.mts'],
  contracts: ['scripts/test-pipeline-interruptions.mts', 'scripts/test-production-queue.mts', 'scripts/test-t03-final-durable.mts',
    'scripts/test-t03-orchestration-fixes.mts', 'scripts/test-t03-durable-reliability.mts', 'scripts/test-t03-salad-recovery.mts',
    'qa/t03-final-durable-20261015/cancellation.test.mts', 'qa/t03-final-durable-20261015/cancel-ack.test.mts',
    'qa/t01-create-cancel-20261016/control.test.mts', 'qa/t01-create-cancel-20261016/submission.test.mts',
    'qa/t01-create-cancel-20261016/client.test.mts', 'qa/t03-final-ack-20261019/port.test.mts'],
}
let started = false
try {
  requireSuccess(run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8',
    '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=20', '-c', 'shared_buffers=16MB'], 'pg-init'), 'INIT')
  requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start'), 'START')
  started = true
  for (const [group, files] of Object.entries(groups)) {
    const selection = group === 'scheduled' ? ['--test-name-pattern=retry has durable backoff|backoff grows'] : []
    const result = run(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-timeout=30000', '--test-concurrency=1', ...selection, ...files], group)
    if (result.status !== 0 || result.error) process.exitCode = 1
  }
} finally {
  if (started) {
    try {
      const settlements = mode === 'followup' ? ['qa/t03-final-ack-20261019/settle.mjs']
        : ['qa/t03-durable-closure-20261015/settle.mjs', 'qa/t03-final-candidate-20261015/settle.mjs']
      for (const file of settlements) {
        const result = run(process.execPath, [file], `settle-${file.split('/')[1]}`)
        if (result.status !== 0 || result.error) process.exitCode = 1
      }
    } finally { requireSuccess(run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop'), 'STOP') }
  }
  const tracked = spawnSync('git', ['ls-files', 'src', 'migrations', 'scripts', 'package.json', 'package-lock.json', 'qa/t03*', 'qa/t01-create-cancel-20261016', 'qa/t08/offline.cjs'], { cwd: root, encoding: 'utf8' })
  requireSuccess(tracked, 'MANIFEST')
  const paths = [...new Set([...tracked.stdout.trim().split('\n'), ...Object.values(groups).flat(),
    'qa/t03-final-ack-20261019/run.mjs', 'qa/t03-final-ack-20261019/settle.mjs',
    'qa/t01-consolidation-20261014/checkpoint-transition.py'])]
  const source_sha256 = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]))
  writeFileSync(join(output, 'receipt.json'), JSON.stringify({ candidate: 'ab935e59ca4e39776630f05b2ba6c0422c74ec62',
    observed_at: new Date().toISOString(), private_cluster: directory, stopped: started, commands, source_sha256,
    environment: 'allowlisted synthetic credentials; loopback PostgreSQL only; offline preload denies external I/O and .env reads',
    real_provider_calls: 0 }, null, 2) + '\n')
  process.stdout.write(`PRIVATE_CLUSTER_${started ? 'STOPPED' : 'NOT_STARTED'}; evidence ${output}\n`)
}
