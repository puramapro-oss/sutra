import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer as createHttpServer, request } from 'node:http'
import { createRequire } from 'node:module'
import { createServer as createTcpServer } from 'node:net'
import { gzipSync } from 'node:zlib'
import test from 'node:test'

// Resolve through Lighthouse CI, so these tests exercise its actual transitive
// dependencies even when npm installs them below the root node_modules.
const lhciRequire = createRequire(import.meta.resolve('@lhci/cli/package.json'))
const expressRequire = createRequire(lhciRequire.resolve('express'))
const proxyaddr = expressRequire('proxy-addr')
const bodyParser = expressRequire('body-parser')
const proxyAgentRequire = createRequire(lhciRequire.resolve('proxy-agent'))
const pacProxyRequire = createRequire(proxyAgentRequire.resolve('pac-proxy-agent'))
const { getUri } = pacProxyRequire('get-uri')

test('proxy trust rejects public IPv4 addresses for short IPv6 prefixes', () => {
  const request = {
    socket: { remoteAddress: '203.0.113.9' },
    headers: { 'x-forwarded-for': '192.0.2.10' },
  }
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    const trust = proxyaddr.compile(subnet)
    assert.equal(trust('203.0.113.9'), false)
    assert.equal(proxyaddr(request, trust), '203.0.113.9')
  }
  const trust = proxyaddr.compile('::ffff:10.0.0.0/104')
  assert.equal(trust('10.2.3.4'), true)
  assert.equal(trust('203.0.113.9'), false)
  assert.equal(proxyaddr({ ...request, socket: { remoteAddress: '10.2.3.4' } }, trust), '192.0.2.10')
})

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return server.address().port
}

async function post(port, body, encoding) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1', port, method: 'POST', path: '/',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length, ...(encoding ? { 'Content-Encoding': encoding } : {}) },
    }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

test('body-parser preserves gzip JSON and survives invalid compressed trailing bytes', { timeout: 5000 }, async t => {
  const parser = bodyParser.json({ limit: '1kb' })
  const server = createHttpServer((req, res) => parser(req, res, error => {
    res.statusCode = error?.status ?? 200
    res.end(JSON.stringify(error ? { error: error.type } : req.body))
  }))
  t.after(() => { server.closeAllConnections(); server.close() })
  const port = await listen(server)
  const json = Buffer.from(JSON.stringify({ fixture: 'compressed input' }))
  assert.deepEqual(await post(port, gzipSync(json), 'gzip'), { status: 200, body: json.toString() })
  const malformed = Buffer.concat([gzipSync(json), Buffer.from('invalid-trailing-bytes')])
  assert.equal((await post(port, malformed, 'gzip')).status, 400)
  assert.equal((await post(port, Buffer.from(JSON.stringify({ data: 'x'.repeat(2000) })))).status, 413)
  assert.deepEqual(await post(port, json), { status: 200, body: json.toString() })
})

test('get-uri downloads through the patched basic-ftp client over loopback', { timeout: 5000 }, async t => {
  const payload = Buffer.from('local Lighthouse dependency fixture\n')
  const sockets = new Set()
  const dataServers = new Set()
  const commands = []
  const server = createTcpServer(control => {
    sockets.add(control)
    control.on('close', () => sockets.delete(control))
    let buffer = ''
    let dataConnection
    control.write('220 Local fixture ready\r\n')
    control.on('data', async chunk => {
      buffer += chunk.toString()
      while (buffer.includes('\r\n')) {
        const index = buffer.indexOf('\r\n')
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        const command = line.split(' ', 1)[0]
        commands.push(command)
        if (command === 'USER') control.write('331 Password required\r\n')
        else if (command === 'PASS') control.write('230 Logged in\r\n')
        else if (command === 'FEAT') control.write('211 End\r\n')
        else if (command === 'MDTM') control.write('213 20261109000000\r\n')
        else if (command === 'EPSV' || command === 'PASV') {
          const data = createTcpServer(socket => {
            sockets.add(socket)
            socket.on('close', () => sockets.delete(socket))
          })
          dataServers.add(data)
          dataConnection = once(data, 'connection').then(([socket]) => socket)
          const port = await listen(data)
          control.write(command === 'EPSV'
            ? `229 Entering Extended Passive Mode (|||${port}|)\r\n`
            : `227 Entering Passive Mode (127,0,0,1,${port >> 8},${port & 255})\r\n`)
        } else if (command === 'RETR') {
          assert.equal(line, 'RETR /fixture.txt')
          control.write('150 Opening data connection\r\n')
          const data = await dataConnection
          data.end(payload, () => control.write('226 Transfer complete\r\n'))
        } else if (command === 'QUIT') control.end('221 Goodbye\r\n')
        else if (['TYPE', 'STRU', 'OPTS'].includes(command)) control.write('200 Accepted\r\n')
        else control.write('502 Unsupported fixture command\r\n')
      }
    })
  })
  t.after(() => {
    for (const socket of sockets) socket.destroy()
    for (const data of dataServers) data.close()
    server.close()
  })
  const port = await listen(server)
  const stream = await getUri(`ftp://fixture:fixture@127.0.0.1:${port}/fixture.txt`)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  assert.deepEqual(Buffer.concat(chunks), payload)
  assert.equal(stream.lastModified.toISOString(), '2026-11-09T00:00:00.000Z')
  assert.ok(commands.includes('MDTM') && commands.includes('RETR'))
})
