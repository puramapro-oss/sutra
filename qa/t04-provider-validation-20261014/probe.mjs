// Read-only audit harness. No environment imports, mutation routes, retries or raw responses.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { parse as dotenvParse } from 'dotenv';

export const names = Object.freeze([
  'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'SHOTSTACK_API_KEY', 'SHOTSTACK_PRODUCTION_KEY',
  'SHOTSTACK_ENV', 'SUNO_API_KEY', 'SUNO_API_BASE_URL', 'SUNO_BASE_URL', 'LTX_API_KEY',
  'SALAD_ENABLED', 'SALAD_API_KEY', 'SALAD_GATEWAY_URL', 'SALAD_WORKER_TOKEN',
  'SALAD_WORKER_DATABASE_URL', 'SALAD_QUALIFICATION_JSON', 'SALAD_QUOTE_JSON',
  'SALAD_MAX_ESTIMATED_COMPUTE_USD', 'SALAD_REQUEST_TIMEOUT_MS', 'SALAD_GENERATION_TIMEOUT_MS',
  'SALAD_DEPLOYMENT_RECEIPT_PATH', 'SALAD_COMFY_URL', 'SALAD_BRIDGE_URL', 'SALAD_WORKER_PORT',
]);

export function parseSelected(source) {
  const values = Object.create(null);
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match || !names.includes(match[1])) continue;
    if (Object.hasOwn(values, match[1])) throw new Error('MASTER_DUPLICATE_SELECTED_NAME');
    const raw = match[2].trim();
    if (/[`$]/.test(raw)) throw new Error('MASTER_UNSUPPORTED_SYNTAX');
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0];
      const end = raw.indexOf(quote, 1);
      if (end < 0 || !/^\s*(?:#.*)?$/.test(raw.slice(end + 1))) throw new Error('MASTER_UNSUPPORTED_SYNTAX');
    }
    // Same parser + boundary normalization as T01 activation, in memory only.
    const value = dotenvParse(line)[match[1]]?.trim();
    if (value === undefined) throw new Error('MASTER_UNSUPPORTED_SYNTAX');
    if (/[\r\n\0\\`$]/.test(value)) throw new Error('MASTER_UNSUPPORTED_SYNTAX');
    values[match[1]] = value;
  }
  return values;
}

export function planReads(values) {
  const plans = [];
  if (values.RUNPOD_API_KEY && values.RUNPOD_ENDPOINT_ID) plans.push({
    provider: 'runpod', url: `https://api.runpod.ai/v2/${values.RUNPOD_ENDPOINT_ID}/health`,
    key: values.RUNPOD_API_KEY,
  });
  if (values.SHOTSTACK_API_KEY) plans.push({ provider: 'shotstack-stage', url: 'https://api.shotstack.io/edit/stage/templates', key: values.SHOTSTACK_API_KEY });
  if (values.SHOTSTACK_PRODUCTION_KEY) plans.push({ provider: 'shotstack-v1', url: 'https://api.shotstack.io/edit/v1/templates', key: values.SHOTSTACK_PRODUCTION_KEY });
  const sunoBase = values.SUNO_API_BASE_URL?.trim() || values.SUNO_BASE_URL?.trim();
  if (values.SUNO_API_KEY && sunoBase) plans.push({ provider: 'suno', url: `${sunoBase.replace(/\/$/, '')}/generate/credit`, key: values.SUNO_API_KEY });
  return plans;
}

export function permittedRead(plan) {
  if (typeof plan.key !== 'string' || !plan.key.trim() || /[\x00-\x20\x7f]/.test(plan.key)) return false;
  const exact = {
    'shotstack-stage': 'https://api.shotstack.io/edit/stage/templates',
    'shotstack-v1': 'https://api.shotstack.io/edit/v1/templates',
    suno: 'https://api.sunoapi.org/api/v1/generate/credit',
  };
  return plan.provider === 'runpod'
    ? /^https:\/\/api\.runpod\.ai\/v2\/[A-Za-z0-9_-]{1,200}\/health$/.test(plan.url)
    : Object.hasOwn(exact, plan.provider) && plan.url === exact[plan.provider];
}

const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v) => Number.isSafeInteger(v) && v >= 0;

