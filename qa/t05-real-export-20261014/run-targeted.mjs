import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const proof = resolve(root, 'qa/t05-real-export-20261014')
const config = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot']
  .flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(config, {
  PATH: `${root}/qa/t05-composition-fix-20261014/cpu-bin:/opt/homebrew/opt/ffmpeg-full/bin:${config.PATH || ''}`,
  NODE_OPTIONS: `--require=${root}/qa/t08/offline.cjs`, CI: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
})
const groups = {
  exports: ['--import', 'tsx', '--test', 'scripts/test-t05-real-export.mts'],
  followup: ['--import', 'tsx', '--test', '--test-name-pattern=retained CPU export 16:9 (video-only|all-required):|bad source expired|fallback returning input URL', 'scripts/test-t05-real-export.mts'],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'qa/t05-real-export-20261014/tsconfig.json'],
  lint: ['node_modules/eslint/bin/eslint.js', 'scripts/test-t05-real-export.mts',
    'qa/t05-real-export-20261014/helpers.mts', 'qa/t05-real-export-20261014/run-targeted.mjs'],
}
const names = process.argv.slice(2)
if (!names.length || names.some(name => !Object.hasOwn(groups, name))) throw new Error('Choose explicit delta gate groups')
for (const name of names) {
  const result = spawnSync(process.execPath, groups[name], { cwd: root,
    env: { ...config, T05_REAL_EXPORT_EVIDENCE: `${proof}/${name === 'followup' ? 'followup-measurements' : 'measurements'}.json` },
    encoding: 'utf8', timeout: 360000, maxBuffer: 8 * 1024 * 1024 })
  writeFileSync(`${proof}/${name}.log`, (result.stdout || '') + (result.stderr || '') + (result.error ? `\n${result.error.name}\n` : ''))
  process.stdout.write(`${name}: exit=${result.status}\n`)
  if (result.status !== 0) process.exit(result.status || 1)
}
