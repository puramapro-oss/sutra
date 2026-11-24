import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const output = path.join(root, 'qa/t08/providers-20261013')
await mkdir(output, { recursive: true })
// Explicit allowlist: never inherit supplier, Supabase, cloud, SSH or master credentials.
const fixture = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  CI: '1', NEXT_TELEMETRY_DISABLED: '1', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
  NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  NODE_OPTIONS: `--require=${path.join(root, 'qa/t08/offline.cjs')}`,
}
const commands = {
  redteam: ['--experimental-test-module-mocks', '--import', 'tsx', '--test',
    '--test-concurrency=1', 'qa/t08/providers-20261013/provider-contract-redteam.test.mts'],
  typegen: ['node_modules/next/dist/bin/next', 'typegen'],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/eslint/bin/eslint.js', '.'],
}
const name = process.argv[2]
if (!(name in commands)) throw new Error('Specify redteam, typegen, typecheck or lint')
let stdout = '', stderr = ''
const start = Date.now()
const child = spawn(process.execPath, commands[name], { cwd: root, env: fixture, stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.on('data', chunk => { stdout += chunk })
child.stderr.on('data', chunk => { stderr += chunk })
const timer = setTimeout(() => { child.kill('SIGTERM') }, 120_000)
const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject)
  child.on('exit', (code, signal) => resolve(signal ? 124 : code ?? 1))
}).finally(() => clearTimeout(timer))
await writeFile(path.join(output, `${name}.log`), `${stdout}${stderr}`)
const result = { name, command: [process.execPath, ...commands[name]], exitCode,
  elapsedMs: Date.now() - start, fixtureOnly: true, networkGuard: 'qa/t08/offline.cjs' }
await writeFile(path.join(output, `${name}.json`), JSON.stringify(result, null, 2) + '\n')
process.stdout.write(JSON.stringify(result) + '\n')
process.exitCode = exitCode
