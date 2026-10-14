import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { execFileSync } from 'node:child_process'
import { prepareSaladInspection, type InspectionIO } from '../src/lib/salad/inspection.ts'
import { saladHttpServer, startSaladHost } from '../src/lib/salad/host.ts'
import { sha256 } from '../src/lib/salad/contracts.ts'
import type { createSaladWorker } from '../src/lib/salad/worker.ts'

// CPU/files/loopback only. Hardware calls are fixture data; never run nvidia/torch.
const digest = sha256('synthetic model')
async function inspectionFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'sutra-salad-inspection-'))
  const model = join(directory, 'models/checkpoints/ltxv-13b-0.9.8-distilled-fp8.safetensors')
  const encoder = join(directory, 'models/text_encoders/t5xxl_ltxv_official.safetensors')
  await mkdir(join(directory, 'models/checkpoints'), { recursive: true })
  await mkdir(join(directory, 'models/text_encoders'), { recursive: true })
  await writeFile(model, 'synthetic model', { mode: 0o444 })
  await writeFile(encoder, 'synthetic encoder', { mode: 0o444 })
  const receipt = join(directory, 'receipt.json')
  const image = `registry.invalid/fixture@sha256:${digest}`
  await writeFile(receipt, JSON.stringify({ image, comfyRoot: directory }), { mode: 0o444 })
  let busy = false, probes = 0
  const io: InspectionIO = { platform: 'linux', architecture: 'x64',
    async fetcher(url, init) {
      assert.equal(String(url), 'http://127.0.0.1:7860/queue')
      assert.equal(init?.redirect, 'error')
      return Response.json({ queue_running: busy ? [['fixture']] : [], queue_pending: [] })
    },
    async probe() { probes++; return { gpu: 'NVIDIA GeForce RTX 3090', vramMiB: 24576, freeVramMiB: 20000, cuda: '12.8' } },
  }
  return { directory, model, receipt, image, io, setBusy() { busy = true }, probes: () => probes }
}

test('inspection binds real read-only bytes, embedded VAE and hardware; busy queue cannot be idle', async () => {
  const fixture = await inspectionFixture()
  const inspect = await prepareSaladInspection(fixture.receipt, 'http://127.0.0.1:7860', fixture.io)
  const result = await inspect()
  assert.equal(result.image, fixture.image)
  assert.equal(result.modelSha256, digest)
  assert.equal(result.vaeSha256, digest, 'native bridge uses embedded VAE, not unused standalone file')
  assert.equal(result.encoderSha256, sha256('synthetic encoder'))
  assert.equal(result.gpu, 'NVIDIA GeForce RTX 3090')
  assert.equal(result.state, 'idle')
  fixture.setBusy()
  assert.equal((await inspect()).state, 'busy')
  assert.equal(fixture.probes(), 2)
})

test('inspection refuses Mac, writable weights, invalid local URL and raw hardware errors', async () => {
  const fixture = await inspectionFixture()
  await assert.rejects(prepareSaladInspection(fixture.receipt, 'http://127.0.0.1:7860', { ...fixture.io, platform: 'darwin' }), /SALAD_LINUX_AMD64_REQUIRED/)
  assert.equal(fixture.probes(), 0)
  await assert.rejects(prepareSaladInspection(fixture.receipt, 'https://private.invalid', fixture.io), /SALAD_INSPECTION_UNAVAILABLE/)
  const inspect = await prepareSaladInspection(fixture.receipt, 'http://127.0.0.1:7860', {
    ...fixture.io, async probe() { throw new Error('PRIVATE_PROBE_DIAGNOSTIC') },
  })
  await assert.rejects(inspect(), /^Error: SALAD_INSPECTION_UNAVAILABLE$/)
  await chmod(fixture.model, 0o644)
  await assert.rejects(prepareSaladInspection(fixture.receipt, 'http://127.0.0.1:7860', fixture.io), /SALAD_INSPECTION_UNAVAILABLE/)
})

test('disabled host performs no DB, binding, receipt, hardware or listen operation', async () => {
  const result = await startSaladHost(undefined, { database: { async query() { assert.fail('DB') } },
    receiptPath: '/nonexistent', comfyUrl: '', bridgeUrl: '', port: 0 }, () => { assert.fail('binding') })
  assert.deepEqual(result, { state: 'disabled' })
  const child = execFileSync(process.execPath, ['--require', './qa/t08/offline.cjs', '--import', 'tsx', 'src/lib/salad/serve.mts'], {
    cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: 'test', SALAD_ENABLED: 'false' }, timeout: 10000,
  })
  assert.equal(child.byteLength, 0)
})

test('HTTP listener authenticates before body/worker, bounds payload and routes exact request', async () => {
  const token = 'synthetic-worker-token-'.repeat(3)
  const requests: Request[] = []
  const worker: ReturnType<typeof createSaladWorker> = { async drain() {}, async handle(req) {
    requests.push(req)
    if (req.method === 'POST') assert.deepEqual(await req.json(), { prompt: 'fixture' })
    return Response.json({ state: 'fixture' }, { status: req.method === 'POST' ? 202 : 200 })
  } }
  const server = saladHttpServer(worker, token, 1000)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}`
  try {
    const denied = await fetch(`${url}/v1/jobs`, { method: 'POST', body: 'fixture' })
    assert.equal(denied.status, 401)
    assert.equal(requests.length, 0)
    await denied.arrayBuffer()
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const large = await fetch(`${url}/v1/jobs`, { method: 'POST', headers, body: 'x'.repeat(65537) })
    assert.equal(large.status, 413)
    assert.equal(requests.length, 0)
    await large.arrayBuffer()
    const response = await fetch(`${url}/v1/jobs`, { method: 'POST', headers, body: JSON.stringify({ prompt: 'fixture' }) })
    assert.equal(response.status, 202)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { state: 'fixture' })
    assert.equal(requests[0].url, 'http://worker.invalid/v1/jobs')
    const invalid = await fetch(`${url}//foreign.invalid/v1/jobs`, { headers })
    assert.equal(invalid.status, 503)
    await invalid.arrayBuffer()
    assert.equal(requests.length, 1)
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections() }) }
})

test('HTTP listener redacts internal failure without returning raw diagnostic', async () => {
  const token = 'synthetic-worker-token-'.repeat(3)
  const server = saladHttpServer({ async drain() {}, async handle() { throw new Error('PRIVATE_HOST_DIAGNOSTIC') } }, token, 1000)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'SALAD_SAFE_FAILURE' })
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections() }) }
})
