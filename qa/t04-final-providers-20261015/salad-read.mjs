// Explicit, bounded, read-only audit. Never serialize credentials, identifiers or API bodies.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { parse as dotenvParse } from 'dotenv';
import { names, parseSelected } from '../t04-provider-validation-20261014/probe.mjs';

const scopeNames = ['SALAD_ORGANIZATION', 'SALAD_PROJECT', 'SALAD_CONTAINER_GROUP', 'SALAD_ORGANIZATION_NAME', 'SALAD_PROJECT_NAME'];
// NAME is the operator-facing spelling; legacy configuration remains accepted.
// An ambiguous scope must never select one organization's/project's resources.
function scope(values, name) {
  const legacy = values[name]; const canonical = values[`${name}_NAME`];
  if (legacy !== undefined && canonical !== undefined && legacy !== canonical) return undefined;
  return canonical ?? legacy;
}
export function selected(source) {
  const values = parseSelected(source);
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match || !scopeNames.includes(match[1])) continue;
    if (Object.hasOwn(values, match[1])) throw new Error('DUPLICATE_SCOPE');
    const value = dotenvParse(line)[match[1]]?.trim();
    if (!value || !/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(value)) throw new Error('INVALID_SCOPE');
    values[match[1]] = value;
  }
  return values;
}

export function summarize(kind, http, body) {
  if (http !== 200) return { status: 'BLOQUE', http, authentication: 'UNPROVEN', reason:
    [401, 403].includes(http) ? 'AUTH_OR_PERMISSION_REFUSED' : http === 404 ? 'SCOPE_NOT_FOUND_OR_NOT_VISIBLE'
      : http === 429 ? 'RATE_LIMIT' : 'HTTP_ERROR' };
  if (kind === 'quotas') {
    const q = body?.container_groups_quotas;
    if (q && ['container_replicas_quota', 'container_replicas_used'].every(k => Number.isSafeInteger(q[k]) && q[k] >= 0)) {
      return { status: 'PASS', http, authentication: 'ORGANIZATION_READ_CONFIRMED',
        replicaHeadroom: Math.max(0, q.container_replicas_quota - q.container_replicas_used), credits: 'NON_TESTE', generation: 'NON_TESTE' };
    }
  }
  if (kind === 'groups' && Array.isArray(body?.items) && body.items.every(g => g && typeof g.name === 'string')) {
    return { status: 'PASS', http, authentication: 'PROJECT_READ_CONFIRMED', groups: body.items.length,
      // Full configuration contains environment secrets: never return it.
      generation: 'NON_TESTE', gpuQualification: 'NON_TESTE' };
  }
  return { status: 'FAIL', http, reason: 'INVALID_RESPONSE_CONTRACT', authentication: 'UNPROVEN' };
}

export async function readScope(kind, values, { fetchImpl = fetch, timeoutMs = 15000, maxBytes = 1048576 } = {}) {
  const organization = scope(values, 'SALAD_ORGANIZATION'); const project = scope(values, 'SALAD_PROJECT');
  if (!['quotas', 'groups'].includes(kind) || !/^[A-Za-z0-9._~-]{16,512}$/.test(values.SALAD_API_KEY ?? '')
      || !/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(organization ?? '')
      || (kind === 'groups' && !/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(project ?? ''))) {
    return { status: 'BLOQUE', reason: 'MISSING_OR_INVALID_SCOPE', requests: 0 };
  }
  const base = `https://api.salad.com/api/public/organizations/${organization}`;
  const url = kind === 'quotas' ? `${base}/quotas` : `${base}/projects/${project}/containers`;
  const controller = new AbortController(); let timer; let http;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error()); }, timeoutMs); });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { 'Salad-Api-Key': values.SALAD_API_KEY, Accept: 'application/json' } });
      http = response.status;
      if (http !== 200) { await response.body?.cancel(); return summarize(kind, http, null); }
      const reader = response.body?.getReader(); if (!reader) throw new Error();
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const item = await reader.read(); if (item.done) break;
          bytes += item.value.byteLength; if (bytes > maxBytes) { await reader.cancel(); throw new Error(); }
          chunks.push(item.value);
        }
      } finally { reader.releaseLock(); }
      return summarize(kind, http, JSON.parse(Buffer.concat(chunks).toString('utf8')));
    })()]);
  } catch { return { status: 'BLOQUE', ...(http ? { http } : {}), reason: controller.signal.aborted ? 'TIMEOUT' : 'TRANSPORT_OR_MALFORMED_BODY' }; }
  finally { clearTimeout(timer); controller.abort(); }
}

export async function audit() {
  const path = `${homedir()}/.env.purama.master`; const info = await stat(path);
  if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid()) throw new Error();
  const inspected = inspectMaster(await readFile(path, 'utf8'));
  const { values, variables } = inspected; const results = {};
  const organization = scope(values, 'SALAD_ORGANIZATION'); const project = scope(values, 'SALAD_PROJECT');
  let requests = 0;
  if (values.SALAD_API_KEY && organization) {
    results.organization = await readScope('quotas', values); requests += results.organization.requests === 0 ? 0 : 1;
    if (results.organization.status === 'PASS' && project) {
      results.project = await readScope('groups', values); requests += results.project.requests === 0 ? 0 : 1;
    }
  }
  return { observedAt: new Date().toISOString(), source: '~/.env.purama.master', permissionsRestricted: true,
    variables,
    results, requests, mutations: 0, retries: 0,
    status: results.project?.status === 'PASS' ? 'PASS_READ_ONLY' : 'BLOQUE',
    reason: variables.some(v => v.name === 'SALAD_API_KEY' && v.syntax === 'UNSUPPORTED') ? 'MASTER_SALAD_KEY_SYNTAX_REQUIRES_LITERAL_VALUE'
      : !organization || !project ? 'MISSING_OR_CONFLICTING_SCOPE_PUBLIC_API_CANNOT_ENUMERATE' : 'SEE_RESULTS',
    saladEnabled: values.SALAD_ENABLED === 'true', generation: 'NON_TESTE', credits: 'NON_TESTE' };
}

export function inspectMaster(source) {
  const lines = source.split(/\r?\n/); const values = Object.create(null);
  const variables = [...names, ...scopeNames].map(name => {
    const matches = lines.filter(line => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(line));
    if (!matches.length) return { name, present: false, source: 'absent', syntax: 'ABSENT' };
    try {
      Object.assign(values, selected(matches.join('\n')));
      return { name, present: Boolean(values[name]), source: 'master', syntax: 'PASS' };
    } catch { return { name, present: true, source: 'master', syntax: 'UNSUPPORTED' }; }
  });
  return { values, variables };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== '--read-only-master') throw new Error();
    await writeFile(new URL('./salad-live.json', import.meta.url), JSON.stringify(await audit(), null, 2) + '\n', { mode: 0o600 });
  } catch { process.stderr.write('T04_SALAD_READ_FAILED_REDACTED\n'); process.exitCode = 1; }
}
