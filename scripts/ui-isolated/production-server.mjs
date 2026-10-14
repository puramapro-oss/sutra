// Production browser tests only: one build, an owned HTTP process and loopback TLS.
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { once } from 'node:events'
import { spawn } from 'node:child_process'

export async function startProductionServer({ env, log, port, tls }) {
  const build = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
    cwd: process.cwd(), env, stdio: ['ignore', log.fd, log.fd],
  })
  const [code] = await once(build, 'exit')
  assert.equal(code, 0, 'isolated production build')
  const probe = createServer()
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening')
  const internalPort = probe.address().port
  await new Promise(done => probe.close(done))
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(internalPort)], {
    cwd: process.cwd(), env, detached: true, stdio: ['ignore', log.fd, log.fd],
  })
  // Fixed upstream only. This proxy cannot be used to reach any external service.
  const proxy = createSecureServer(tls.options, (incoming, outgoing) => {
    const upstream = request({ hostname: '127.0.0.1', port: internalPort, path: incoming.url, method: incoming.method,
      headers: { ...incoming.headers, 'x-forwarded-proto': 'https', 'x-forwarded-host': incoming.headers.host } }, response => {
      outgoing.writeHead(response.statusCode, response.headers)
      response.pipe(outgoing)
    })
    upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end() })
    incoming.on('aborted', () => upstream.destroy())
    outgoing.on('close', () => { if (!outgoing.writableFinished) upstream.destroy() })
    incoming.pipe(upstream)
  })
  try {
    proxy.listen(port, '127.0.0.1'); await once(proxy, 'listening')
  } catch (error) {
    if (child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
    throw error
  }
  return { child, proxy }
}
