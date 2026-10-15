// This is a configuration gate, not another provider adapter.
// Credentials travel over a private stdin pipe, never argv, environment or output.
import { pathToFileURL } from 'node:url';
import { readScope } from '../t04-final-providers-20261015/salad-read.mjs';

export async function validateAccess(values, read = readScope) {
  const organization = await read('quotas', values);
  const requests = organization.requests === 0 ? 0 : 1;
  if (organization.status !== 'PASS') return { status: 'BLOQUE', requests, organization };
  const project = await read('groups', values);
  return { status: project.status === 'PASS' ? 'PASS_READ_ONLY' : 'BLOQUE',
    requests: requests + (project.requests === 0 ? 0 : 1), organization, project };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let bytes = 0; const chunks = [];
    for await (const chunk of process.stdin) {
      bytes += chunk.length; if (bytes > 4096) throw new Error();
      chunks.push(chunk);
    }
    const values = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!values || typeof values !== 'object' || Array.isArray(values)
        || Object.keys(values).some(k => !['SALAD_API_KEY', 'SALAD_ORGANIZATION', 'SALAD_PROJECT'].includes(k))) throw new Error();
    process.stdout.write(JSON.stringify(await validateAccess(values)) + '\n');
  } catch {
    process.stdout.write(JSON.stringify({ status: 'BLOQUE', reason: 'VALIDATION_FAILED_REDACTED' }) + '\n');
    process.exitCode = 1;
  }
}
