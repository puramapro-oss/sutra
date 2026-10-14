// Targeted delta gate: synthetic credentials, blocked external I/O, no build.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const output = import.meta.dirname
const childEnvironment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(childEnvironment, {
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated',
})
const testArgs = ['--require', './qa/t08/offline.cjs', '--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-reporter=tap']
const commands = [
  ['contracts', [...testArgs, '--test-concurrency=2',
    'scripts/test-t06-social-final.mts', 'scripts/test-release-oauth.mts',
    'scripts/test-t02-oauth-boundaries.mts', 'scripts/test-t06-social-autonomy.mts',
    'scripts/test-social-publication.mts', 'scripts/test-t06-social-routes.mts', 'scripts/test-security-routes.mts']],
  ['publication-consumers', [...testArgs, '--test-name-pattern=^PUBLICATION', 'scripts/test-release-regressions.mts']],
  ['security-fixture', [...testArgs, 'scripts/test-security-routes.mts']],
  ['lint-security', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', 'scripts/test-security-routes.mts']],
  ['lint-qa', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0', 'qa/t06-social-recovery-20261014/run.mjs', 'qa/t06-social-recovery-20261014/run-postgres.mjs', 'qa/t06-social-recovery-20261014/test-postgres.mts']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'qa/t06-social-recovery-20261014/tsconfig.json']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '--max-warnings=0',
    'src/app/api/social/callback/route.ts', 'src/app/api/social/connect/route.ts',
    'src/lib/social-oauth-state.ts', 'src/lib/social-oauth-account.ts', 'src/lib/social-account-revocation.ts',
    'scripts/helpers/social-database.mts', 'scripts/test-release-oauth.mts',
    'scripts/test-t02-oauth-boundaries.mts', 'scripts/test-t06-social-final.mts', 'scripts/test-t06-social-autonomy.mts', 'scripts/test-security-routes.mts']],
]
const selected = process.argv.slice(2)
const results = []
for (const [name, args] of commands.filter(([name]) => selected.length ? selected.includes(name) : !['security-fixture', 'lint-security'].includes(name))) {
  const started = Date.now()
  const run = spawnSync(process.execPath, args, { cwd: root, env: childEnvironment, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(resolve(output, `${name}.log`), (run.stdout || '') + (run.stderr || ''))
  const result = { name, command: ['node', ...args], status: run.status === 0 && !run.error && !run.signal ? 'PASS' : 'FAIL', exitCode: run.status, signal: run.signal, error: run.error?.code, durationMs: Date.now() - started }
  results.push(result)
  process.stdout.write(`${result.status} ${name}\n`)
}
writeFileSync(resolve(output, `results${selected.length ? '-' + selected.join('-') : ''}.json`), JSON.stringify(results, null, 2) + '\n')
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
