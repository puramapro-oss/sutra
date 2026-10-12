// Private, disposable local cluster. No inherited provider or database credentials.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'

const root = resolve(import.meta.dirname, '../..')
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync(join(tmpdir(), 'sutra-t03-resume-pg-'))
const data = join(directory, 'data')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: tmpdir(), LC_ALL: 'C',
  SUTRA_DISPOSABLE_DB: '1', PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'fixture',
  DATABASE_URL_LOCAL: `postgres://fixture@127.0.0.1:${port}/sutra_ci_t03_resume`,
  NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}` }
const run = (command, args, log) => {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 120_000 })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (log) writeFileSync(join(root, 'qa/t03-resume/evidence', log), output)
  if (result.status !== 0 || result.error) throw new Error(`${command} failed: ${output}`)
}
let started = false
try {
  run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username=fixture', '--no-locale', '--encoding=UTF8'])
  run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start'])
  started = true
  if (process.argv.includes('--full')) {
    run(join(bin, 'createdb'), ['sutra_ci_t03_resume'])
    run(process.execPath, ['scripts/test-migration-local.mjs'], 'migration-postgres.txt')
  }
  run(process.execPath, ['--import', 'tsx', '--test', 'scripts/test-pipeline-postgres.mts'],
    process.argv.includes('--baseline') ? 'pipeline-before-fix.txt' : 'pipeline-postgres.txt')
} finally {
  if (started) run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'])
  process.stdout.write(`PRIVATE_CLUSTER_STOPPED ${directory}\n`)
}
