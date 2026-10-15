// Minimal local build context only. Never builds, provisions, reads .env or downloads models.
import { readFile, lstat, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const CONTEXT_FILES = Object.freeze([
  'src/lib/salad/container/Dockerfile', 'src/lib/salad/container/package.json',
  'src/lib/salad/container/package-lock.json', 'src/lib/salad/container/requirements.lock',
  'src/lib/salad/container/launch.mjs', 'src/lib/salad/container/health.mjs',
  ...['config.ts', 'contracts.ts', 'host.ts', 'inspection.ts', 'workflow-contract.ts', 'worker.ts', 'engine.ts', 'http.ts', 'serve.mts'].map(name => `src/lib/salad/${name}`),
  'src/lib/salad-persistence.ts', 'src/lib/media-probe.ts', 'scripts/comfyui-engine-server.mjs',
]);

export async function prepareContext(destination, sourceRoot = fileURLToPath(new URL('../../../../', import.meta.url))) {
  if (!destination) throw new Error('SALAD_BUILD_CONTEXT_DESTINATION_REQUIRED');
  const root = await realpath(sourceRoot);
  // Read only the explicit source allowlist, rejecting symlinks and paths outside the checkout.
  const files = [];
  for (const path of CONTEXT_FILES) {
    const source = resolve(root, path);
    if (!(await lstat(source)).isFile() || !(await realpath(source)).startsWith(root + sep)) throw new Error('SALAD_BUILD_CONTEXT_SOURCE_INVALID');
    const bytes = await readFile(source);
    files.push({ path, bytes, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const target = resolve(destination);
  await mkdir(target, { mode: 0o700 }); // EEXIST refuses overwriting any existing work.
  for (const file of files) {
    const output = resolve(target, file.path);
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, file.bytes, { flag: 'wx', mode: 0o600 });
  }
  const manifest = { schema: 1, files: files.map(({ path, sha256 }) => ({ path, sha256 })) };
  await writeFile(resolve(target, 'context-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await prepareContext(process.argv[2]);
    process.stdout.write('SALAD_BUILD_CONTEXT_READY\n');
  } catch { process.stderr.write('SALAD_BUILD_CONTEXT_UNAVAILABLE\n'); process.exitCode = 1; }
}
