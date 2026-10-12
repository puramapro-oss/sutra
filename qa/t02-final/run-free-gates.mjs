// T02 evidence harness only. The canonical T01 runner and T07 layout stay untouched.
// Fonts are public, immutable downloads; all application tests keep T08's network deny.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '../..')
const profile = process.argv[2]
assert.ok(['build', 'quality', 'browser', 'legacy'].includes(profile), 'Expected build|quality|browser|legacy')
const manifest = JSON.parse(await readFile(new URL('./fonts/sources.json', import.meta.url), 'utf8'))
const cache = resolve(root, 'test-results/t02-fonts')
await mkdir(cache, { recursive: true })
let css = await readFile(new URL('./fonts/google.css', import.meta.url), 'utf8')
for (const [url, font] of Object.entries(manifest.fonts)) {
  assert.equal(new URL(url).origin, 'https://fonts.gstatic.com')
  assert.match(font.file, /^[a-f0-9]{16}\.ttf$/)
  const path = resolve(cache, font.file)
  let data
  try { data = await readFile(path) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) })
    assert.ok(response.ok, 'Public font download failed')
    data = Buffer.from(await response.arrayBuffer())
  }
  assert.equal(createHash('sha256').update(data).digest('hex'), font.sha256)
  await writeFile(path, data)
  css = css.replaceAll(url, path)
}
const responses = resolve(cache, 'responses.cjs')
await writeFile(responses, `module.exports = ${JSON.stringify({ [manifest.css_url]: css })};\n`)
let runner = await readFile(resolve(root, 'scripts/run-ci.mjs'), 'utf8')
const rootAnchor = "const root = resolve(import.meta.dirname, '..')"
const envAnchor = "Object.assign(env, {"
assert.ok(runner.includes(rootAnchor) && runner.includes(envAnchor), 'Review changed canonical runner')
runner = runner.replace(rootAnchor, `const root = ${JSON.stringify(root)}`)
runner = runner.replace(envAnchor, `${envAnchor}\n  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: ${JSON.stringify(responses)},`)
if (profile === 'build') {
  const anchor = 'const profiles = {'
  assert.ok(runner.includes(anchor))
  runner = runner.replace(anchor, `${anchor}\n  build: [['build', ['node_modules/next/dist/bin/next', 'build', '--webpack']]],`)
}
const generated = resolve(root, 'test-results/t02-run-ci.mjs')
await writeFile(generated, runner)
const result = spawnSync(process.execPath, [generated, profile], { cwd: root, stdio: 'inherit' })
process.exitCode = result.status ?? 1
