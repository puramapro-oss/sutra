// Read-only compiler overlay: never copies or edits the provider owner's files.
// This qualifies type compatibility, not runtime integration or provider access.
import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'

const here = import.meta.dirname
const root = resolve(here, '../..')
const providerRoot = process.argv[2] && resolve(process.argv[2])
if (!providerRoot || providerRoot === root) throw new Error('Supply the distinct T04 worktree path')
const clean = Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]))
const git = args => execFileSync('git', args, { cwd: providerRoot, env: clean, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const providerHead = git(['rev-parse', 'HEAD'])
const paths = ['src/lib/suno.ts', 'src/lib/provider-response.ts']
const snapshots = new Map(paths.map(path => [join(root, path), readFileSync(join(providerRoot, path), 'utf8')]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const dependency = paths.map(path => {
  const content = snapshots.get(join(root, path))
  let committed = false
  try {
    committed = execFileSync('git', ['show', `${providerHead}:${path}`], {
      cwd: providerRoot, env: clean, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }) === content
  } catch { /* Not committed yet. */ }
  return { path, sha256: hash(content), committed_at_provider_head: committed }
})
const configPath = join(here, 'tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
if (config.error) throw new Error('Invalid targeted TypeScript config')
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, here)
const host = ts.createCompilerHost(parsed.options)
const read = host.readFile.bind(host), exists = host.fileExists.bind(host)
host.readFile = file => snapshots.get(resolve(file)) ?? read(file)
host.fileExists = file => snapshots.has(resolve(file)) || exists(file)
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true, incremental: false }, host)
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
const stable = paths.every(path => hash(readFileSync(join(providerRoot, path))) === hash(snapshots.get(join(root, path))))
const output = ts.formatDiagnostics(diagnostics, { getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n' })
writeFileSync(join(here, 'typecheck-with-t04.log'), output)
writeFileSync(join(here, 'typecheck-with-t04.json'), JSON.stringify({
  command: ['node', 'qa/t03-orchestration-fixes-20261014/typecheck-with-t04.mjs', providerRoot],
  result: diagnostics.length || !stable ? 'FAIL' : 'PASS', diagnostics: diagnostics.length,
  provider_root: providerRoot, provider_head: providerHead, dependency, source_stable_during_check: stable,
  boundary: dependency.every(item => item.committed_at_provider_head) ? 'committed provider; read-only type compatibility' : 'provisional WIP provider; read-only type compatibility',
  source_sha256: Object.fromEntries(['src/lib/music-checkpoint.ts', 'src/lib/video-pipeline.ts', 'src/lib/production-pipeline.ts',
    'src/lib/sutra-auto.ts', 'src/lib/video-queue.ts', 'src/lib/video-worker.ts', ...parsed.fileNames.map(file => file.slice(root.length + 1))]
    .map(path => [path, hash(readFileSync(join(root, path)))])),
}, null, 2) + '\n')
process.stdout.write(`Targeted typecheck with T04: ${diagnostics.length} diagnostics; provider stable=${stable}; committed=${dependency.every(item => item.committed_at_provider_head)}\n`)
process.exitCode = diagnostics.length || !stable ? 1 : 0
