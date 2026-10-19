import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
const root = resolve(import.meta.dirname, '../..'), label = process.argv[2]
assert.match(label ?? '', /^[a-z0-9-]+$/)
const mode = process.argv[3] ?? 'recovery'
assert.ok(['red','recovery','gate'].includes(mode))
const output = join(import.meta.dirname, label); mkdirSync(output)
const bin = process.env.SUTRA_TEST_PG_BIN ?? '/opt/homebrew/opt/postgresql@18/bin', directory = mkdtempSync(join(tmpdir(), 'sutra-t03-closure-pg-')), data = join(directory, 'data')
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r))
const port = socket.address().port; await new Promise(r => socket.close(r))
const fixture = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  T03_PROOF_DIR: output, T03_PG_BIN: bin, T03_PGDATA: data,
  CRON_SECRET: 'synthetic-local-cron-only', NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const commands = []
const run = (command, args, log, extra = {}) => {
  const r = spawnSync(command, args, { cwd: root, env: { ...fixture, ...extra }, encoding: 'utf8', timeout: 120000, maxBuffer: 8e6 })
  writeFileSync(join(output, log + '.log'), (r.stdout || '') + (r.stderr || ''))
  commands.push({ command: [command, ...args], log: log + '.log', exit_code: r.status, error: r.error?.code })
  return r.status === 0 && !r.error
}
const node = ['--experimental-test-module-mocks', '--import', 'tsx']
const test = (files, label, selection = []) => { if (!run(process.execPath, [...node, '--test', '--test-timeout=30000', '--test-concurrency=1', ...selection, ...files], label)) process.exitCode = 1 }
let started = false
try {
  assert.ok(run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8', '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=30', '-c', 'shared_buffers=16MB'], 'pg-init'))
  assert.ok(run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start')); started = true
  if (mode === 'red') {
    if (!run(process.execPath, [...node, 'qa/t03-closure-20261020/reproduce.mjs'], 'r107-red')) process.exitCode = 1
  } else {
    test(['qa/t03-closure-20261020/recovery.test.mts'], 'recovery')
    if (mode === 'gate') {
      test(['qa/t03-durable-closure-20261015/postgres.test.mts', 'qa/t03-final-ack-20261019/migration.test.mts'], 'postgres')
      test(['qa/t01-final-20261015/durable-postgres.test.mts'], 'backoff', ['--test-name-pattern=retry has durable backoff|backoff grows'])
      test(['scripts/test-pipeline-interruptions.mts', 'scripts/test-production-queue.mts', 'scripts/test-t03-final-durable.mts',
        'qa/t03-final-durable-20261015/cancellation.test.mts', 'qa/t03-final-durable-20261015/cancel-ack.test.mts',
        'qa/t03-final-ack-20261019/port.test.mts'], 'contracts')
      test(['scripts/test-auto-export-queue.mts', 'scripts/test-social-publication.mts', 'scripts/test-t06-social-routes.mts'], 'delivery')
      for (const [args, log] of [
        [['scripts/test-auto-schedule.mjs'], 'calendar'],
        [['node_modules/typescript/bin/tsc','-p','qa/t03-closure-20261020/tsconfig.json','--pretty','false'], 'typecheck'],
        [['node_modules/eslint/bin/eslint.js','--max-warnings','0','src/app/api/cron/sutra-auto/route.ts','src/lib/auto-scheduler.ts',
          'qa/t03-closure-20261020/recovery.test.mts','qa/t03-closure-20261020/run.mjs','qa/t03-closure-20261020/reproduce.mjs'], 'lint'],
      ]) if (!run(process.execPath, args, log)) process.exitCode = 1
      if (!run('git',['diff','--check'],'diff-check')) process.exitCode = 1
    }
  }
} finally {
  if (started) {
    try {
      if (mode === 'gate') for (const file of ['qa/t03-durable-closure-20261015/settle.mjs','qa/t03-final-ack-20261019/settle.mjs']) {
        if (!run(process.execPath,[file],`settle-${file.split('/')[1]}`)) process.exitCode=1
      }
    } finally { assert.ok(run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop')) }
  }
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'migrations', 'scripts', 'qa/t03-closure-20261020/*.mts', 'qa/t03-closure-20261020/*.mjs', 'qa/t03-closure-20261020/tsconfig.json', 'qa/t03-final-ack-20261019/*.mts', 'qa/t03-final-ack-20261019/settle.mjs', 'qa/t03-final-durable-20261015/*.mts', 'qa/t03-durable-closure-20261015/*.mts', 'qa/t03-durable-closure-20261015/settle.mjs', 'qa/t01-final-20261015/durable-postgres.test.mts', 'qa/t08/offline.cjs', 'package.json', 'package-lock.json']).split('\n').filter(Boolean)
  const source_sha256 = Object.fromEntries(files.map(p => [p, createHash('sha256').update(readFileSync(join(root,p))).digest('hex')]))
  writeFileSync(join(output, 'receipt.json'), JSON.stringify({ candidate: git(['rev-parse','HEAD']), mode, commands, source_sha256,
    private_cluster: directory, stopped: started, external_calls: 0, synthetic_environment_only: true }, null, 2)+'\n')
  process.stdout.write(`PRIVATE_CLUSTER_STOPPED: ${output}\n`)
}
