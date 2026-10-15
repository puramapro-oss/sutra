// Native Safari fallback: loopback-only development app and disposable identity.
// No WebDriver setting changes, no real credentials, no provider operations.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdir, open, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'

const output = resolve('qa/t07-final-ux-perf-20261015/native-safari')
await mkdir(output, { recursive: true })
const fixture = await startFixture()
const probe = createServer()
probe.listen(0, '127.0.0.1')
await once(probe, 'listening')
const port = probe.address().port
await new Promise(done => probe.close(done))
const base = `http://127.0.0.1:${port}`
const log = await open(resolve(output, 'server.log'), 'w')
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: process.cwd(), detached: true, stdio: ['ignore', log.fd, log.fd],
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_OPTIONS: `--require=${resolve('qa/t08/offline.cjs')}`, NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: fixture.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
    NEXT_PUBLIC_APP_SCHEMA: 'sutra', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service',
    STRIPE_SECRET_KEY: 'sk_test_fixture', RESEND_API_KEY: 're_fixture', NEXT_PUBLIC_APP_URL: base },
})
await writeFile(resolve(output, 'owned-server.json'), JSON.stringify({ pid: child.pid, base, cwd: process.cwd(), fixture: fixture.url }) + '\n')
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/login`, { signal: AbortSignal.timeout(2000) })).ok) break } catch { /* local boot */ }
    if (child.exitCode !== null) throw new Error('Local server stopped')
    await new Promise(done => setTimeout(done, 500))
  }
  process.stdout.write(JSON.stringify({ base, identity: fixture.user.email, fixture: true }) + '\n')
  await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done) })
} finally {
  if (child.exitCode === null) { process.kill(-child.pid, 'SIGTERM'); await once(child, 'exit') }
  fixture.server.closeAllConnections()
  await new Promise(done => fixture.server.close(done))
  await writeFile(resolve(output, 'fixture-receipt.json'), JSON.stringify({ requests: fixture.state.requests, acceptances: fixture.state.acceptances.map(({ doc_type, version }) => ({ doc_type, version })), writes: fixture.state.writes.length }, null, 2) + '\n')
  await log.close()
}
