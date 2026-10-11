// Serveur adaptateur : contrat SUTRA local-engine ↔ API ComfyUI (LTX-Video).
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// POST {prompt,width,height,num_frames,fps,upscale_4x?} → {video_url,...}
// GET  /health → ok si ComfyUI répond
// GET  /files?... → proxifie le rendu ComfyUI (/view)
//
// Modèle : ltxv-13b-0.9.8-distilled-fp8 (Lightricks, licence LTXV Open Weights
// 0.X — usage commercial OK sous 10 M$ de CA). Sources 100 % officielles.
// Ce serveur tourne LOCALEMENT sur le Mac du propriétaire ; les clients SUTRA
// restent sur les API externes (routage owner-only dans local-engine.ts).
//
//   node scripts/comfyui-engine-server.mjs [port=7861] [comfyUrl=127.0.0.1:7860]
// -----------------------------------------------------------------------------
import http from 'node:http'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.argv[2] ?? 7861)
// Accepte "127.0.0.1:7860" comme "http://127.0.0.1:7860" (fetch exige un schéma).
const COMFY = (process.argv[3] ?? 'http://127.0.0.1:7860').replace(/^(?![a-z]+:)/i, 'http://')
// Racine ComfyUI (pour écrire les exports finaux dans output/sutra).
const COMFY_ROOT = process.argv[4] ?? join(homedir(), 'purama/ComfyUI')
const CKPT = 'ltxv-13b-0.9.8-distilled-fp8.safetensors'
const T5 = 't5xxl_ltxv_official.safetensors'
const UPS = 'ltxv-spatial-upscaler-0.9.8.safetensors'
const VAE = 'ltxv_vae-0.9.8.safetensors'

const NEGATIVE = 'low quality, worst quality, deformed, distorted, disfigured, motion smear, motion artifacts, fused fingers, bad anatomy, weird hand, ugly'

const snap32 = (v) => Math.max(256, Math.round(v / 32) * 32)
const snapFrames = (n) => Math.max(9, Math.floor((n - 1) / 8) * 8 + 1) // LTXV : 8k+1

/** Workflow API ComfyUI génération native (noms vérifiés via /object_info). */
function buildWorkflow({ prompt, width, height, numFrames, fps, steps }) {
  const w = {
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: T5, type: 'ltxv', device: 'default' } },
    ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CKPT } },
    pos: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['clip', 0] } },
    neg: { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['clip', 0] } },
    latent: { class_type: 'EmptyLTXVLatentVideo', inputs: { width, height, length: numFrames, batch_size: 1 } },
    cond: { class_type: 'LTXVConditioning', inputs: { positive: ['pos', 0], negative: ['neg', 0], frame_rate: fps } },
    sched: { class_type: 'LTXVScheduler', inputs: { steps, max_shift: 2.05, base_shift: 0.95, stretch: true, terminal: 0.1 } },
    selsmp: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    sample: {
      class_type: 'SamplerCustom',
      inputs: {
        model: ['ckpt', 0], add_noise: true, noise_seed: Math.floor(Math.random() * 2 ** 47),
        cfg: 1.0, positive: ['cond', 0], negative: ['cond', 1],
        sampler: ['selsmp', 0], sigmas: ['sched', 0], latent_image: ['latent', 0],
      },
    },
    vae: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['ckpt', 2] } },
    video: { class_type: 'CreateVideo', inputs: { images: ['vae', 0], fps } },
    save: { class_type: 'SaveVideo', inputs: { video: ['video', 0], filename_prefix: 'sutra/local', format: 'auto' } },
  }
  return w
}

async function comfy(path, init) {
  const res = await fetch(`${COMFY}${path}`, init)
  if (!res.ok) throw new Error(`ComfyUI ${path} -> HTTP ${res.status}`)
  return res
}

/**
 * Étape 2 (upscale seul, ~5 Go en RAM : VAE 2,4 Go + upscaler 0,24 Go).
 * La chaîne monoprompt (gén+upscale) OOM-kill le process : T5 18 Go +
 * ckpt 24,9 Go + VAE + tenseurs vidéo ≈ 46+ Go / 48 Go → jetsam macOS.
 * D'où : gén native (étape 1) PUIS upscale dans un 2e prompt séparé.
 */
