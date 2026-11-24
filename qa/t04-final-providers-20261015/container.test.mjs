import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { containerPlan, supervise, waitForComfy } from '../../src/lib/salad/container/launch.mjs';
import { health } from '../../src/lib/salad/container/health.mjs';
const values = { SALAD_ENABLED: 'true', SALAD_WORKER_DATABASE_URL: 'postgresql://fixture:fixture@database.invalid/worker',
  SALAD_WORKER_TOKEN: 'fixture-only-worker-token-00000000', SALAD_API_KEY: 'never-pass-account-key', SUPABASE_SERVICE_ROLE_KEY: 'never-pass-service-role', PATH: '/usr/local/bin:/usr/bin' };
const config = { enabled: true, generationTimeoutMs: 1000 };
const plan = () => containerPlan(values, 'linux', 'x64', config);
function fakeProcesses({ drainHost = false } = {}) {
  const spawned = []; const killed = []; const signals = new EventEmitter();
  const spawnImpl = (command, args, options) => {
    const child = new EventEmitter(); const name = spawned.length === 0 ? 'comfy' : spawned.length === 1 ? 'bridge' : 'host';
    child.kill = signal => { killed.push([name, signal]); if (!(drainHost && name === 'host' && signal === 'SIGTERM')) queueMicrotask(() => child.emit('exit', 0)); return true; };
    spawned.push({ name, command, args, options, child }); return child;
  };
  return { spawned, killed, signals, spawnImpl };
}
test('disabled default and Mac guard start no engine', async () => {
  assert.deepEqual(containerPlan({}, 'darwin', 'arm64'), { enabled: false });
  assert.throws(() => containerPlan(values, 'darwin', 'arm64', config));
  assert.equal(await (await supervise({ enabled: false }, { spawnImpl() { assert.fail(); } })).done, 0);
});
test('single canonical engine/bridge/host; private loopback; account keys absent in all child environments', () => {
  const p = plan(); assert.deepEqual(p.processes.map(v => v.name), ['comfy', 'bridge', 'host']);
  assert.ok(p.processes[0].args.includes('127.0.0.1'));
  assert.ok(p.processes[1].args.includes('/app/scripts/comfyui-engine-server.mjs'));
  assert.ok(p.processes[2].args.includes('/app/src/lib/salad/serve.mts'));
  for (const child of p.processes) {
    assert.equal(child.environment.SALAD_API_KEY, undefined); assert.equal(child.environment.SUPABASE_SERVICE_ROLE_KEY, undefined);
    if (child.name !== 'host') assert.equal(child.environment.SALAD_WORKER_DATABASE_URL, undefined);
  }
});
test('malformed database and conflicting addresses rejected before spawn', () => {
  for (const patch of [{ SALAD_WORKER_DATABASE_URL: 'https://example.invalid' }, { SALAD_WORKER_DATABASE_URL: values.SALAD_WORKER_DATABASE_URL + '?sslmode=disable' }, { SALAD_COMFY_URL: 'http://0.0.0.0:7860' }, { SALAD_WORKER_PORT: '80' }]) {
    assert.throws(() => containerPlan({ ...values, ...patch }, 'linux', 'x64', config));
  }
});
test('SIGTERM drains host before stopping bridge and Comfy; no restart', async () => {
  const io = fakeProcesses({ drainHost: true }); const lifecycle = await supervise(plan(), { ...io, ready: async () => {} });
  io.signals.emit('SIGTERM'); await delay(2);
  assert.deepEqual(io.killed, [['host', 'SIGTERM']]);
  io.spawned[2].child.emit('exit', 0); assert.equal(await lifecycle.done, 0);
  assert.deepEqual(io.killed, [['host', 'SIGTERM'], ['bridge', 'SIGTERM'], ['comfy', 'SIGTERM']]); assert.equal(io.spawned.length, 3);
});
test('bounded host grace kills uncertain process without restarting any computation', async () => {
  const io = fakeProcesses({ drainHost: true }); const lifecycle = await supervise({ ...plan(), drainMs: 5 }, { ...io, ready: async () => {} });
  await lifecycle.stop(); assert.ok(io.killed.some(([name, signal]) => name === 'host' && signal === 'SIGKILL')); assert.equal(io.spawned.length, 3);
});
test('cold-start failure cleans up the single started process', async () => {
  const io = fakeProcesses(); const lifecycle = await supervise(plan(), { ...io, ready: async () => { throw new Error('private error'); } });
  assert.equal(await lifecycle.done, 1); assert.equal(io.spawned.length, 1); assert.deepEqual(io.killed, [['comfy', 'SIGTERM']]);
});
test('child failure drains remaining processes once, no implicit restart', async () => {
  const io = fakeProcesses(); const lifecycle = await supervise(plan(), { ...io, ready: async () => {} });
  io.spawned[1].child.emit('error', new Error('private child failure'));
  assert.equal(await lifecycle.done, 1); assert.equal(io.spawned.length, 3);
  assert.equal(io.signals.listenerCount('SIGTERM'), 0);
});
test('stop during startup cannot start bridge or host later', async () => {
  const io = fakeProcesses(); const lifecycle = await supervise(plan(), { ...io, ready: async () => { io.signals.emit('SIGTERM'); await delay(1); } });
  await lifecycle.done; assert.equal(io.spawned.length, 1);
});
test('Comfy readiness GET accepts queue contract and rejects malformed success', async () => {
  await waitForComfy({ fetchImpl: async (url, options) => { assert.equal(options.method, 'GET'); assert.ok(url.endsWith('/queue')); return Response.json({ queue_running: [], queue_pending: [] }); } });
  await assert.rejects(waitForComfy({ timeoutMs: 10, intervalMs: 1, fetchImpl: async () => Response.json({ other: true }) }));
});
test('Comfy readiness refusal/timeout/cancel do not submit a job', async () => {
  await assert.rejects(waitForComfy({ timeoutMs: 10, intervalMs: 1, fetchImpl: async () => new Response('', { status: 503 }) }));
  await assert.rejects(waitForComfy({ signal: AbortSignal.abort(), fetchImpl: async () => assert.fail() }));
});
test('health authenticates using header only and accepts ready/busy contracts', async () => {
  for (const state of ['ready', 'busy']) assert.equal(await health(values, async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:7862/health'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${values.SALAD_WORKER_TOKEN}`);
    return Response.json({ protocol: 'sutra-salad-worker/1', state });
  }), true);
});
test('health rejects malformed 200, interruption, wrong protocol, errors and disabled configuration', async () => {
  for (const body of [{}, { protocol: 'other', state: 'ready' }, { protocol: 'sutra-salad-worker/1', state: 'interrupted' }]) {
    assert.equal(await health(values, async () => Response.json(body)), false);
  }
  assert.equal(await health(values, async () => new Response('private error', { status: 401 })), false);
  assert.equal(await health({}, async () => assert.fail()), false);
});
test('health and readiness bound stalled bodies and cancel their streams', async () => {
  // Keep the event loop live while AbortSignal.timeout's unref timer expires.
  const keepAlive = setInterval(() => {}, 1000); let cancelled = 0;
  const stalled = async () => new Response(new ReadableStream({ cancel() { cancelled++; } }), { headers: { 'content-type': 'application/json' } });
  try {
    assert.equal(await health(values, stalled, 10), false);
    await assert.rejects(waitForComfy({ fetchImpl: stalled, timeoutMs: 10, intervalMs: 1 }));
    assert.equal(cancelled, 2);
  } finally { clearInterval(keepAlive); }
});
test('health rejects oversized responses without logging or accepting successful HTTP status', async () => {
  assert.equal(await health(values, async () => new Response('x'.repeat(70000), { headers: { 'content-type': 'application/json' } })), false);
});
test('image source allowlist contains transitive media verification, never copies repository/env', async () => {
  const docker = await readFile('src/lib/salad/container/Dockerfile', 'utf8');
  assert.match(docker, /COPY src\/lib\/salad-persistence.ts src\/lib\/media-probe.ts/);
  assert.doesNotMatch(docker, /COPY\s+\.\s|COPY\s+\.env|ADD\s+\./);
  assert.equal((docker.match(/FROM --platform=linux\/amd64 .*@sha256:[a-f0-9]{64}/g) ?? []).length, 2);
  assert.match(docker, /--require-hashes/); assert.match(docker, /SALAD_ENABLED=false/); assert.match(docker, /USER 10001:10001/);
});
