// Network-free regression tests for the final-composition publication guard.
// Requires Node 24. Run: node scripts/test-auto-composition.mjs
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

let source = readFileSync(new URL('../src/lib/sutra-auto-utils.ts', import.meta.url), 'utf8')
source = stripTypeScriptTypes(source)
const { needsFinalComposition } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
)

assert.equal(needsFinalComposition({}), false)
for (const key of ['musicUrl', 'voiceUrl', 'watermarkUrl', 'introUrl', 'outroUrl']) {
  assert.equal(needsFinalComposition({ [key]: 'https://example.invalid/asset' }), true, key)
}
assert.equal(needsFinalComposition({ musicUrl: null, voiceUrl: '' }), false)

console.log('PASS: raw video publication is blocked whenever final composition is required')
