import { after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Reuse the complete existing real OTS serialization/Merkle/transport suite.
// Tripwires count calls even when upstream catches an exception. They persist
// across that suite's mock.restoreAll(), only inside this isolated test process.
const require = createRequire(import.meta.url)
const targets = [
  [require('request').Request.prototype, 'init', 'legacy request transport'],
  [require('elliptic').ec.prototype, 'sign', 'elliptic ECDSA signing'],
  [require('javascript-opentimestamps/src/bitcoin.js').BitcoinNode.prototype, 'callRPC', 'local Bitcoin RPC'],
] as const
const calls = new Map<string, number>()
for (const [target, method, label] of targets) {
  const original = target[method]
  calls.set(label, 0)
  target[method] = () => {
    calls.set(label, calls.get(label)! + 1)
    throw new Error('T02_VULNERABLE_DEPENDENCY_PATH_REACHED')
  }
  after(() => { target[method] = original })
}
after(() => {
  for (const [label, count] of calls) assert.equal(count, 0, `${label} must remain unreachable in exercised OTS flows`)
})
await import('./test-t02-security-fixes-ots.mts')
