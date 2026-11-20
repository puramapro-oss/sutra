import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const environment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(environment, {
  NODE_OPTIONS: `--require=${resolve(root, 'qa/t08/offline.cjs')}`,
  NODE_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1', LTX_TRACK_DB: '0', OTS_NETWORK: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra.fixture.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
})
const checks = {
  modes: ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-concurrency=1', 'scripts/test-t08-final-modes.mts'],
  typecheck: ['node_modules/typescript/bin/tsc', '--project', 'qa/t08-final-modes/tsconfig.json'],
  lint: ['node_modules/eslint/bin/eslint.js', 'scripts/test-t08-final-modes.mts', 'qa/t08-final-modes/run.mjs', '--max-warnings', '0'],
}
const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(checks)
if (selected.some(name => !Object.hasOwn(checks, name))) throw new Error('Use modes, typecheck or lint')
for (const name of selected) {
  const result = spawnSync(process.execPath, checks[name], { cwd: root, env: environment, encoding: 'utf8', timeout: 60_000 })
  writeFileSync(resolve(import.meta.dirname, `${name}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`)
  writeFileSync(resolve(import.meta.dirname, `${name}.json`), JSON.stringify({
    command: ['node', ...checks[name]], exitCode: result.status, signal: result.signal,
    error: result.error?.code, status: result.status === 0 && !result.error ? 'PASS' : 'FAIL',
    observedAt: new Date().toISOString(), environment: 'allowlist, synthetic only; offline preload; no env file',
  }, null, 2) + '\n')
  process.stdout.write(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (exit ${result.status})\n`)
  if (result.status !== 0 || result.error) process.exitCode = 1
}