function buildUpscaleWorkflow(fileName, passes) {
  const w = {
    load: { class_type: 'LoadVideo', inputs: { file: fileName } },
    get: { class_type: 'GetVideoComponents', inputs: { video: ['load', 0] } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: VAE } },
    enc: { class_type: 'VAEEncode', inputs: { pixels: ['get', 0], vae: ['vae', 0] } },
    upl: { class_type: 'LatentUpscaleModelLoader', inputs: { model_name: UPS } },
    up1: { class_type: 'LTXVLatentUpsampler', inputs: { samples: ['enc', 0], upscale_model: ['upl', 0], vae: ['vae', 0] } },
    dec: {
      class_type: 'VAEDecodeTiled',
      inputs: { samples: ['up1', 0], vae: ['vae', 0], tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 },
    },
    video: { class_type: 'CreateVideo', inputs: { images: ['dec', 0], fps: ['get', 2] } },
    save: { class_type: 'SaveVideo', inputs: { video: ['video', 0], filename_prefix: 'sutra/local4k', format: 'auto' } },
  }
  if (passes >= 2) {
    w.up2 = { class_type: 'LTXVLatentUpsampler', inputs: { samples: ['up1', 0], upscale_model: ['upl', 0], vae: ['vae', 0] } }
    w.dec.inputs.samples = ['up2', 0]
  }
  return w
}

