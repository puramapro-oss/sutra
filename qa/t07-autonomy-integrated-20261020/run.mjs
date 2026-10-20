// Own QA receipts, canonical product and disposable PostgreSQL only.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const root = resolve(import.meta.dirname, '../..'), label = process.argv[2]
assert.match(label ?? '', /^[a-z0-9-]+$/)
const git = args => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(r.status, 0); return r.stdout.trim()
}
const candidate = process.argv[3]
assert.match(candidate ?? '', /^[a-f0-9]{40}$/)
assert.equal(git(['rev-parse', 'HEAD']), candidate, 'run from the exact committed candidate')
assert.equal(git(['diff', candidate, '--', 'src', 'migrations', 'package.json', 'package-lock.json']), '')
const output = join(import.meta.dirname, label); mkdirSync(output)
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t07-wire-pg-')), data = join(directory, 'data')
const socket = createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r))
const port = socket.address().port; await new Promise(r => socket.close(r))
const fixture = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_TEST_PG_BIN: bin, SUTRA_DISPOSABLE_DB: '1', SUTRA_T07_PGDATA: data,
  PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  T07_PROOF_DIR: output, T07_CANDIDATE_SHA: candidate,
  CRON_SECRET: 'synthetic-local-cron-only', NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}`,
}
const commands = []
const run = (command, args, log) => {
  const r = spawnSync(command, args, { cwd: root, env: fixture, encoding: 'utf8', timeout: 120000, maxBuffer: 8e6 })
  writeFileSync(join(output, log + '.log'), (r.stdout || '') + (r.stderr || ''))
  commands.push({ command: [command, ...args], log: log + '.log', exit_code: r.status, error: r.error?.code })
  return r.status === 0 && !r.error
}
let started = false, stopped = false
try {
  assert.ok(run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8',
    '-c', 'shared_memory_type=mmap', '-c', 'dynamic_shared_memory_type=posix', '-c', 'max_connections=30', '-c', 'shared_buffers=16MB'], 'pg-init'))
  assert.ok(run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'], 'pg-start'))
  started = true
  if (!run(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', 'qa/t07-autonomy-integrated-20261020/countertest.mjs'], 'countertest')) process.exitCode = 1
  if (!run(process.execPath, ['--experimental-test-module-mocks', '--import', 'tsx', '--test',
    'qa/t03-final-ack-20261019/port.test.mts'], 'future-port')) process.exitCode = 1
} finally {
  if (started) {
    try {
      if (!run(process.execPath, ['qa/t07-final-wire-20261016/settle.mjs'], 'settlement')) process.exitCode = 1
    } finally {
      stopped = run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], 'pg-stop')
      if (!stopped) process.exitCode = 1
    }
  }
  const files = git(['ls-files', 'src', 'migrations', 'package.json', 'package-lock.json', 'qa/t08/offline.cjs',
    'qa/t07-final-wire-20261016/settle.mjs', 'qa/t03-final-ack-20261019/port.test.mts']).split('\n')
  files.push('qa/t07-autonomy-integrated-20261020/run.mjs', 'qa/t07-autonomy-integrated-20261020/wire.mjs',
    'qa/t07-autonomy-integrated-20261020/countertest.mjs')
  writeFileSync(join(output, 'receipt.json'), JSON.stringify({ candidate, label, commands, started, stopped,
    private_cluster: directory, external_calls: 0, environment: 'synthetic allowlist + T08 external socket/fetch/env-file guard',
    source_sha256: Object.fromEntries(files.map(p => [p, createHash('sha256').update(readFileSync(join(root, p))).digest('hex')])),
  }, null, 2) + '\n')
  process.stdout.write(`PRIVATE_CLUSTER_STOPPED=${stopped}; receipts=${output}\n`)
}
