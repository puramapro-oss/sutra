// PR3 integration gates; S5 sources and evidence remain historical.
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const profile = process.argv[2] || 'contracts'
if (process.argv.length > 3) throw new Error('No extra arguments supported; filters must never be silently ignored.')
const profiles = {
  redteam: ['--test-reporter=tap', '--import', 'tsx', '--test', '--test-concurrency=1', 'qa/t08/integrated/offline.test.mjs', 'qa/t08/integrated/load.test.mts'],
  'browser-redteam': ['--experimental-test-module-mocks', '--import', './qa/t08/integrated/browser-extension.mjs', 'scripts/test-ui-isolated.mjs'],
  'build-offline': ['node_modules/next/dist/bin/next', 'build', '--webpack'],
  'legacy-offline': ['scripts/test-ui-isolated.mjs', '--legacy'],
}
if (Object.hasOwn(profiles, profile)) {
  if (readdirSync(root).some(name => name.startsWith('.env') && name !== '.env.example')) throw new Error('T08: isolated checkout without environment files required')
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
  Object.assign(env, {
    NODE_OPTIONS: `--require=${resolve(root, 'qa/t08/offline.cjs')}`, CI: '1', NEXT_TELEMETRY_DISABLED: '1',
    SUTRA_UI_PRODUCTION: '1', SUTRA_UI_OUTPUT: resolve(root, 'test-results/t08', profile === 'browser-redteam' ? 'browser' : `${profile}-server`), OTS_NETWORK: '0', LTX_TRACK_DB: '0',
    NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
    NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated',
  })
  if (profile !== 'redteam') {
    const { prepareFontCache } = await import('./integrated/font-cache.mjs')
    env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES = prepareFontCache(process.env.T08_FONT_CACHE)
  }
  const output = resolve(root, 'test-results/t08', profile); mkdirSync(output, { recursive: true })
  const started = Date.now()
  const result = spawnSync(process.execPath, profiles[profile], { cwd: root, env, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 })
  writeFileSync(resolve(output, 'output.txt'), `${result.stdout || ''}${result.stderr || ''}`)
  const status = result.status === 0 && !result.signal && !result.error ? 'PASS' : 'FAIL'
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ profile, status, exitCode: result.status, signal: result.signal, error: result.error?.code,
    command: [process.execPath, ...profiles[profile]], durationMs: Date.now() - started }, null, 2) + '\n')
  process.stdout.write(`${status} ${profile}: test-results/t08/${profile}/output.txt\n`)
  if (status !== 'PASS') process.exitCode = 1
} else {
  process.argv[2] = profile
  await import('../../scripts/run-ci.mjs')
}
