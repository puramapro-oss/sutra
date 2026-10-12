/* eslint-disable no-console */
// Secret-free local gates. The allowlist intentionally excludes provider credentials.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const profile = process.argv[2]
const nodeTests = [
  'scripts/test-api-contracts.mts', 'scripts/test-env-contracts.mts',
  'scripts/test-local-engine.mts', 'scripts/test-shotstack-contracts.mts',
  'scripts/test-production-queue.mts', 'scripts/test-auto-export-queue.mts',
  'scripts/test-release-regressions.mts', 'scripts/test-video-contracts.mjs',
  'scripts/test-opentimestamps.mjs', 'scripts/test-ltx-v2-media.mts',
  'scripts/test-social-publication.mts', 'scripts/test-auth-session.mts',
  'tooling/disposable-database.test.mjs',
]
const profiles = {
  contracts: [
    ['contracts', ['--import', 'tsx', '--test', '--test-concurrency=2', ...nodeTests]],
    ['schedule', ['scripts/test-auto-schedule.mjs']],
    ['composition', ['scripts/test-auto-composition.mjs']],
    ['publication', ['scripts/test-auto-publication.mjs']],
  ],
  media: [['media', ['--import', 'tsx', '--test', 'scripts/test-local-engine-e2e.mts']]],
  quality: [
    ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
    ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
    ['build', ['node_modules/next/dist/bin/next', 'build', '--webpack']],
  ],
}
if (!Object.hasOwn(profiles, profile)) throw new Error('Usage: node scripts/run-ci.mjs contracts|media|quality')
if (readdirSync(root).some(name => name.startsWith('.env') && name !== '.env.example')) {
  throw new Error('Run CI gates in an isolated checkout without local environment files.')
}
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(env, {
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_isolated',
  RESEND_API_KEY: 're_isolated',
})
const output = resolve(root, 'test-results/ci', profile)
mkdirSync(output, { recursive: true })
const results = []
for (const [name, args] of profiles[profile]) {
  const start = Date.now()
  const result = spawnSync(process.execPath, args, {
    cwd: root, env, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024,
  })
  writeFileSync(resolve(output, `${name}.log`), `${result.stdout || ''}${result.stderr || ''}`)
  const pass = result.status === 0 && !result.error && !result.signal
  results.push({ name, command: ['node', ...args], status: pass ? 'PASS' : 'FAIL',
    exitCode: result.status, signal: result.signal, error: result.error?.code,
    durationMs: Date.now() - start })
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} (${result.status ?? result.error?.code ?? result.signal}) — test-results/ci/${profile}/${name}.log`)
}
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
