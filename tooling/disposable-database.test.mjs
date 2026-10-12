import test from 'node:test'
import assert from 'node:assert/strict'
import { assertDisposableDatabase } from './disposable-database.mjs'

test('accepts explicitly disposable loopback databases', () => {
  for (const host of ['127.0.0.1', '[::1]']) {
    assert.doesNotThrow(() => assertDisposableDatabase(`postgresql://fixture:fixture@${host}:5432/sutra_ci_t01`, '1'))
  }
})

for (const [name, value, confirmation] of [
  ['missing confirmation', 'postgres://127.0.0.1:5432/sutra_ci_t01', undefined],
  ['remote host', 'postgres://db.example.invalid:5432/sutra_ci_t01', '1'],
  ['hostname alias', 'postgres://localhost:5432/sutra_ci_t01', '1'],
  ['shared database', 'postgres://127.0.0.1:5432/postgres', '1'],
  ['missing port', 'postgres://127.0.0.1/sutra_ci_t01', '1'],
  ['host query override', 'postgres://127.0.0.1:5432/sutra_ci_t01?host=db.example.invalid', '1'],
  ['socket query override', 'postgres://127.0.0.1:5432/sutra_ci_t01?host=/tmp', '1'],
  ['encoded database name', 'postgres://127.0.0.1:5432/sutra_ci_%74est', '1'],
  ['wrong protocol', 'https://127.0.0.1:5432/sutra_ci_t01', '1'],
  ['invalid URL', 'fixture-password-must-not-appear', '1'],
]) {
  test(`rejects ${name} without leaking connection data`, () => {
    assert.throws(() => assertDisposableDatabase(value, confirmation), error => {
      assert.match(error.message, /Refusing migration test/)
      assert.equal(error.message.includes(value), false)
      return true
    })
  })
}
