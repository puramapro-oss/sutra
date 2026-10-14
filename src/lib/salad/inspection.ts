import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import { SaladError } from './contracts'
import { boundedJson, type Fetcher } from './http'
import type { RuntimeInspection } from './worker'
import { verifyComfyWorkflow } from './workflow-contract'

const exec = promisify(execFile)
// Independently approved deployment receipt, mounted read-only. Never generated from
// SALAD_QUALIFICATION_JSON. Image identity is an operator attestation, not self-attestation.
const receiptSchema = z.object({
  image: z.string().regex(/^[a-z0-9][a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/),
  comfyRoot: z.string().refine(isAbsolute),
}).strict()
const weights = {
  model: 'models/checkpoints/ltxv-13b-0.9.8-distilled-fp8.safetensors',
  encoder: 'models/text_encoders/t5xxl_ltxv_official.safetensors',
} as const
const queueSchema = z.object({ queue_running: z.array(z.unknown()), queue_pending: z.array(z.unknown()) })

async function fileDigest(path: string): Promise<string> {
  const metadata = await stat(path)
  if (!metadata.isFile() || !metadata.size || (metadata.mode & 0o222)) throw new SaladError('SALAD_READ_ONLY_ARTIFACT_REQUIRED')
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

export interface InspectionIO {
  platform: string; architecture: string; fetcher: Fetcher
  probe(): Promise<{ gpu: string; vramMiB: number; freeVramMiB: number; cuda: string }>
}
const nativeIO: InspectionIO = {
  platform: process.platform, architecture: process.arch, fetcher: fetch,
  async probe() {
    // Only reached after the Linux/amd64 guard. No shell, model load or generation.
    const options = { timeout: 5000, maxBuffer: 16384, encoding: 'utf8' as const }
    const gpu = await exec('nvidia-smi', ['--query-gpu=name,memory.total,memory.free', '--format=csv,noheader,nounits'], options)
    const cuda = await exec('python3', ['-I', '-c', 'import sys,torch; sys.stdout.write(torch.version.cuda or "")'], options)
    const rows = gpu.stdout.trim().split('\n')
    if (rows.length !== 1) throw new SaladError('SALAD_SINGLE_GPU_REQUIRED')
    const parts = rows[0].split(',').map(s => s.trim())
    if (parts.length !== 3 || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2]) || !/^\d+\.\d+(\.\d+)?$/.test(cuda.stdout)) {
      throw new SaladError('SALAD_INVALID_HARDWARE_PROBE')
    }
    return { gpu: parts[0], vramMiB: Number(parts[1]), freeVramMiB: Number(parts[2]), cuda: cuda.stdout }
  },
}

/** One read-only hash pass at cold start; hardware and Comfy queue checked each time.
 * The image must use these exact canonical model directories (no extra_model_paths),
 * the same Python environment as Comfy, and read-only model/image mounts throughout.
 * Host stays cold until hashing finishes. No model download, server or engine start.
 */
export async function prepareSaladInspection(receiptPath: string, comfyUrl: string, io: InspectionIO = nativeIO) {
  if (io.platform !== 'linux' || io.architecture !== 'x64') throw new SaladError('SALAD_LINUX_AMD64_REQUIRED')
  try {
    const url = new URL(comfyUrl)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/'
      || url.username || url.password || url.search || url.hash) throw new Error()
    const info = await stat(receiptPath)
    if (!info.isFile() || info.size > 8192 || (info.mode & 0o222)) throw new Error()
    const receipt = receiptSchema.parse(JSON.parse(await readFile(receiptPath, 'utf8')))
    const root = await realpath(receipt.comfyRoot)
    // No path alias can silently substitute an uninspected weight directory.
    const paths = await Promise.all(Object.values(weights).map(async name => {
      const path = join(root, name)
      if (await realpath(path) !== path) throw new Error()
      return path
    }))
    const [modelSha256, encoderSha256] = await Promise.all(paths.map(fileDigest))
    return async (): Promise<RuntimeInspection> => {
      try {
        const signal = AbortSignal.timeout(5000)
        const response = await io.fetcher(`${url.origin}/queue`, { signal, redirect: 'error' })
        if (!response.ok) { await response.body?.cancel(); throw new Error() }
        const queue = queueSchema.parse(await boundedJson(response, signal))
        await verifyComfyWorkflow(url.origin, io.fetcher, signal)
        const hardware = await io.probe()
        if (!hardware.gpu || !Number.isInteger(hardware.vramMiB) || hardware.vramMiB <= 0
          || !Number.isFinite(hardware.freeVramMiB) || hardware.freeVramMiB < 0
          || hardware.freeVramMiB > hardware.vramMiB) throw new Error()
        return { platform: io.platform, architecture: io.architecture, image: receipt.image,
          ...hardware, modelSha256, encoderSha256,
          // Native workflow decodes with CheckpointLoaderSimple output 2: embedded VAE.
          vaeSha256: modelSha256, state: queue.queue_running.length || queue.queue_pending.length ? 'busy' : 'idle' }
      } catch { throw new SaladError('SALAD_INSPECTION_UNAVAILABLE') }
    }
  } catch { throw new SaladError('SALAD_INSPECTION_UNAVAILABLE') }
}
