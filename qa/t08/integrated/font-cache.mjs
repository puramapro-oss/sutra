// Reuse verified font bytes from an existing local build, without fetching them.
// This is a QA build input, not a product font fallback or a production build proof.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function prepareFontCache(cache) {
  assert.ok(cache, 'T08_FONT_CACHE must point to an existing .next/static directory (no download)')
  const root = resolve(cache), output = resolve('test-results/t08/font-cache')
  const faces = readdirSync(resolve(root, 'css')).filter(name => name.endsWith('.css'))
    .flatMap(name => readFileSync(resolve(root, 'css', name), 'utf8').match(/@font-face\{[^}]+\}/g) || [])
    .filter(face => face.startsWith('@font-face{font-family:Space Grotesk;'))
  assert.equal(faces.length, 15, 'five weights times three subsets required')
  const hashes = {}
  const css = faces.map(face => {
    const name = face.match(/src:url\(\/_next\/static\/media\/([\w.-]+\.woff2)\)/)?.[1]
    assert.ok(name, 'local WOFF2 reference required')
    const path = resolve(root, 'media', name)
    const bytes = readFileSync(path)
    assert.equal(bytes.toString('ascii', 0, 4), 'wOF2', 'real WOFF2 bytes required')
    hashes[name] = createHash('sha256').update(bytes).digest('hex')
    const subset = face.includes('unicode-range:u+00??') ? 'latin' : face.includes('unicode-range:u+0100-02ba') ? 'latin-ext' : 'vietnamese'
    return `/* ${subset} */\n${face.replace(/src:url\([^)]*\)/, `src: url(${path})`)}\n`
  }).join('')
  mkdirSync(output, { recursive: true })
  writeFileSync(resolve(output, 'provenance.json'), JSON.stringify({ source: root, hashes, faces: faces.length }, null, 2) + '\n')
  const response = { 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap': css }
  const path = resolve(output, 'responses.cjs')
  writeFileSync(path, `module.exports = ${JSON.stringify(response)};\n`)
  return path
}
