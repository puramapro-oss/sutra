import { SaladError } from './contracts'
import { boundedJson, type Fetcher } from './http'

// Contract of the existing scripts/comfyui-engine-server.mjs workflow, not a new engine.
// Node introspection proves installed interfaces only, never successful GPU execution.
const nodes: Record<string, { inputs: string[]; outputs: string[]; choices?: Record<string, string> }> = {
  CLIPLoader: { inputs: ['clip_name', 'type', 'device'], outputs: ['CLIP'],
    choices: { clip_name: 't5xxl_ltxv_official.safetensors', type: 'ltxv', device: 'default' } },
  CheckpointLoaderSimple: { inputs: ['ckpt_name'], outputs: ['MODEL', 'CLIP', 'VAE'],
    choices: { ckpt_name: 'ltxv-13b-0.9.8-distilled-fp8.safetensors' } },
  CLIPTextEncode: { inputs: ['text', 'clip'], outputs: ['CONDITIONING'] },
  EmptyLTXVLatentVideo: { inputs: ['width', 'height', 'length', 'batch_size'], outputs: ['LATENT'] },
  LTXVConditioning: { inputs: ['positive', 'negative', 'frame_rate'], outputs: ['CONDITIONING', 'CONDITIONING'] },
  LTXVScheduler: { inputs: ['steps', 'max_shift', 'base_shift', 'stretch', 'terminal'], outputs: ['SIGMAS'] },
  KSamplerSelect: { inputs: ['sampler_name'], outputs: ['SAMPLER'], choices: { sampler_name: 'euler' } },
  SamplerCustom: { inputs: ['model', 'add_noise', 'noise_seed', 'cfg', 'positive', 'negative', 'sampler', 'sigmas', 'latent_image'], outputs: ['LATENT'] },
  VAEDecode: { inputs: ['samples', 'vae'], outputs: ['IMAGE'] },
  CreateVideo: { inputs: ['images', 'fps'], outputs: ['VIDEO'] },
  SaveVideo: { inputs: ['video', 'filename_prefix', 'format'], outputs: [], choices: { format: 'auto' } },
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {}

/** Private GETs only, shared deadline and response caps; no /prompt, downloads or warm-up. */
export async function verifyComfyWorkflow(origin: string, fetcher: Fetcher, signal: AbortSignal): Promise<void> {
  try {
    await Promise.all(Object.entries(nodes).map(async ([name, expected]) => {
      const response = await fetcher(`${origin}/object_info/${name}`, { signal, redirect: 'error', cache: 'no-store' })
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error() }
      const node = record(record(await boundedJson(response, signal))[name])
      const input = record(node.input)
      const fields = { ...record(input.required), ...record(input.optional) }
      if (!expected.inputs.every(key => Array.isArray(fields[key]) && (fields[key] as unknown[]).length > 0)
        || !Array.isArray(node.output) || !expected.outputs.every((type, i) => node.output instanceof Array && node.output[i] === type)) throw new Error()
      for (const [key, value] of Object.entries(expected.choices ?? {})) {
        const choices = (fields[key] as unknown[])[0]
        if (!Array.isArray(choices) || !choices.includes(value)) throw new Error()
      }
      if (name === 'SaveVideo' && node.output_node !== true) throw new Error()
    }))
  } catch { throw new SaladError('SALAD_WORKFLOW_UNAVAILABLE') }
}
