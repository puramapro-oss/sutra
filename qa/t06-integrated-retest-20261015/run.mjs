// Candidate integration gate. Synthetic credentials, external I/O blocked, no build.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const runtime = process.env.SUTRA_QA_NODE_BINARY || process.execPath
const childEnvironment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(childEnvironment, {
  CI: '1', NODE_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NODE_OPTIONS: `--require=${resolve(root, 'qa/t08/offline.cjs')}`,
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated', ZERNIO_API_KEY: 'fixture-only',
})
if (process.env.SUTRA_TEST_PG_BIN) childEnvironment.SUTRA_TEST_PG_BIN = process.env.SUTRA_TEST_PG_BIN
const testArgs = ['--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--experimental-vm-modules', '--import', 'tsx', '--test', '--test-reporter=tap']
const commands = [
  ['oauth', [...testArgs, 'scripts/test-t06-final-social.mts', 'scripts/test-t06-social-final.mts', 'scripts/test-t06-social-routes.mts', 'scripts/test-t02-oauth-boundaries.mts']],
  ['publication', [...testArgs, 'scripts/test-t06-social-autonomy.mts', 'scripts/test-t06-social-validation.mts', 'scripts/test-social-publication.mts']],
  ['schedule', ['scripts/test-auto-schedule.mjs']],
  ['auto-publication', ['scripts/test-auto-publication.mjs']],
  ['history', ['qa/t06-integrated-retest-20261015/run-postgres.mjs']],
  ['history-t01', ['qa/t06-integrated-retest-20261015/run-postgres.mjs', 'history-t01']],
  ['postgres-cas', ['qa/t06-integrated-retest-20261015/run-postgres.mjs', 'legacy-cas']],
  ['revocation-consumer', [...testArgs, '--test-name-pattern=revocation locale precedente', 'scripts/test-t06-social-autonomy.mts']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'qa/t06-integrated-retest-20261015/tsconfig.json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', 'src/lib/social-account-revocation.ts', 'qa/t06-integrated-retest-20261015/run.mjs', 'qa/t06-integrated-retest-20261015/run-postgres.mjs', 'qa/t06-integrated-retest-20261015/history-routes.test.mts']],
]
const selected = process.argv.slice(2)
if (selected.some(name => !commands.some(([known]) => known === name))) throw new Error('Unknown targeted gate')
for (const [name, args] of commands.filter(([name]) => selected.length ? selected.includes(name) : true)) {
  const started = Date.now()
  const run = spawnSync(runtime, args, { cwd: root, env: childEnvironment, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
  const log = (run.stdout || '') + (run.stderr || '')
  writeFileSync(resolve(import.meta.dirname, `${name}.log`), log)
  const result = { name, command: [runtime, ...args], status: run.status === 0 && !run.error && !run.signal ? 'PASS' : 'FAIL',
    exitCode: run.status, signal: run.signal, error: run.error?.code, durationMs: Date.now() - started,
    tests: log.match(/^# tests (\d+)$/m)?.[1], pass: log.match(/^# pass (\d+)$/m)?.[1], fail: log.match(/^# fail (\d+)$/m)?.[1], skipped: log.match(/^# skipped (\d+)$/m)?.[1] }
  writeFileSync(resolve(import.meta.dirname, `${name}-result.json`), JSON.stringify(result, null, 2) + '\n')
  process.stdout.write(`${result.status} ${name}\n`)
  if (result.status !== 'PASS') process.exitCode = 1
}
