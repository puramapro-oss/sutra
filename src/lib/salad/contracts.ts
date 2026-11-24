// Server/worker contract owned by SUTRA; these are NOT Salad management API routes.
import { createHash } from 'node:crypto'
import { z } from 'zod'

export const PROTOCOL = 'sutra-salad-worker/1' as const
export const MODEL = 'ltxv-13b-0.9.8-distilled-fp8' as const
export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex')
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const label = z.string().regex(/^[A-Za-z0-9_.:-]{1,100}$/)
const dimension = z.number().int().min(256).max(4096).multipleOf(32)
export const profileSchema = z.object({
  width: dimension, height: dimension,
  num_frames: z.number().int().min(9).max(961).refine(n => (n - 1) % 8 === 0),
  fps: z.number().int().min(1).max(60),
}).strict().refine(p => p.num_frames / p.fps <= 60)
export const inputSchema = z.object({
  prompt: z.string().min(1).max(20000).refine(p => p.trim().length > 0),
  profile: profileSchema,
}).strict()
export type VideoInput = z.infer<typeof inputSchema>

// No built-in image, GPU price or VRAM promise. T01 supplies a measured, approved manifest.
export const qualificationSchema = z.object({
  id: label, evidenceSha256: hash, verifiedAt: z.number().int().positive(),
  image: z.string().regex(/^[a-z0-9][a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/),
  architecture: z.literal('linux/amd64'), cuda: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  gpu: z.string().regex(/^[A-Za-z0-9 ._():+-]{1,160}$/), vramMiB: z.number().int().positive(), requiredFreeVramMiB: z.number().int().positive(),
  model: z.literal(MODEL), modelSha256: hash, encoderSha256: hash, vaeSha256: hash,
  profiles: z.array(profileSchema).min(1).max(32),
}).strict().refine(q => q.requiredFreeVramMiB <= q.vramMiB)
export type Qualification = z.infer<typeof qualificationSchema>
export const quoteSchema = z.object({
  currency: z.literal('USD'), hourlyRate: z.number().positive().finite(),
  observedAt: z.number().int().positive(), expiresAt: z.number().int().positive(),
  source: z.literal('salad-approved-quote'), evidenceSha256: hash,
}).strict().refine(q => q.observedAt < q.expiresAt)
export type Quote = z.infer<typeof quoteSchema>
export const capabilitiesSchema = z.object({
  protocol: z.literal(PROTOCOL), provider: z.literal('salad'),
  state: z.enum(['disabled', 'cold', 'ready', 'busy', 'interrupted', 'incompatible']),
  qualification: qualificationSchema.nullable(),
  operations: z.tuple([z.literal('text-to-video')]),
  audio: z.literal(false), native4k: z.literal(false), maxConcurrent: z.literal(1),
  quotaRemaining: z.null(), quote: quoteSchema.nullable(), generationTimeoutMs: z.number().int().positive().nullable(),
}).strict()
export type Capabilities = z.infer<typeof capabilitiesSchema>
export const submissionSchema = z.object({
  id: hash, scope: hash, fingerprint: hash, qualificationId: label,
  input: inputSchema, maxEstimatedComputeUsd: z.number().positive().finite(),
}).strict()
export type Submission = z.infer<typeof submissionSchema>
export const jobSchema = z.object({
  protocol: z.literal(PROTOCOL), id: hash, scope: hash, fingerprint: hash,
  revision: z.number().int().nonnegative(),
  status: z.enum(['submitting', 'running', 'succeeded', 'unknown', 'rejected']),
  submittedAt: z.number().int().positive(), reconcileAfter: z.number().int().positive(),
  provider: z.literal('salad'), model: z.literal(MODEL), qualificationId: label,
  estimatedComputeUsd: z.number().finite().nonnegative(), actualUsd: z.null(),
  costBasis: z.literal('approved-hourly-quote-times-timeout-excludes-idle-storage-network'),
  quoteEvidenceSha256: hash, quotaRemaining: z.null(), timeoutMs: z.number().int().positive(),
  lastHttpStatus: z.number().int().min(100).max(599).nullable(),
  artifact: z.object({ key: hash, sha256: hash, bytes: z.number().int().positive().max(64 * 1024 * 1024) }).strict().nullable(),
}).strict().refine(j => (j.status === 'succeeded') === (j.artifact !== null))
export type Job = z.infer<typeof jobSchema>

export function identity(scope: string, operationId: string, input: VideoInput, qualificationId: string) {
  if (!scope || !operationId || scope.length > 200 || operationId.length > 200) throw new Error('SALAD_INVALID_IDENTITY')
  return {
    id: sha256(JSON.stringify([scope, operationId])), scope: sha256(scope),
    fingerprint: sha256(JSON.stringify([input.prompt, input.profile.width, input.profile.height,
      input.profile.num_frames, input.profile.fps, qualificationId])),
  }
}

/** Two checkpoint namespaces in the EXISTING durable queue, not two queues or memory maps.
 * submission-intent: atomic per-id reservation before the application sends POST.
 * exclusive-execution: reserve ALSO claims a SINGLE global engine slot shared with ALL engines/replicas.
 * Never share the same row between namespaces. The application intent does not claim the GPU slot.
 * Existing id wins even when busy. UNKNOWN retains the execution slot until manual reconciliation.
 * CAS must fence stale owners. Only a verified durable artifact/rejection may release the slot.
 * Store ambiguity must throw; no permissive fallback or TTL auto-release.
 */
export interface DurableJournal {
  readonly kind: 'submission-intent' | 'exclusive-execution'
  load(id: string): Promise<Job | null>
  // Required by an exclusive-execution worker, optional only for submission-intent.
  // Read the permanent global slot from durable storage; missing/broken reads are NOT idle.
  readActive?(): Promise<Job | null>
  reserve(job: Job): Promise<'created' | 'existing' | 'busy'>
  compareAndSet(previous: Job, next: Job): Promise<boolean>
}
export class SaladError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  constructor(readonly code: string, readonly httpStatus: number | null = null) { super(code) }
}
