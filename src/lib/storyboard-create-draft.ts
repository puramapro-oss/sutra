import { z } from 'zod'
import { createCinemaProject } from './cinema-project'
import { createVideoSchema, manualScriptSchema } from './validators'
import type { Scene, VideoFormat, DurationTarget } from './storyboard'

export const STORYBOARD_DRAFT_EVENT = 'sutra-storyboard-draft-changed'
export const MAX_STORYBOARD_DRAFT_BYTES = 512 * 1024
type DraftStorage = Pick<Storage, 'getItem' | 'setItem'>
export interface StoryboardDraftSource {
  idea: string; format: VideoFormat; durationTarget: DurationTarget; scenes: Scene[]
}
export interface StoryboardCreateDraft {
  version: 1; id: string; userId: string; importCount: number; source: StoryboardDraftSource
}
export interface ManualStoryboardDraft { topic: string; format: VideoFormat; script: string }
type DraftErrorCode = 'INVALID' | 'CORRUPT' | 'STORAGE' | 'EXISTS' | 'CHANGED' | 'LOCKED' | 'CONSENT'
export class StoryboardDraftError extends Error {
  constructor(public readonly code: DraftErrorCode, message: string) { super(message) }
}
const invalid = () => new StoryboardDraftError('INVALID', 'Transfert de storyboard invalide ou trop volumineux. Vérifie les plans, le sujet et leurs descriptions, puis prépare à nouveau le brouillon.')
const unavailable = () => new StoryboardDraftError('STORAGE', 'Le stockage de cet onglet est indisponible. Aucun brouillon n’a été remplacé ni importé.')
const sourceSchema = z.object({
  idea: z.string().max(500), format: z.enum(['16:9', '9:16', '1:1']),
  durationTarget: z.enum(['short', 'medium', 'long']), scenes: z.array(z.unknown()).min(1).max(60),
}).strict()
const envelopeSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), userId: z.string().uuid(),
  importCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1), source: z.unknown(),
}).strict()

export function storyboardDraftKey(userId: string): string {
  if (!z.string().uuid().safeParse(userId).success) throw invalid()
  return `sutra:storyboard-draft:v1:${userId}`
}

export function manualDraftFromStoryboard(source: StoryboardDraftSource): ManualStoryboardDraft {
  const topic = source.idea.trim() || 'Mon storyboard'
  // A source description remains one manual scene, including when it has line breaks.
  const lines = source.scenes.map(scene => scene.description.replace(/\r\n?|\n/g, ' ').trim())
  const script = lines.join('\n')
  if (lines.some(line => !line) || !manualScriptSchema.safeParse(script).success ||
    !createVideoSchema.shape.topic.safeParse(topic).success) throw invalid()
  return { topic, format: source.format, script }
}

function validateSource(value: unknown): StoryboardDraftSource {
  const parsed = sourceSchema.safeParse(value)
  if (!parsed.success) throw invalid()
  try {
    // Reuse the cinema contract for IDs, prompts, descriptions, timing and transitions.
    const project = createCinemaProject({ title: parsed.data.idea.trim() || 'Mon storyboard',
      format: parsed.data.format, scenes: parsed.data.scenes as Scene[] })
    const source: StoryboardDraftSource = { ...parsed.data,
      scenes: project.scenes.map(({ id, visual_prompt, description, duration_seconds, transition }) =>
        ({ id, visual_prompt, description, duration_seconds, transition })) }
    manualDraftFromStoryboard(source)
    return source
  } catch { throw invalid() }
}

function boundedJson(value: unknown): string {
  let raw: string
  try { raw = JSON.stringify(value) } catch { throw invalid() }
  if (typeof raw !== 'string' || raw.length > MAX_STORYBOARD_DRAFT_BYTES ||
    new TextEncoder().encode(raw).byteLength > MAX_STORYBOARD_DRAFT_BYTES) throw invalid()
  return raw
}

function parseStored(raw: string, userId: string): StoryboardCreateDraft {
  if (raw.length > MAX_STORYBOARD_DRAFT_BYTES || new TextEncoder().encode(raw).byteLength > MAX_STORYBOARD_DRAFT_BYTES) throw invalid()
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw invalid() }
  const parsed = envelopeSchema.safeParse(value)
  if (!parsed.success || parsed.data.userId !== userId) throw invalid()
  return { ...parsed.data, source: validateSource(parsed.data.source) }
}

export function readStoryboardDraft(storage: DraftStorage, userId: string): StoryboardCreateDraft | null {
  const key = storyboardDraftKey(userId)
  let raw: string | null
  try { raw = storage.getItem(key) } catch { throw unavailable() }
  if (raw === null) return null
  try { return parseStored(raw, userId) }
  catch { throw new StoryboardDraftError('CORRUPT', 'Le transfert conservé est illisible ou appartient à un autre compte. Prépare à nouveau ton storyboard pour cet utilisateur.') }
}

function writeDraft(storage: DraftStorage, packet: StoryboardCreateDraft) {
  const key = storyboardDraftKey(packet.userId), raw = boundedJson(packet)
  try { storage.setItem(key, raw) } catch { throw unavailable() }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORYBOARD_DRAFT_EVENT))
}

export function prepareStoryboardDraft(storage: DraftStorage, userId: string, source: unknown, replaceExisting = false): StoryboardCreateDraft {
  storyboardDraftKey(userId)
  boundedJson(source)
  const validated = validateSource(source)
  let existing: StoryboardCreateDraft | null
  try { existing = readStoryboardDraft(storage, userId) } catch (error) {
    if (!replaceExisting || !(error instanceof StoryboardDraftError) || error.code !== 'CORRUPT') throw error
    existing = null
  }
  if (existing && boundedJson(existing.source) === boundedJson(validated)) return existing
  if (existing && !replaceExisting) throw new StoryboardDraftError('EXISTS', 'Un autre storyboard est déjà conservé dans cet onglet. Confirme son remplacement pour préparer ce nouveau brouillon.')
  const packet: StoryboardCreateDraft = { version: 1, id: crypto.randomUUID(), userId, importCount: 0, source: validated }
  writeDraft(storage, packet)
  return packet
}

export function importStoryboardDraft(storage: DraftStorage, userId: string, expected: StoryboardCreateDraft,
  options: { requestLocked: boolean; hasDraft: boolean; replaceConfirmed: boolean }): { packet: StoryboardCreateDraft; draft: ManualStoryboardDraft } {
  if (options.requestLocked) throw new StoryboardDraftError('LOCKED', 'Une demande est en cours ou son état reste à vérifier. Reprends son suivi avant d’importer.')
  const current = readStoryboardDraft(storage, userId)
  if (!current || boundedJson(current) !== boundedJson(expected)) throw new StoryboardDraftError('CHANGED', 'Le storyboard conservé a changé. Relis le nouveau brouillon avant de l’importer.')
  if ((options.hasDraft || current.importCount > 0) && !options.replaceConfirmed) {
    throw new StoryboardDraftError('CONSENT', 'Confirme le remplacement du brouillon affiché avant d’importer ces descriptions.')
  }
  if (current.importCount >= Number.MAX_SAFE_INTEGER - 1) throw invalid()
  const draft = manualDraftFromStoryboard(current.source)
  const packet = { ...current, importCount: current.importCount + 1 }
  // Persist the import receipt before mutating the form. Never remove the complete original.
  writeDraft(storage, packet)
  return { packet, draft }
}
