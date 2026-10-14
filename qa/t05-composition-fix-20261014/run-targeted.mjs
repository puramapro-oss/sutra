// Local delta gate: synthetic configuration only, no inherited credentials.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const proof = resolve(root, 'qa/t05-composition-fix-20261014')
const config = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'T05_FFMPEG_BINARY']
  .flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(config, {
  PATH: `${proof}/cpu-bin:/opt/homebrew/opt/ffmpeg-full/bin:${config.PATH || ''}`,
  NODE_OPTIONS: `--require=${root}/qa/t08/offline.cjs`,
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  T05_COMPOSITION_EVIDENCE: `${proof}/after-measurements.json`,
})
const groups = {
  delta: ['--import', 'tsx', '--test', 'scripts/test-t05-composition-fix.mts'],
  contracts: ['--experimental-test-module-mocks', '--import', 'tsx', '--test', '--test-concurrency=1',
    'scripts/test-shotstack-contracts.mts', 'scripts/test-editor-export.mts', 'scripts/test-export-integration.mts',
    'scripts/test-auto-export-queue.mts', 'src/lib/video-compositor.test.mts'],
  media: ['--experimental-test-module-mocks', '--import', 'tsx', '--import', './scripts/helpers/local-media-fixture.mts',
    '--test', '--test-concurrency=1', 'src/lib/media-validation.test.ts'],
  worker: ['--import', 'tsx', '--test', 'scripts/test-t05-salad-media.mts'],
  auto: ['scripts/test-auto-composition.mjs'],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'qa/t05-composition-fix-20261014/tsconfig.json'],
  lint: ['node_modules/eslint/bin/eslint.js', 'src/lib/composition-contract.ts', 'src/lib/ffmpeg-filters.ts',
    'scripts/test-t05-composition-fix.mts', 'qa/t05-composition-fix-20261014/run-targeted.mjs'],
}
const names = process.argv.slice(2)
if (!names.length || names.some(name => !Object.hasOwn(groups, name))) throw new Error('Choose explicit delta gate groups')
for (const name of names) {
  const result = spawnSync(process.execPath, groups[name], { cwd: root, env: config, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(`${proof}/${name}.log`, (result.stdout || '') + (result.stderr || '') + (result.error ? `\n${result.error.name}\n` : ''))
  process.stdout.write(`${name}: exit=${result.status}\n`)
  if (result.status !== 0) process.exit(result.status || 1)
}
