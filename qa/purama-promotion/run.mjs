import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const out = mkdtempSync(join(tmpdir(), 'sutra-purama-promotion-'))
try {
  const localCompiler = join(root, 'node_modules/typescript/bin/tsc')
  const { existsSync } = await import('node:fs')
  const command = existsSync(localCompiler) ? process.execPath : 'tsc'
  const args = [...(existsSync(localCompiler) ? [localCompiler] : []),
    join(root, 'src/lib/purama-promotion-plan.ts'), '--target', 'ES2022', '--module', 'commonjs',
    '--strict', '--skipLibCheck', '--outDir', out]
  const compile = spawnSync(command, args, { stdio: 'inherit', shell: false })
  if (compile.error) throw compile.error
  if (compile.status !== 0) process.exitCode = compile.status ?? 1
  else {
    const result = spawnSync(process.execPath, ['--test', join(root, 'qa/purama-promotion/promotion.test.cjs')], {
      stdio: 'inherit', shell: false,
      env: { ...process.env, SUTRA_PROMOTION_MODULE: join(out, 'purama-promotion-plan.js') },
    })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  }
} finally { rmSync(out, { recursive: true, force: true }) }
