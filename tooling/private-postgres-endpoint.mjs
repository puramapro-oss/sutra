import { createServer } from 'node:net'

// Disposable test clusters listen on loopback only. An OS-assigned port avoids
// collisions between parallel recipes; disabling Unix sockets also works in
// runtimes that allow local TCP but prohibit filesystem sockets.
export async function allocatePrivatePostgresEndpoint() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return { host: '127.0.0.1', port, postgresOptions: `-h 127.0.0.1 -k '' -p ${port} -c timezone=UTC` }
}
