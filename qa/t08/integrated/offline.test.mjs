import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

// Execute the actual preload with inert I/O adapters. No secret file is opened,
// no DNS lookup, socket or real fetch is made, including for failure cases.
const source = readFileSync(new URL('../offline.cjs', import.meta.url), 'utf8')
function sandbox() {
  const calls = []
  const record = kind => (...args) => { calls.push({ kind, args }); return 'fixture' }
  const fs = { promises: {} }
  for (const key of ['readFileSync', 'readFile', 'openSync', 'open']) fs[key] = record(key)
  for (const key of ['readFile', 'open']) fs.promises[key] = async (...args) => record(key)(...args)
  function Socket() {}
  Socket.prototype.connect = record('connect')
  const ctx = { URL, Buffer, fetch: record('fetch'), require: name => ({
    'node:fs': fs, 'node:net': { Socket }, 'node:module': { syncBuiltinESMExports() {} },
    'node:url': { fileURLToPath },
  })[name] }
  runInNewContext(source, ctx)
  return { fs, calls, fetch: ctx.fetch, socket: new Socket() }
}

for (const path of ['/virtual/.env', '/virtual/.env.local', Buffer.from('/virtual/.env.test'),
  new URL('file:///virtual/.env'), new URL('file:///virtual/%2Eenv'), new URL('file:///virtual/%2Eenv%2Elocal')]) {
  test(`secret guard rejects ${String(path)} before all instrumented I/O`, async () => {
    const s = sandbox()
    for (const key of ['readFileSync', 'readFile', 'openSync', 'open']) assert.throws(() => s.fs[key](path), /T08_ENV_FILE_DENIED/)
    for (const key of ['readFile', 'open']) await assert.rejects(() => s.fs.promises[key](path), /T08_ENV_FILE_DENIED/)
    assert.equal(s.calls.length, 0)
  })
}
test('ordinary source files remain readable', () => {
  const s = sandbox()
  assert.equal(s.fs.readFileSync('/virtual/src/environment.ts'), 'fixture')
  assert.equal(s.calls.length, 1)
})
for (const host of ['api.example.invalid', '169.254.169.254', '10.0.0.1', '127.0.0.1.example.invalid']) {
  test(`network guard rejects ${host} before fetch and socket I/O`, async () => {
    const s = sandbox()
    await assert.rejects(() => s.fetch(`https://${host}/`), /T08_NETWORK_DENIED/)
    assert.throws(() => s.socket.connect({ host, port: 443 }), /T08_NETWORK_DENIED/)
    assert.throws(() => s.socket.connect([{ host, port: 443 }]), /T08_NETWORK_DENIED/)
    assert.equal(s.calls.length, 0)
  })
}
test('loopback fixture access remains allowed', () => {
  const s = sandbox()
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(s.fetch(`http://${host}/`), 'fixture')
  s.socket.connect({ host: '127.0.0.1', port: 1234 })
  assert.equal(s.calls.length, 4)
})
