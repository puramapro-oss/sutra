import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { readProductionIntent, saveProductionIntent, productionIntentKey, requestClientJson, waitForProductionStatus, type ProductionIntent } from '../../src/lib/production-intent-client.ts'

const userId = '11111111-1111-4111-8111-111111111111'
const requestId = '33333333-3333-4333-8333-333333333333'
const intent: ProductionIntent = { version: 1, userId, requestId, step: 'script', body: JSON.stringify({ step: 'script', idea: 'Fixture', requestId }), cancelRequested: false }
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
} })

test('receipt roundtrip preserves immutable request bytes and separates users', () => {
  saveProductionIntent(userId, intent)
  assert.deepEqual(readProductionIntent(userId), intent)
  assert.equal(readProductionIntent('another-user'), null)
  saveProductionIntent(userId, null)
  assert.equal(readProductionIntent(userId), null)
})

test('invalid, foreign or contradictory recovery receipts fail closed without deletion', () => {
  for (const invalid of [
    '{', JSON.stringify({ ...intent, userId: 'someone-else' }),
    JSON.stringify({ ...intent, step: 'video' }),
    JSON.stringify({ ...intent, requestId: 'not-a-uuid' }),
    JSON.stringify({ ...intent, jobId: '../../another-route' }),
    JSON.stringify({ ...intent, cancelRequested: 'true' }),
  ]) {
    store.set(productionIntentKey(userId), invalid)
    assert.throws(() => readProductionIntent(userId))
    assert.equal(store.get(productionIntentKey(userId)), invalid)
  }
})

test('deadline covers a streamed body that never completes, using a loopback server', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.write('{"config":')
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  try {
    const address = server.address() as { port: number }
    const began = performance.now()
    await assert.rejects(requestClientJson(`http://127.0.0.1:${address.port}`, {}, 100))
    assert.ok(performance.now() - began < 2000)
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
})

test('caller abort stops a pending poll delay immediately', async () => {
  const controller = new AbortController()
  const pending = waitForProductionStatus(controller.signal)
  controller.abort()
  await assert.rejects(pending)
  await assert.rejects(waitForProductionStatus(controller.signal))
})
