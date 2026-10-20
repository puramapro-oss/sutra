import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import pg from 'pg'
import { createDrainingPool } from '../t07-autonomy-integrated-20261020/draining-pool.mjs'

// Use the installed pg-pool, with only the physical connection simulated.
// Closure is released explicitly, so no timer race or real database is needed.
class DeferredClient extends EventEmitter {
  _queryable = true
  closed = false
  connect(callback) { callback(null) }
  end(callback) {
    this.finishClose = () => {
      this.closed = true
      this.emit('end')
      callback?.()
    }
  }
}

test('reproduction: pool.end resolves while an idle socket has not closed', async () => {
  const pool = new pg.Pool({ Client: DeferredClient })
  const client = await pool.connect()
  client.release()
  await pool.end()
  assert.equal(client.closed, false, 'old restart can race an open connection')
  client.finishClose()
})

test('drain waits for every actual connection before permitting restart', async () => {
  const database = createDrainingPool({ Client: DeferredClient })
  const clients = await Promise.all([database.pool.connect(), database.pool.connect()])
  clients.forEach(client => client.release())
  let closed = false
  const closing = database.close().then(() => { closed = true })
  await setImmediate()
  assert.equal(closed, false)
  clients[0].finishClose()
  await setImmediate()
  assert.equal(closed, false, 'second connection still open')
  clients[1].finishClose()
  await closing
  assert.equal(closed, true)
})

test('drain handles no connections and already disconnected connections', async () => {
  await createDrainingPool({ Client: DeferredClient }).close()
  const database = createDrainingPool({ Client: DeferredClient })
  const client = await database.pool.connect()
  client.release(true)
  client.finishClose()
  await database.close()
  assert.equal(client.closed, true)
})

test('unexpected database errors remain observable and are not suppressed', async () => {
  const database = createDrainingPool({ Client: DeferredClient })
  const client = await database.pool.connect()
  client.release()
  assert.equal(database.pool.listenerCount('error'), 0)
  const failure = new Error('synthetic unexpected connection failure')
  assert.throws(() => client.emit('error', failure), error => error === failure)
  client.finishClose()
  await database.close()
})
