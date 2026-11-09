import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createDurableRequestStore } from '../src/lib/durable-request-store.ts'
import { DurableHooksProbe } from './durable-hooks-fixture.tsx'

const initial = { ready: false, busy: false, cancelling: false, intent: null as { userId: string; requestId: string } | null }

test('server snapshots stay locked and referentially stable without reading storage', () => {
  let reads = 0
  const store = createDurableRequestStore(initial, () => { reads++; return { ...initial, ready: true } })
  assert.equal(store.getServerSnapshot(), initial)
  assert.equal(store.getSnapshot(), initial)
  assert.equal(store.getServerSnapshot().ready, false)
  assert.equal(reads, 0)
})

test('StrictMode subscribe-cleanup-subscribe restores once and preserves the exact receipt', () => {
  const receipt = { userId: 'owner', requestId: 'original-operation' }
  let reads = 0, notifications = 0
  const store = createDurableRequestStore(initial, () => { reads++; return { ...initial, ready: true, intent: receipt } })
  const first = store.subscribe(() => { notifications++ })
  assert.equal(notifications, 1)
  assert.equal(store.getSnapshot().intent, receipt)
  first()
  const second = store.subscribe(() => { notifications++ })
  assert.equal(reads, 1)
  assert.equal(store.getSnapshot().intent, receipt)
  assert.equal(store.getServerSnapshot(), initial)
  second()
})

test('only the final observer detaches the in-flight request; uncertainty retains its receipt', () => {
  const receipt = { userId: 'owner', requestId: 'original-operation' }
  const store = createDurableRequestStore(initial, () => ({ ...initial, ready: true, intent: receipt }))
  const first = store.subscribe(() => {}), second = store.subscribe(() => {})
  const controller = new AbortController()
  store.setActive({ controller }); store.set('busy', true); store.set('cancelling', true)
  first()
  assert.equal(controller.signal.aborted, false)
  second()
  assert.equal(controller.signal.aborted, true)
  assert.equal(store.getActive(), null)
  assert.equal(store.getSnapshot().busy, false)
  assert.equal(store.getSnapshot().cancelling, false)
  assert.equal(store.getSnapshot().intent, receipt)
})

test('late updates to a detached owner cannot change the next owner snapshot', () => {
  const first = createDurableRequestStore(initial, () => ({ ...initial, ready: true, intent: { userId: 'first', requestId: 'first-operation' } }))
  const second = createDurableRequestStore(initial, () => ({ ...initial, ready: true, intent: { userId: 'second', requestId: 'second-operation' } }))
  const stopFirst = first.subscribe(() => {}), stopSecond = second.subscribe(() => {})
  stopFirst()
  first.set('intent', null)
  assert.equal(second.getSnapshot().intent?.userId, 'second')
  assert.equal(second.getSnapshot().intent?.requestId, 'second-operation')
  stopSecond()
})

for (const kind of ['create', 'production'] as const) {
  test(`${kind} actual hook renders a locked SSR snapshot without sessionStorage`, () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    let reads = 0
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { reads++; throw new Error('Browser storage unavailable during SSR') } })
    try {
      const html = renderToString(createElement(DurableHooksProbe, { ownerId: 'fixture-owner', revision: 0, kind }))
      assert.match(html, /&quot;requestLocked&quot;:true/)
      assert.match(html, /&quot;intent&quot;:null/)
      assert.equal(reads, 0)
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
      else Reflect.deleteProperty(globalThis, 'sessionStorage')
    }
  })
}
