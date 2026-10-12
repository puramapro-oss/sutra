// Simulated T06 gate, without inherited provider or database credentials.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
if (readdirSync(root).some(name => name.startsWith('.env') && name !== '.env.example')) {
  throw new Error('Use an isolated checkout without local environment files')
}
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(env, {
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated',
})
const output = resolve(root, 'test-results/t06')
mkdirSync(output, { recursive: true })
const lintConfig = process.argv[2] ? ['--config', resolve(process.argv[2])] : []
const commands = [
  ['contracts', ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-concurrency=2',
    'scripts/test-social-publication.mts', 'scripts/test-t06-social-autonomy.mts',
    'scripts/test-t06-social-routes.mts', 'scripts/test-release-regressions.mts']],
  ['schedule', ['scripts/test-auto-schedule.mjs']],
  ['publication-helper', ['scripts/test-auto-publication.mjs']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
  ['lint-global', ['node_modules/eslint/bin/eslint.js', '.', ...lintConfig, '--format', 'json']],
  ['build', ['node_modules/next/dist/bin/next', 'build', '--webpack']],
]
const results = []
const record = result => {
  results.push(result)
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  console.error(`${result.status} ${result.name}`)
}
for (const [name, args] of commands) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8',
    timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 })
  writeFileSync(resolve(output, `${name}.log`), result.stdout || '')
  writeFileSync(resolve(output, `${name}.stderr.log`), result.stderr || '')
  record({ name, command: ['node', ...args], status: result.status === 0 && !result.error && !result.signal ? 'PASS' : 'FAIL',
    exitCode: result.status, signal: result.signal, error: result.error?.code, durationMs: Date.now() - started })
  if (name === 'lint-global') {
    const owned = new Set(['src/lib/auto-publication.ts', 'src/lib/publication-journal.ts', 'src/lib/social-publication.ts',
      'src/lib/social-account-revocation.ts', 'src/lib/sutra-auto.ts', 'src/lib/sutra-auto-utils.ts', 'src/lib/zernio.ts',
      'src/app/api/auto/videos/[id]/route.ts', 'src/app/api/cron/sutra-auto/route.ts',
      'src/app/api/social/accounts/route.ts', 'src/app/api/social/publish/route.ts',
      'scripts/test-auto-publication.mjs', 'scripts/test-auto-schedule.mjs', 'scripts/test-release-regressions.mts',
      'scripts/test-social-publication.mts', 'scripts/helpers/social-database.mts', 'scripts/test-t06-gate.mjs',
      'scripts/test-t06-social-autonomy.mts', 'scripts/test-t06-social-routes.mts'])
    try {
      const entries = JSON.parse(result.stdout).filter(entry => owned.has(relative(root, entry.filePath)))
      const errors = entries.reduce((sum, entry) => sum + entry.errorCount + entry.fatalErrorCount, 0)
      const warnings = entries.reduce((sum, entry) => sum + entry.warningCount, 0)
      record({ name: 'lint-t06', status: entries.length === owned.size && !errors && !warnings ? 'PASS' : 'FAIL',
        files: entries.length, expectedFiles: owned.size, errors, warnings })
    } catch { record({ name: 'lint-t06', status: 'FAIL', error: 'No complete lint report' }) }
  }
}
// A global failure is never hidden by a clean scoped result.
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
