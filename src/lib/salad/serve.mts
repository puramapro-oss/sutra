// Explicit remote-container entrypoint. Importing host.ts never starts a listener.
import { Pool } from 'pg'
import { saladWorkerEnvironmentConfig } from './config.ts'
import { startSaladHost } from './host.ts'
import { SaladError } from './contracts.ts'

let pool: Pool | undefined
try {
  const config = saladWorkerEnvironmentConfig()
  if (config.enabled) {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new SaladError('SALAD_LINUX_AMD64_REQUIRED')
    const url = new URL(process.env.SALAD_WORKER_DATABASE_URL ?? '')
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password
      || url.search || url.hash) throw new SaladError('SALAD_INVALID_DATABASE_CONFIG')
    // No query-string sslmode override, unlimited wait, application key or raw DB errors.
    pool = new Pool({ connectionString: url.href, ssl: { rejectUnauthorized: true },
      max: 2, connectionTimeoutMillis: 5000, statement_timeout: 5000, idleTimeoutMillis: 10000 })
    pool.on('error', () => { /* Calls fail closed and the permanent DB claim remains. */ })
    const host = await startSaladHost(config, { database: pool,
      receiptPath: process.env.SALAD_DEPLOYMENT_RECEIPT_PATH ?? '',
      comfyUrl: process.env.SALAD_COMFY_URL ?? '', bridgeUrl: process.env.SALAD_BRIDGE_URL ?? '',
      port: Number(process.env.SALAD_WORKER_PORT) })
    if (host.state === 'listening') {
      let stopping = false
      const stop = async () => {
        if (stopping) return
        stopping = true
        try { await host.close(); await pool?.end() }
        catch { process.stderr.write('SALAD_SHUTDOWN_UNCERTAIN\n'); process.exitCode = 1 }
      }
      process.once('SIGTERM', () => { void stop() })
      process.once('SIGINT', () => { void stop() })
    }
  }
} catch {
  await pool?.end().catch(() => {})
  process.stderr.write('SALAD_HOST_UNAVAILABLE\n')
  process.exitCode = 1
}
