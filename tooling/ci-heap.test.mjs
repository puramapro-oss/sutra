import test from 'node:test'
import assert from 'node:assert/strict'
import { ciHeapOptions } from './ci-heap.mjs'

test('an absent heap budget preserves the existing Node defaults', () => {
  assert.deepEqual(ciHeapOptions(undefined), [])
})
for (const value of ['512', '1792', '2048', '4096']) {
  test(`an explicit ${value} MiB budget creates one bounded option`, () => {
    assert.deepEqual(ciHeapOptions(value), [`--max-old-space-size=${value}`])
  })
}
for (const value of [null, '', '511', '4097', '1e3', '0x800', ' 1792', '1792\n', '1792 --require=/tmp/untrusted', 1792]) {
  test(`invalid heap budget ${JSON.stringify(value)} is refused`, () => {
    assert.throws(() => ciHeapOptions(value), /SUTRA_CI_HEAP_MB/)
  })
}
