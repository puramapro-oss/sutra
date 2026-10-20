import pg from 'pg'

/** QA only: pg-pool can resolve end() before its clients emit end.
 * Wait for the actual sockets before a synchronous private-cluster restart.
 * Do not intercept errors: an unexpected connection failure still fails QA.
 */
export function createDrainingPool(options) {
  const pool = new pg.Pool(options)
  const connections = new Set()
  pool.on('connect', client => {
    const closed = new Promise(resolve => client.once('end', resolve))
    connections.add(closed)
    void closed.then(() => connections.delete(closed))
  })
  return {
    pool,
    close: async () => {
      await pool.end()
      await Promise.all(connections)
    },
  }
}
