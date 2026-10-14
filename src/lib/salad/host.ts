import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { timingSafeEqual } from 'node:crypto'
import { saladWorkerConfig } from './config'
import { SaladError, sha256 } from './contracts'
import { createSaladWorker, type WorkerPorts } from './worker'
import { createComfyBridge } from './engine'
import { prepareSaladInspection } from './inspection'

export interface WorkerDatabase {
  query(sql: string, params: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}
export type PersistenceFactory = (database: WorkerDatabase) => Pick<WorkerPorts, 'journal' | 'artifacts'>

/** Imports T01's exact port after integration. No copy, migration or memory fallback. */
async function canonicalPersistence(database: WorkerDatabase) {
  try {
    const moduleUrl = new URL('../salad-persistence.ts', import.meta.url).href
    const binding = await import(moduleUrl) as { createSaladPersistence: PersistenceFactory }
    if (typeof binding.createSaladPersistence !== 'function') throw new Error()
    return binding.createSaladPersistence(database)
  } catch { throw new SaladError('SALAD_PERSISTENCE_BINDING_REQUIRED') }
}

/** Returns an unbound HTTP server. Only the explicit Linux entry point listens.
 * Authenticate before consuming a body, never trust Host/forwarded headers, bound
 * headers/body deadlines. Close does not release an ambiguous durable GPU claim.
 */
export function saladHttpServer(worker: ReturnType<typeof createSaladWorker>, workerToken: string, timeoutMs: number) {
  const authorized = sha256(`Bearer ${workerToken}`)
  async function respond(req: IncomingMessage, res: ServerResponse) {
    try {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      if (!timingSafeEqual(Buffer.from(sha256(req.headers.authorization ?? '')), Buffer.from(authorized))) {
        res.writeHead(401, { Connection: 'close' }); res.end('{"error":"SALAD_UNAUTHORIZED"}'); return
      }
      if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.includes('\\')) throw new Error()
      const length = req.headers['content-length']
      if (length && (!/^\d+$/.test(length) || Number(length) > 65536)) {
        res.writeHead(413, { Connection: 'close' }); res.end('{"error":"SALAD_BODY_LIMIT"}'); return
      }
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      const body = req.method === 'POST' ? Readable.toWeb(req) as ReadableStream<Uint8Array> : undefined
      const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers, ...(body ? { body, duplex: 'half' } : {}) }
      const response = await worker.handle(new Request(`http://worker.invalid${req.url}`, init))
      res.writeHead(response.status, Object.fromEntries(response.headers))
      if (response.body) Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).on('error', () => res.destroy()).pipe(res)
      else res.end()
    } catch {
      if (!res.headersSent) res.writeHead(503, { Connection: 'close' })
      res.end('{"error":"SALAD_SAFE_FAILURE"}')
    }
  }
  const server = createServer({ maxHeaderSize: 16384 }, (req, res) => { void respond(req, res) })
  server.headersTimeout = Math.min(timeoutMs, 10000)
  server.requestTimeout = timeoutMs
  server.setTimeout(timeoutMs, socket => socket.destroy())
  server.maxHeadersCount = 32
  return server
}

/** Explicit bootstrap only. Callers supply a dedicated, TLS-verifying database
 * connection; T01's five-function login, never application/Supabase credentials.
 */
export async function startSaladHost(rawConfig: unknown, options: {
  database: WorkerDatabase; receiptPath: string; comfyUrl: string; bridgeUrl: string; port: number
}, persistence: PersistenceFactory | undefined = undefined) {
  const config = saladWorkerConfig(rawConfig)
  if (!config.enabled) return { state: 'disabled' as const }
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new SaladError('SALAD_LINUX_AMD64_REQUIRED')
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) throw new SaladError('SALAD_INVALID_LISTEN_PORT')
  const ports = await (persistence ?? canonicalPersistence)(options.database)
  const inspect = await prepareSaladInspection(options.receiptPath, options.comfyUrl)
  const worker = createSaladWorker(config, { ...ports, inspect, bridge: createComfyBridge(options.bridgeUrl) })
  const server = saladHttpServer(worker, config.workerToken, config.requestTimeoutMs)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, '::', () => { server.removeListener('error', reject); resolve() })
  })
  return { state: 'listening' as const, async close() {
    const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await worker.drain()
    await closed
  } }
}
