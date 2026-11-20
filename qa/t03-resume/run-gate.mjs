// Offline validation with real font bytes from an existing, read-only Next build.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const [gate, sourceCSS] = process.argv.slice(2)
const commands = {
  build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
  browser: ['scripts/test-ui-isolated.mjs'],
  legacy: ['scripts/test-ui-isolated.mjs', '--legacy'],
}
assert.ok(Object.hasOwn(commands, gate) && sourceCSS, 'Usage: run-gate.mjs build|browser|legacy <cached Next font CSS>')
assert.ok(!readdirSync(root).some(name => name.startsWith('.env') && name !== '.env.example'), 'Isolated checkout required')
const cache = join(root, 'test-results/t03-font-cache')
mkdirSync(cache, { recursive: true })
const cssPath = resolve(sourceCSS)
const source = readFileSync(cssPath, 'utf8')
const blocks = source.match(/@font-face\{[^}]+\}/g)?.filter(block => block.includes('font-family:Space Grotesk;'))
assert.equal(blocks?.length, 15, 'Expected five weights and three subsets')
const hashes = {}
const css = blocks.map(block => {
  const subset = block.includes('u+00??') ? 'latin' : block.includes('u+0100-02ba') ? 'latin-ext' : 'vietnamese'
  return `/* ${subset} */\n` + block.replace(/url\(\/_next\/static\/media\/([^/()]+\.woff2)\)/g, (_, name) => {
    const input = join(dirname(cssPath), '../media', name)
    const bytes = readFileSync(input)
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', 'Real WOFF2 font required')
    const output = join(cache, basename(name))
    copyFileSync(input, output)
    hashes[name] = createHash('sha256').update(bytes).digest('hex')
    return `url(${output})`
  }).replace(/;/g, ';\n').replace(/:/g, ': ')
}).join('\n')
const responsePath = join(cache, 'responses.cjs')
writeFileSync(responsePath, `module.exports = ${JSON.stringify({
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap': css,
})}\n`)
const evidence = join(root, 'qa/t03-resume/evidence')
mkdirSync(evidence, { recursive: true })
writeFileSync(join(evidence, 'font-cache.json'), JSON.stringify({ sourceCSS: cssPath, hashes, mode: 'NEXT_FONT_GOOGLE_MOCKED_RESPONSES with real cached WOFF2 bytes; no network' }, null, 2) + '\n')
const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].flatMap(key => process.env[key] ? [[key, process.env[key]]] : []))
Object.assign(env, {
  NODE_OPTIONS: `--require=${join(root, 'qa/t08/offline.cjs')}`,
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: responsePath,
  CI: '1', SUTRA_UI_PRODUCTION: '1', NEXT_TELEMETRY_DISABLED: '1', OTS_NETWORK: '0', LTX_TRACK_DB: '0',
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', STRIPE_SECRET_KEY: 'sk_test_isolated', RESEND_API_KEY: 're_isolated',
})
const start = Date.now()
const result = spawnSync(process.execPath, commands[gate], { cwd: root, env, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 })
writeFileSync(join(evidence, `${gate}.txt`), `${result.stdout || ''}${result.stderr || ''}`)
const pass = result.status === 0 && !result.error && !result.signal
writeFileSync(join(evidence, `${gate}-result.json`), JSON.stringify({ gate, command: [process.execPath, ...commands[gate]], status: pass ? 'PASS' : 'FAIL', exitCode: result.status, signal: result.signal, error: result.error?.code, durationMs: Date.now() - start }, null, 2) + '\n')
process.stdout.write(`${pass ? 'PASS' : 'FAIL'} ${gate}; qa/t03-resume/evidence/${gate}.txt\n`)
if (!pass) process.exitCode = 1
