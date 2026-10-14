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
  ['delta', [...testArgs, 'scripts/test-t06-social-validation.mts']],
  ['regressions', [...testArgs, 'scripts/test-t06-social-final.mts', 'scripts/test-t06-social-autonomy.mts', 'scripts/test-social-publication.mts']],
  ['load', [...testArgs, '--test-name-pattern=T08 load: 32 publication', 'qa/t08/integrated/load.test.mts']],
  ['routes', [...testArgs, 'scripts/test-t06-social-routes.mts']],
  ['consumers', [...testArgs, '--test-name-pattern=^PUBLICATION', 'scripts/test-release-regressions.mts']],
  ['journey', [...testArgs, '--test-name-pattern=^J(01|05|06|08|09|11|12|13)', 'scripts/test-t08-integration-journey.mts']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'qa/t06-social-validation-20261014/tsconfig.json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', 'src/lib/publication-journal.ts', 'scripts/helpers/social-database.mts', 'scripts/test-t06-social-autonomy.mts', 'scripts/test-social-publication.mts', 'scripts/test-release-regressions.mts', 'scripts/test-t06-social-validation.mts', 'qa/t08/integrated/load.test.mts', 'qa/t06-social-validation-20261014/run.mjs']],
]

const selected = process.argv.slice(2)
if (selected.some(name => !commands.some(([known]) => known === name))) throw new Error('Unknown targeted gate')
const results = []
// The independent T08 journey fixture is owned and delivered separately by T08.
for (const [name, args] of commands.filter(([name]) => selected.length ? selected.includes(name) : name !== 'journey')) {
  const started = Date.now()
  const run = spawnSync(runtime, args, { cwd: root, env: childEnvironment, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(resolve(output, `${name}.log`), (run.stdout || '') + (run.stderr || ''))
  const result = { name, command: [runtime, ...args], status: run.status === 0 && !run.error && !run.signal ? 'PASS' : 'FAIL', exitCode: run.status, signal: run.signal, error: run.error?.code, durationMs: Date.now() - started }
  results.push(result)
  process.stdout.write(`${result.status} ${name}\n`)
}
writeFileSync(resolve(output, `results${selected.length ? '-' + selected.join('-') : ''}.json`), JSON.stringify(results, null, 2) + '\n')
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
