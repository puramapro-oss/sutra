// Targeted delta gate: synthetic credentials, blocked external I/O, no build.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const output = import.meta.dirname
const runtime = process.env.SUTRA_QA_NODE_BINARY || process.execPath
const childEnvironment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(childEnvironment, {
  CI: '1', NODE_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NODE_OPTIONS: `--require=${resolve(root, 'qa/t08/offline.cjs')}`,
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated',
  ZERNIO_API_KEY: 'fixture-only',
})
const testArgs = ['--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--experimental-vm-modules', '--import', 'tsx', '--test', '--test-reporter=tap']
const commands = [
  ['history-contract', [...testArgs, 'qa/t06-final-social-20261015/history-contract.test.mts']],
  ['delta', [...testArgs, 'scripts/test-t06-final-social.mts']],
  ['oauth-regressions', [...testArgs, 'scripts/test-t06-social-final.mts', 'scripts/test-t06-social-routes.mts']],
  ['security-consumers', [...testArgs, 'scripts/test-t02-oauth-boundaries.mts', 'scripts/test-security-routes.mts', 'qa/t08/providers-20261013/provider-contract-redteam.test.mts']],
  ['revocation-consumer', [...testArgs, '--test-name-pattern=revocation locale precedente', 'scripts/test-t06-social-autonomy.mts']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'qa/t06-final-social-20261015/tsconfig.json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', 'src/app/api/social/callback/route.ts', 'src/lib/social-account-revocation.ts', 'scripts/test-t06-final-social.mts', 'scripts/test-t06-social-routes.mts', 'qa/t06-social-recovery-20261014/test-postgres.mts', 'qa/t06-final-social-20261015/history-contract.test.mts', 'qa/t06-final-social-20261015/run.mjs', 'qa/t06-final-social-20261015/run-postgres.mjs']],
]

const selected = process.argv.slice(2)
if (selected.some(name => !commands.some(([known]) => known === name))) throw new Error('Unknown targeted gate')
// The separate history-contract exposes an open SQL-owner requirement; never count it as PASS.
const results = []
for (const [name, args] of commands.filter(([name]) => selected.length ? selected.includes(name) : name !== 'history-contract')) {
  const started = Date.now()
  const run = spawnSync(runtime, args, { cwd: root, env: childEnvironment, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(resolve(output, `${name}.log`), (run.stdout || '') + (run.stderr || ''))
  const result = { name, command: [runtime, ...args], status: run.status === 0 && !run.error && !run.signal ? 'PASS' : 'FAIL', exitCode: run.status, signal: run.signal, error: run.error?.code, durationMs: Date.now() - started }
  results.push(result)
  process.stdout.write(`${result.status} ${name}\n`)
}
writeFileSync(resolve(output, `results${selected.length ? '-' + selected.join('-') : ''}.json`), JSON.stringify(results, null, 2) + '\n')
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