/** Soumet un workflow et attend sa sortie (fichier vidéo) — commun aux 2 étapes. */
// saveKey : id du nœud SaveVideo. OBLIGATOIRE : scanner tous les outputs
// history renvoie parfois le passthrough LoadVideo (fichier input) en 1er.
async function submitAndWait(workflow, saveKey) {
  const clientId = `sutra-${Date.now()}`
  const q = await comfy('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  }).then((r) => r.json())
  const promptId = q.prompt_id
  if (q.error) throw new Error(`ComfyUI refuse le workflow : ${JSON.stringify(q.node_errors ?? q.error).slice(0, 400)}`)

  const deadline = Date.now() + 25 * 60_000
  for (;;) {
    await new Promise((r) => setTimeout(r, 1500))
    if (Date.now() > deadline) throw new Error('Timeout génération locale (25 min)')
    const hist = await comfy(`/history/${promptId}`).then((r) => r.json())
    const h = hist[promptId]
    if (!h) continue
    if (h.status?.status_str === 'error') {
      const msgs = Object.values(h.status.messages ?? {}).flat().join(' | ')
      throw new Error(`ComfyUI erreur : ${String(msgs).slice(0, 400)}`)
    }
    if (!h.status?.completed) continue
    const nodeOut = h.outputs?.[saveKey]
    for (const key of ['videos', 'gifs', 'images']) {
      const files = nodeOut?.[key]
      if (files?.length) return files[0]
    }
    throw new Error(`ComfyUI terminé sans sortie du nœud ${saveKey}`)
  }
}

/** Pousse un fichier local dans l'input dir ComfyUI (POST /upload/image, champ "image"). */
async function uploadToInput(buffer, name) {
  const form = new FormData()
  // NB : ComfyUI lit post.get("image") — le champ DOIT s'appeler "image".
  form.append('image', new Blob([buffer], { type: 'video/mp4' }), name)
  form.append('overwrite', 'true')
  const r = await comfy('/upload/image', { method: 'POST', body: form }).then((x) => x.json())
  if (!r?.name) throw new Error(`Upload ComfyUI échoué : ${JSON.stringify(r).slice(0, 200)}`)
  return r.name
}

/**
 * Étape 3 — adaptation finale : redimensionne vers la résolution export EXACTE
 * (ex. UHD 3840×2160) sans déformation : source 4096×2304 et cible 3840×2160
 * sont toutes deux 16:9 → scale pur (lanczos), ici léger downscale 0,9375.
 * Écrit dans output/sutra de ComfyUI pour rester servi par /files.
 */
function finalizeVideo(buffer, targetWidth, targetHeight, tag) {
  return new Promise((resolve, reject) => {
    const outDir = join(COMFY_ROOT, 'output', 'sutra')
    mkdirSync(outDir, { recursive: true })
    const inPath = join(outDir, `finalize-in-${tag}.mp4`)
    const outName = `sutra-final-${tag}-${targetWidth}x${targetHeight}.mp4`
    const outPath = join(outDir, outName)
    writeFileSync(inPath, buffer)
    const args = [
      '-y', '-v', 'error', '-i', inPath,
      '-vf', `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
      '-c:v', 'libx264', '-crf', '17', '-preset', 'medium',
      '-movflags', '+faststart', '-an', outPath,
    ]
    const t0 = Date.now()
    const p = spawn('ffmpeg', args)
    let err = ''
    p.stderr.on('data', (d) => { err += d })
    p.on('error', reject)
    p.on('close', (code) => {
      if (code !== 0) reject(new Error(`ffmpeg scale exit ${code}: ${err.slice(0, 300)}`))
      else resolve({ filename: outName, subfolder: 'sutra', type: 'output', ms: Date.now() - t0 })
    })
  })
}

async function fetchComfyFile(f) {
  return Buffer.from(await comfy(`/view?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder ?? '')}&type=${encodeURIComponent(f.type ?? 'output')}`).then((r) => r.arrayBuffer()))
}

/** Dimensions d'un mp4 local (ffprobe) — pour la garde anti-étirement. */
function ffprobeDims(path) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path])
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('error', reject)
    p.on('close', (code) => {
      const m = /(\d+),(\d+)/.exec(out)
      if (code !== 0 || !m) reject(new Error(`ffprobe échoué (${code}): ${err.slice(0, 200)}`))
      else resolve({ width: Number(m[1]), height: Number(m[2]) })
    })
  })
}

/** Refuse un resize qui déformerait l'image (ratios source/cible > 1 % d'écart). */
function assertSameRatio(srcW, srcH, dstW, dstH) {
  const a = srcW / srcH
  const b = dstW / dstH
  if (Math.abs(a - b) / b > 0.01) {
    throw new Error(`Refusé : resize ${srcW}x${srcH} (ratio ${a.toFixed(4)}) → ${dstW}x${dstH} (ratio ${b.toFixed(4)}) étirerait l'image. Génère en natif au bon ratio (ex. 1024x576 pour 16:9).`)
  }
}

const fileUrl = (f) => `http://127.0.0.1:${PORT}/files?filename=${encodeURIComponent(f.filename)}&subfolder=${encodeURIComponent(f.subfolder ?? '')}&type=${encodeURIComponent(f.type ?? 'output')}`

async function runGeneration(params) {
  const t0 = Date.now()
  const stages = []
  // Étape 1 : génération native (upscale désactivé — OOM si monoprompt, cf buildUpscaleWorkflow).
  const t1 = Date.now()
  const f = await submitAndWait(buildWorkflow({ ...params, upscale4x: false }), 'save')
  stages.push({ stage: 'native', ms: Date.now() - t1, width: params.width, height: params.height })
  let final = f
  let generator = `comfyui:${CKPT}`
  if (params.upscale4x) {
    // Étape 2 : upscale ×2 passes dans un prompt séparé (RAM ~5 Go).
    const t2 = Date.now()
    const inputName = await uploadToInput(await fetchComfyFile(f), `sutra-native-${Date.now()}.mp4`)
    final = await submitAndWait(buildUpscaleWorkflow(inputName, 2), 'save')
    stages.push({ stage: 'upscale_ia_x2passes', ms: Date.now() - t2, width: params.width * 4, height: params.height * 4 })
    generator += `+2x${UPS}(x2 passes, 2-stage)`
  }
  const last = stages.at(-1)
  if (params.targetWidth && (params.targetWidth !== last.width || params.targetHeight !== last.height)) {
    // Étape 3 : adaptation finale exacte (scale pur même ratio, jamais d'étirement).
    assertSameRatio(last.width, last.height, params.targetWidth, params.targetHeight)
    const out = await finalizeVideo(await fetchComfyFile(final), params.targetWidth, params.targetHeight, `${Date.now()}`)
    final = out
    stages.push({ stage: 'final_resize', ms: out.ms, width: params.targetWidth, height: params.targetHeight })
    generator += `+ffmpeg_lanczos(${params.targetWidth}x${params.targetHeight})`
  }
  return {
    video_url: fileUrl(final),
    generator,
    compute_ms: Date.now() - t0,
    stages,
    width: stages.at(-1).width, height: stages.at(-1).height, frames: params.numFrames, fps: params.fps,
  }
}

/** Upscale standalone d'une vidéo déjà rendue (fichier dans l'input dir ComfyUI). */
async function runUpscale(fileName, passes, target) {
  const t0 = Date.now()
  const stages = []
  const t1 = Date.now()
  let final = await submitAndWait(buildUpscaleWorkflow(fileName, passes), 'save')
  stages.push({ stage: 'upscale_ia_x2passes', ms: Date.now() - t1 })
  let generator = `comfyui:2x${UPS}(x${passes} passes, standalone)`
  if (target?.width && target?.height) {
    const src = await ffprobeDims(join(COMFY_ROOT, 'output', final.subfolder ?? '', final.filename))
    assertSameRatio(src.width, src.height, target.width, target.height)
    const out = await finalizeVideo(await fetchComfyFile(final), target.width, target.height, `${Date.now()}`)
    final = out
    stages.push({ stage: 'final_resize', ms: out.ms, width: target.width, height: target.height })
    generator += `+ffmpeg_lanczos(${target.width}x${target.height})`
  }
  return {
    video_url: fileUrl(final),
    generator,
    compute_ms: Date.now() - t0,
    stages,
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      await comfy('/system_stats', { signal: AbortSignal.timeout(3000) })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, comfy: COMFY }))
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, detail: String(err) }))
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/files') {
    try {
      const upstream = await comfy(`/view?${url.searchParams.toString()}`)
      res.writeHead(200, { 'Content-Type': 'video/mp4' })
      res.end(Buffer.from(await upstream.arrayBuffer()))
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/upscale') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const b = JSON.parse(body)
      const passes = Math.min(2, Math.max(1, Number(b.passes ?? 2)))
      if (!b.input_file) throw new Error('input_file requis (nom du fichier dans l\'input dir ComfyUI)')
      // Cible finale = export ffmpeg : toute résolution EXACTE acceptée
      // (2160 n'est pas multiple de 32 — snap32 réservé à la grille LTXV).
      const target = b.target_width && b.target_height
        ? { width: Math.round(Number(b.target_width)), height: Math.round(Number(b.target_height)) }
        : undefined
      const out = await runUpscale(String(b.input_file), passes, target)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(out))
    } catch (err) {
      console.error('[comfyui-adapter:upscale]', err instanceof Error ? err.message : err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/') {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const b = JSON.parse(body)
      const params = {
        prompt: String(b.prompt ?? 'cinematic shot'),
        width: snap32(Number(b.width ?? 768)),
        height: snap32(Number(b.height ?? 512)),
        numFrames: snapFrames(Number(b.num_frames ?? 97)),
        fps: Number(b.fps ?? 24),
        steps: Math.min(30, Math.max(4, Number(b.steps ?? 8))),
        upscale4x: Boolean(b.upscale_4x),
        targetWidth: b.target_width ? Number(b.target_width) : undefined,
        targetHeight: b.target_height ? Number(b.target_height) : undefined,
      }
      const out = await runGeneration(params)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(out))
    } catch (err) {
      console.error('[comfyui-adapter]', err instanceof Error ? err.message : err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`adaptateur SUTRA<->ComfyUI sur http://127.0.0.1:${PORT} (comfy ${COMFY})`)
})
