// Exec probe: credentials stay in process memory, never in argv or logs.
import { pathToFileURL } from 'node:url';
import { boundedJson } from '../http.ts';
import { PROTOCOL } from '../contracts.ts';
export async function health(values = process.env, fetchImpl = fetch, timeoutMs = 6000) {
  if (values.SALAD_ENABLED !== 'true' || !/^[A-Za-z0-9._~-]{32,512}$/.test(values.SALAD_WORKER_TOKEN ?? '')) return false;
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const response = await fetchImpl('http://127.0.0.1:7862/health', { method: 'GET', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${values.SALAD_WORKER_TOKEN}` } });
    if (response.status !== 200) { await response.body?.cancel(); return false; }
    const body = await boundedJson(response, signal);
    // Busy is healthy: an exec liveness probe must not evict a running generation.
    return body?.protocol === PROTOCOL && ['ready', 'busy'].includes(body?.state);
  } catch { return false; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await health() ? 0 : 1;
