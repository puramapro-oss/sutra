// Container process lifecycle only. The canonical worker owns admission, compute and recovery.
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { boundedJson } from '../http.ts';

const ROOT = '/opt/ComfyUI';
const runtimeNames = ['PATH', 'HOME', 'LD_LIBRARY_PATH', 'NVIDIA_VISIBLE_DEVICES', 'NVIDIA_DRIVER_CAPABILITIES',
  'PYTHONDONTWRITEBYTECODE', 'PYTHONUNBUFFERED', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HOME', 'TORCH_HOME'];
const workerNames = ['SALAD_ENABLED', 'SALAD_WORKER_TOKEN', 'SALAD_QUALIFICATION_JSON', 'SALAD_QUOTE_JSON',
  'SALAD_REQUEST_TIMEOUT_MS', 'SALAD_GENERATION_TIMEOUT_MS', 'SALAD_WORKER_DATABASE_URL'];

export function containerPlan(values, platform, architecture, config) {
  if (values.SALAD_ENABLED !== 'true') return { enabled: false };
  if (platform !== 'linux' || architecture !== 'x64') throw new Error('SALAD_LINUX_AMD64_REQUIRED');
  if (!config?.enabled) throw new Error('SALAD_INVALID_WORKER_CONFIG');
  const database = new URL(values.SALAD_WORKER_DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.username || !database.password
      || database.search || database.hash) throw new Error('SALAD_INVALID_DATABASE_CONFIG');
  const fixed = { SALAD_DEPLOYMENT_RECEIPT_PATH: '/run/sutra/receipt.json', SALAD_COMFY_URL: 'http://127.0.0.1:7860',
    SALAD_BRIDGE_URL: 'http://127.0.0.1:7861', SALAD_WORKER_PORT: '7862' };
  for (const [key, value] of Object.entries(fixed)) if (values[key] !== undefined && values[key] !== value) throw new Error('SALAD_CONTAINER_PORT_OR_PATH_CONFLICT');
  const base = Object.fromEntries(runtimeNames.filter(k => values[k] !== undefined).map(k => [k, values[k]]));
  const worker = { ...base, ...Object.fromEntries(workerNames.map(k => [k, values[k]])), ...fixed };
  return { enabled: true, drainMs: config.generationTimeoutMs + 5000, processes: [
    { name: 'comfy', command: 'python3', args: ['main.py', '--listen', '127.0.0.1', '--port', '7860', '--disable-auto-launch',
      '--disable-all-custom-nodes', '--disable-api-nodes', '--output-directory', `${ROOT}/output`, '--temp-directory', `${ROOT}/temp`], cwd: ROOT, environment: base },
    { name: 'bridge', command: 'node', args: ['/app/scripts/comfyui-engine-server.mjs', '7861', 'http://127.0.0.1:7860', ROOT], cwd: '/app', environment: base },
    { name: 'host', command: 'node', args: ['--import', 'tsx', '/app/src/lib/salad/serve.mts'], cwd: '/app', environment: worker },
  ] };
}

/** Loopback read only; no warm-up, /prompt or model downloads. */
export async function waitForComfy({ fetchImpl = fetch, signal, timeoutMs = 120000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  do {
    if (signal?.aborted) throw new Error('SALAD_START_CANCELLED');
    try {
      const requestSignal = AbortSignal.any([AbortSignal.timeout(Math.min(2000, Math.max(1, deadline - Date.now()))), ...(signal ? [signal] : [])]);
      const response = await fetchImpl('http://127.0.0.1:7860/queue', { method: 'GET', redirect: 'error',
        signal: requestSignal });
      if (response.status === 200) {
        const body = await boundedJson(response, requestSignal);
        if (Array.isArray(body?.queue_running) && Array.isArray(body?.queue_pending)) return;
      } else await response.body?.cancel();
    } catch { /* No upstream error text or retries of generation. */ }
    if (Date.now() >= deadline) break;
    await delay(Math.min(intervalMs, deadline - Date.now()), undefined, { signal }).catch(() => {});
  } while (Date.now() < deadline);
  throw new Error('SALAD_COLD_START_TIMEOUT');
}

export async function supervise(plan, { spawnImpl = spawn, ready = waitForComfy, signals = process, stopMs = 5000 } = {}) {
  if (!plan.enabled) return { stop: async () => {}, done: Promise.resolve(0) };
  const children = new Map(); const controller = new AbortController();
  let closing; let finish; const done = new Promise(resolve => { finish = resolve; });
  async function terminate(child, grace) {
    if (!child || child.exited) return;
    child.process.kill('SIGTERM');
    let timer;
    const stopped = await Promise.race([child.closed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), grace); })]);
    clearTimeout(timer);
    if (!stopped) { child.process.kill('SIGKILL'); await child.closed; }
  }
  function stop(code = 0) {
    if (closing) return closing;
    controller.abort();
    // Keep Comfy/bridge alive while the existing host drains durable admissions/jobs.
    closing = Promise.resolve().then(async () => {
      await terminate(children.get('host'), plan.drainMs);
      await terminate(children.get('bridge'), stopMs);
      await terminate(children.get('comfy'), stopMs);
      signals.removeListener('SIGTERM', onSignal); signals.removeListener('SIGINT', onSignal);
      finish(code);
    });
    return closing;
  }
  function onSignal() { void stop(0); }
  signals.once('SIGTERM', onSignal); signals.once('SIGINT', onSignal);
  function start(spec) {
    if (controller.signal.aborted) throw new Error('SALAD_START_CANCELLED');
    const child = { exited: false, process: spawnImpl(spec.command, spec.args, {
      cwd: spec.cwd, env: spec.environment, stdio: 'ignore', shell: false }), closed: null };
    child.closed = new Promise(resolve => {
      const exited = () => { child.exited = true; resolve(); if (!controller.signal.aborted) void stop(1); };
      child.process.once('error', exited); child.process.once('exit', exited);
    });
    children.set(spec.name, child);
  }
  try {
    start(plan.processes[0]); await ready({ signal: controller.signal });
    start(plan.processes[1]); start(plan.processes[2]);
  } catch { await stop(1); }
  return { stop, done };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.SALAD_ENABLED === 'true') {
      // No Python, engine, model inspection or DB work can run on the Mac.
      if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error();
      const { saladWorkerEnvironmentConfig } = await import('../config.ts');
      const plan = containerPlan(process.env, process.platform, process.arch, saladWorkerEnvironmentConfig());
      process.exitCode = await (await supervise(plan)).done;
    }
  } catch { process.stderr.write('SALAD_CONTAINER_UNAVAILABLE\n'); process.exitCode = 1; }
}