export function classify(provider, http, body) {
  if (http !== 200) return { status: 'BLOQUE', http, authentication: 'UNPROVEN', reason:
    http === 401 || http === 403 ? 'AUTH_ENV_OR_PERMISSION_REFUSED'
      : http === 404 ? 'RESOURCE_OR_URL_NOT_FOUND' : http === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR' };
  if (provider === 'runpod' && record(body?.jobs) && record(body?.workers)
      && ['completed', 'failed', 'inProgress', 'inQueue', 'retried'].every((k) => count(body.jobs[k]))
      && ['idle', 'initializing', 'ready', 'running', 'throttled', 'unhealthy'].every((k) => count(body.workers[k]))) {
    return { status: 'PASS', http, authentication: 'ENDPOINT_HEALTH_READ_CONFIRMED', contract: true,
      readyWorkers: body.workers.ready, credits: 'NON_TESTE', generation: 'NON_TESTE' };
  }
  if (provider.startsWith('shotstack-') && body?.success === true && Array.isArray(body.response?.templates)) {
    return { status: 'PASS', http, authentication: 'TEMPLATES_READ_CONFIRMED', contract: true,
      templateCount: body.response.templates.length, credits: 'NON_TESTE', generation: 'NON_TESTE' };
  }
  if (provider === 'suno' && body?.code === 200 && typeof body.data === 'number' && Number.isFinite(body.data) && body.data >= 0) {
    return { status: 'PASS', http, authentication: 'CREDIT_READ_CONFIRMED', contract: true,
      creditsAvailable: body.data > 0, generation: 'NON_TESTE' };
  }
  const reason = provider === 'suno' && body?.code === 429 ? 'INSUFFICIENT_CREDITS'
    : provider === 'suno' && [405, 430].includes(body?.code) ? 'RATE_LIMIT'
    : provider === 'suno' && [401, 403].includes(body?.code) ? 'AUTH_ENV_OR_PERMISSION_REFUSED'
    : 'INVALID_RESPONSE_CONTRACT';
  return { status: 'BLOQUE', http, authentication: 'UNPROVEN', reason };
}

export async function probe(plan, { fetchImpl = globalThis.fetch, timeoutMs = 15_000, maxBytes = 1_048_576 } = {}) {
  if (!permittedRead(plan)) return { status: 'BLOQUE', reason: 'READ_ALLOWLIST_REJECTED' };
  const controller = new AbortController();
  let timer;
  let http;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(new Error('TIMEOUT'));
  }, timeoutMs); });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetchImpl(plan.url, { method: 'GET', redirect: 'error', signal: controller.signal,
        headers: plan.provider.startsWith('shotstack-') ? { 'x-api-key': plan.key } : { Authorization: `Bearer ${plan.key}` } });
      http = response.status;
      if (http !== 200) { await response.body?.cancel(); return classify(plan.provider, http, null); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('EMPTY_BODY');
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > maxBytes) { await reader.cancel(); throw new Error('BODY_LIMIT'); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      return classify(plan.provider, http, JSON.parse(Buffer.concat(chunks).toString('utf8')));
    })()]);
  } catch {
    return { status: 'BLOQUE', ...(http === undefined ? {} : { http }), authentication: 'UNPROVEN',
      reason: controller.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_OR_MALFORMED_BODY' };
  } finally { clearTimeout(timer); controller.abort(); }
}

export async function auditMaster() {
  const master = `${homedir()}/.env.purama.master`;
  const metadata = await stat(master);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid()) throw new Error('MASTER_PERMISSIONS_REFUSED');
  const values = parseSelected(await readFile(master, 'utf8'));
  const results = {};
  for (const plan of planReads(values)) results[plan.provider] = await probe(plan);
  return { observedAt: new Date().toISOString(), source: '~/.env.purama.master', permissionsRestricted: true,
    variables: names.map((name) => ({ name, present: Boolean(values[name]), source: values[name] ? 'master' : 'absent' })),
    selectedSunoVariable: values.SUNO_API_BASE_URL?.trim() ? 'SUNO_API_BASE_URL' : values.SUNO_BASE_URL?.trim() ? 'SUNO_BASE_URL' : null,
    shotstackSelectionValid: !values.SHOTSTACK_ENV || ['stage', 'v1'].includes(values.SHOTSTACK_ENV),
    saladEnabledInMaster: values.SALAD_ENABLED === 'true', results,
    ltx: { status: 'NON_TESTE', reason: 'NO_DOCUMENTED_FREE_ACCOUNT_READ_OR_EXISTING_JOB_ID' },
    salad: { status: 'NON_TESTE', reason: 'NO_LIVE_PROBE_BEFORE_IMAGE_AND_GPU_QUALIFICATION' },
    requests: Object.keys(results).length, mutations: 0, retries: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== '--read-only-master') throw new Error('EXPLICIT_AUDIT_FLAG_REQUIRED');
    const report = await auditMaster();
    await writeFile(new URL('./live.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  } catch {
    // Do not serialize exception text, paths, headers, URLs or response bodies.
    process.stderr.write('T04_READ_ONLY_AUDIT_FAILED_REDACTED\n'); process.exitCode = 1;
  }
}
