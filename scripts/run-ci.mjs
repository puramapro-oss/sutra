/* eslint-disable no-console */
// Secret-free local gates. The allowlist intentionally excludes provider credentials.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const profile = process.argv[2]
const nodeTests = [
  'scripts/test-salad-worker.mts', 'scripts/test-salad-host.mts', 'scripts/test-t03-salad-recovery.mts',
  'qa/t02-salad-security-20261014/test-t02-salad-security-contract.mts',
  'qa/t03-salad-recovery-20261014/adapter-recovery.test.mts',
  'scripts/test-t06-social-final.mts', 'scripts/test-t08-final-modes.mts',
  'scripts/test-insee.mjs', 'scripts/test-editor-export.mts', 'scripts/test-export-integration.mts', 'scripts/test-integration.mts', 'scripts/test-ltx-tiers.mjs', 'scripts/test-karma-split.mjs',
  'scripts/test-api-contracts.mts', 'scripts/test-env-contracts.mts', 'scripts/test-suno-contract.mts',
  'qa/t03-provider-complement-20261013/music-recovery.test.mts',
  'qa/t08/providers-20261013/provider-contract-redteam.test.mts',
  'scripts/test-local-engine.mts', 'scripts/test-shotstack-contracts.mts',
  'scripts/test-production-queue.mts', 'scripts/test-auto-export-queue.mts',
  'scripts/test-release-regressions.mts', 'scripts/test-video-contracts.mjs',
  'scripts/test-opentimestamps.mjs', 'scripts/test-ltx-v2-media.mts',
  'scripts/test-social-publication.mts', 'scripts/test-auth-session.mts', 'scripts/test-public-origin.mts',
  'tooling/disposable-database.test.mjs',
  'scripts/test-pipeline-interruptions.mts', 'scripts/test-pipeline-submit.mts',
  'scripts/test-release-oauth.mts', 'scripts/test-zernio-oauth-contracts.mts', 'scripts/test-security-account.mts', 'scripts/test-t02-oauth-boundaries.mts',
  'scripts/test-private-media.mts', 'scripts/test-security-media.mts', 'scripts/test-security-routes.mts', 'scripts/test-security-storage.mts',
  'scripts/test-t06-social-autonomy.mts', 'scripts/test-t06-social-routes.mts',
  'scripts/test-ltx-v2-contracts.mts', 'scripts/test-provider-safety.mts',
  'src/lib/video-compositor.test.mts', 'src/lib/ffmpeg-concurrency.test.ts',

]
const profiles = {
  contracts: [
    ['contracts', ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-concurrency=2', ...nodeTests]],
    ['schedule', ['scripts/test-auto-schedule.mjs']],
    ['composition', ['scripts/test-auto-composition.mjs']],
    ['publication', ['scripts/test-auto-publication.mjs']],
  ],
  media: [
    ['salad-media', ['--import', 'tsx', '--test', 'scripts/test-t05-salad-media.mts']],
    ['local-engine', ['--import', 'tsx', '--test', 'scripts/test-local-engine-e2e.mts']],
    ['compositor', ['--experimental-test-module-mocks', '--import', 'tsx', '--import', './scripts/helpers/local-media-fixture.mts', '--test', '--test-concurrency=1', 'src/lib/ffmpeg-compositor.test.ts', 'src/lib/ffmpeg-compositor-formats.test.ts', 'src/lib/media-validation.test.ts']],
  ],
  browser: [['browser', ['scripts/test-ui-isolated.mjs']]],
  'browser-profiles': [['profiles', ['scripts/test-ui-isolated.mjs', '--profile-only']]],
  editor: [['editor', ['scripts/test-ui-isolated.mjs', '--editor-only']]],
  legacy: [['legacy', ['scripts/test-ui-isolated.mjs', '--legacy']]],
  'legacy-regressions': [['legacy-regressions', ['scripts/test-ui-isolated.mjs', '--legacy', '--legacy-regressions']]],
  quality: [
    ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false']],
    ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
    ['build', ['node_modules/next/dist/bin/next', 'build', '--webpack']],
  ],
}
if (!Object.hasOwn(profiles, profile)) throw new Error('Usage: node scripts/run-ci.mjs contracts|media|quality|browser|browser-profiles|editor|legacy|legacy-regressions')
if (readdirSync(root).some(name => name.startsWith('.env') && name !== '.env.example')) {
  throw new Error('Run CI gates in an isolated checkout without local environment files.')
}
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key =>
  process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(env, {
  T02_SALAD_TARGET: root, T03_SALAD_SOURCE: root,
  NODE_OPTIONS: `--require=${resolve(root, 'qa/t08/offline.cjs')}`,
  CI: '1', SUTRA_UI_PRODUCTION: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
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
