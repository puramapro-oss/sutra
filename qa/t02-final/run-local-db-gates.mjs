import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
const root = process.cwd(), bin = '/opt/homebrew/opt/postgresql@18/bin'
const directory = mkdtempSync('/tmp/sutra-t02-final-db-'), data = directory + '/data'
const reservation = createServer()
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const env = { LC_ALL: 'C', LANG: 'C', PATH: process.env.PATH, HOME: process.env.HOME, PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'sutra_t02_gate', SUTRA_DISPOSABLE_DB: '1', DATABASE_URL_LOCAL: `postgres://sutra_t02_gate@127.0.0.1:${port}/sutra_ci_t02` }
const pg = (name, args) => execFileSync(`${bin}/${name}`, args, { env, encoding: 'utf8' })
let started = false
try {
  pg('initdb', ['-D', data, '--auth=trust', '--username=sutra_t02_gate', '--no-locale', '--encoding=UTF8'])
  pg('pg_ctl', ['-D', data, '-l', directory + '/server.log', '-o', `-h 127.0.0.1 -k ${directory} -p ${port}`, '-w', 'start']); started = true
  pg('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres', '-c', 'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;'])
  pg('createdb', ['sutra_ci_t02'])
  const results = []
  for (const [name, args] of [['migration-local', ['scripts/test-migration-local.mjs']], ['pipeline-postgres', ['--import', 'tsx', '--test', 'scripts/test-pipeline-postgres.mts']]]) {
    const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', timeout: 180000, maxBuffer: 16*1024*1024 })
    writeFileSync(`qa/t02-final/evidence/${name}.log`, (result.stdout || '') + (result.stderr || ''))
    results.push({ name, exitCode: result.status, error: result.error?.code })
    if (result.status !== 0) process.exitCode = 1
  }
  writeFileSync('qa/t02-final/evidence/local-db.json', JSON.stringify({ directory, port, results }, null, 2) + '\n')
  process.stdout.write(JSON.stringify(results) + '\n')
} finally {
  if (started) pg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  process.stdout.write((started ? 'Own disposable PostgreSQL stopped' : 'Cluster startup failed') + '; fixture retained: ' + directory + '\n')
}
