import { z } from 'zod'
import { MAX_SCENES } from './production-schema'
import { HIGGSFIELD_CINEMA_ENDPOINT, HIGGSFIELD_CINEMA_SCHEMA } from './higgsfield-contract'
import type { Scene, VideoFormat } from './storyboard'

/** A portable previsualization contract. It never submits a paid job. */
export const CINEMA_SCHEMA_VERSION = 1 as const
export const CINEMA_FPS = [
  [24, 1], [25, 1], [30, 1], [48, 1], [50, 1], [60, 1],
  [24000, 1001], [30000, 1001], [60000, 1001],
] as const

export interface CinemaFrameRate { numerator: number; denominator: number }
export interface CinemaDependencyNode { id: string; dependsOn: string[] }
export interface CinemaShot extends Scene {
  timeline: { startFrame: number; durationFrames: number; endFrameExclusive: number }
  source: { inFrame: 0; availableFrames: null; handleInFrames: 0; handleOutFrames: 0 }
  previewTransition: 'cut'
}
export interface CinemaProject {
  schemaVersion: 1
  productionStatus: 'previsualization'
  title: string
  format: VideoFormat
  fps: CinemaFrameRate
  timeline: { totalFrames: number; requestedSeconds: number; durationSeconds: number }
  scenes: CinemaShot[]
  dependencies: CinemaDependencyNode[]
  warnings: { code: 'FRAME_QUANTIZATION' | 'TRANSITION_NOT_PREVIEWED'; sceneId: string; message: string }[]
  qualification: {
    visual: 'not_tested'
    rights: 'unverified'
    audio: 'not_prepared'
    color: 'unqualified'
  }
  higgsfield: {
    modelEndpoint: typeof HIGGSFIELD_CINEMA_ENDPOINT
    status: 'not_submitted'
    requests: {
      sceneId: string
      status: 'not_submitted'
      issue: 'DURATION_REQUIRES_EDIT' | 'REQUEST_REQUIRES_EDIT' | null
      body: {
        prompt: string; duration: number; resolution: '720p'
        aspect_ratio: VideoFormat; generate_audio: true
      } | null
    }[]
  }
}

const rateSchema = z.object({
  numerator: z.number().int().positive(), denominator: z.number().int().positive(),
}).strict().refine(rate => CINEMA_FPS.some(([n, d]) => rate.numerator === n && rate.denominator === d))
const sceneSchema = z.object({
  id: z.string().min(1).max(128).refine(value => /\S/.test(value)),
  visual_prompt: z.string().min(1).max(16_000).refine(value => /\S/.test(value)),
  description: z.string().max(16_000),
  duration_seconds: z.number().finite().positive().max(120),
  transition: z.enum(['fade', 'cut', 'slide', 'zoom']),
}).strict()
const inputSchema = z.object({
  title: z.string().min(1).max(500).refine(value => /\S/.test(value)),
  format: z.enum(['16:9', '9:16', '1:1']),
  scenes: z.array(sceneSchema).min(1).max(MAX_SCENES),
  fps: rateSchema.optional(),
}).strict()

const invalid = () => new Error('Projet cinéma invalide : vérifie les plans, leurs identifiants, leurs durées (1 image à 120 s) et leur format.')

