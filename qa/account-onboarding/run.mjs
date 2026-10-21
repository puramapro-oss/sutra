// Offline tests: no dependency installation, network call or repository build output.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(import.meta.url)
const temp = mkdtempSync(join(tmpdir(), 'sutra-account-onboarding-'))
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', timeout: 120_000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Offline validation failed (${result.status ?? result.signal})`)
}
try {
  writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'CommonJS', strict: true, types: [],
      lib: ['ES2022', 'DOM'], noEmitOnError: true, noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true, outDir: join(temp, 'compiled') },
    files: [join(root, 'src/lib/social-account-onboarding.ts')],
  }))
  let compiler
  try { compiler = require.resolve('typescript/bin/tsc') } catch { /* Use installed global tsc only. */ }
  run(compiler ? process.execPath : 'tsc', [...(compiler ? [compiler] : []), '-p', join(temp, 'tsconfig.json')])
  run(process.execPath, ['--test', join(root, 'qa/account-onboarding/onboarding.test.cjs')], {
    ...process.env, SUTRA_ONBOARDING_TEST_MODULE: join(temp, 'compiled/social-account-onboarding.js'),
  })
} finally {
  rmSync(temp, { recursive: true, force: true }) // Only this process's mkdtemp directory.
}