export function createCinemaProject(input: {
  title: string; format: VideoFormat; scenes: Scene[]; fps?: CinemaFrameRate
}): CinemaProject {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) throw invalid()
  const data = parsed.data
  if (new Set(data.scenes.map(scene => scene.id)).size !== data.scenes.length) throw invalid()
  const fps = data.fps ?? { numerator: 24, denominator: 1 }
  let seconds = 0
  let boundary = 0
  const warnings: CinemaProject['warnings'] = []
  const scenes = data.scenes.map((scene): CinemaShot => {
    const startFrame = boundary
    seconds += scene.duration_seconds
    // Round cumulative boundaries, not every duration independently: no accumulating drift.
    boundary = Math.round(seconds * fps.numerator / fps.denominator)
    const durationFrames = boundary - startFrame
    if (!Number.isSafeInteger(boundary) || durationFrames < 1 || boundary > 1_000_000) throw invalid()
    const actualSeconds = durationFrames * fps.denominator / fps.numerator
    if (Math.abs(actualSeconds - scene.duration_seconds) > 1e-8) {
      warnings.push({ code: 'FRAME_QUANTIZATION', sceneId: scene.id,
        message: 'La durée demandée est conservée ; les limites de montage sont arrondies à l’image la plus proche.' })
    }
    if (scene.transition !== 'cut') {
      warnings.push({ code: 'TRANSITION_NOT_PREVIEWED', sceneId: scene.id,
        message: 'La transition demandée est conservée dans le projet. La prévisualisation Blender utilise une coupe ; l’effet et ses poignées restent à préparer au montage.' })
    }
    return {
      ...scene,
      timeline: { startFrame, durationFrames, endFrameExclusive: boundary },
      source: { inFrame: 0, availableFrames: null, handleInFrames: 0, handleOutFrames: 0 },
      previewTransition: 'cut',
    }
  })
  return {
    schemaVersion: CINEMA_SCHEMA_VERSION, productionStatus: 'previsualization',
    title: data.title, format: data.format, fps,
    timeline: { totalFrames: boundary, requestedSeconds: seconds, durationSeconds: boundary * fps.denominator / fps.numerator },
    scenes,
    dependencies: [
      { id: 'project:settings', dependsOn: [] },
      ...scenes.map(scene => ({ id: `scene:${scene.id}`, dependsOn: ['project:settings'] })),
      { id: 'timeline:master', dependsOn: scenes.map(scene => `scene:${scene.id}`) },
      { id: 'export:master', dependsOn: ['timeline:master'] },
    ],
    warnings,
    qualification: { visual: 'not_tested', rights: 'unverified', audio: 'not_prepared', color: 'unqualified' },
    higgsfield: {
      modelEndpoint: HIGGSFIELD_CINEMA_ENDPOINT, status: 'not_submitted',
      requests: scenes.map(scene => {
        const durationSupported = Number.isInteger(scene.duration_seconds) && scene.duration_seconds >= 4 && scene.duration_seconds <= 30
        const body = {
          prompt: scene.visual_prompt, duration: scene.duration_seconds, resolution: '720p' as const,
          aspect_ratio: data.format, generate_audio: true as const,
        }
        const supported = durationSupported && HIGGSFIELD_CINEMA_SCHEMA.safeParse(body).success
        return {
          sceneId: scene.id, status: 'not_submitted',
          issue: supported ? null : durationSupported ? 'REQUEST_REQUIRES_EDIT' : 'DURATION_REQUIRES_EDIT',
          body: supported ? body : null,
        }
      }),
    },
  }
}

// Canonical comparison also rejects extra fields, forged qualification and stale derived timing.
// The small, bounded contract prevents arbitrary nested data from being serialized on export.
function canonical(value: unknown, depth = 0, budget = { remaining: 8_000 }): string {
  if (depth > 12 || --budget.remaining < 0) throw invalid()
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'string' && value.length <= 32_000) return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value) && value.length <= 512) return `[${value.map(item => canonical(item, depth + 1, budget)).join(',')}]`
  if (typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort()
    if (keys.length > 64) throw invalid()
    return `{${keys.map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], depth + 1, budget)}`).join(',')}}`
  }
  throw invalid()
}

export function validateCinemaProject(value: unknown): CinemaProject {
  const container = z.object({
    title: z.unknown(), format: z.unknown(), fps: z.unknown(), scenes: z.array(z.unknown()).min(1).max(MAX_SCENES),
  }).passthrough().safeParse(value)
  if (!container.success) throw invalid()
  const data = container.data
  const baseScenes = data.scenes.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid()
    const scene = raw as Record<string, unknown>
    return { id: scene.id, visual_prompt: scene.visual_prompt, description: scene.description,
      duration_seconds: scene.duration_seconds, transition: scene.transition }
  })
  const input = inputSchema.safeParse({ title: data.title, format: data.format, fps: data.fps, scenes: baseScenes })
  if (!input.success) throw invalid()
  const expected = createCinemaProject(input.data)
  if (canonical(value) !== canonical(expected)) throw invalid()
  return expected
}

export function exportCinemaProjectJson(project: CinemaProject): string {
  return `${JSON.stringify(validateCinemaProject(project), null, 2)}\n`
}

/** Transitive invalidation plan only. The existing worker remains responsible for execution. */
export function affectedCinemaNodes(nodes: CinemaDependencyNode[], changedIds: string[]): string[] {
  const parsed = z.array(z.object({
    id: z.string().min(1).max(256), dependsOn: z.array(z.string().min(1).max(256)).max(512),
  }).strict()).max(512).safeParse(nodes)
  if (!parsed.success || !Array.isArray(changedIds) || changedIds.length > 512) throw invalid()
  const byId = new Map(parsed.data.map(node => [node.id, node]))
  if (byId.size !== nodes.length || changedIds.some(id => !byId.has(id))) throw invalid()
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string) => {
    if (visited.has(id)) return
    const node = byId.get(id)
    if (!node || visiting.has(id) || new Set(node.dependsOn).size !== node.dependsOn.length) throw invalid()
    visiting.add(id)
    for (const parent of node.dependsOn) visit(parent)
    visiting.delete(id)
    visited.add(id)
  }
  for (const node of nodes) visit(node.id)
  const affected = new Set(changedIds)
  let expanded = true
  while (expanded) {
    expanded = false
    for (const node of nodes) {
      if (!affected.has(node.id) && node.dependsOn.some(id => affected.has(id))) {
        affected.add(node.id)
        expanded = true
      }
    }
  }
  return nodes.filter(node => affected.has(node.id)).map(node => node.id)
}
