import { assembleFinalVideo } from './final-composition'
import { createServiceClient } from '@/lib/supabase'
import { checkpoint, heartbeat, type VideoJob } from '@/lib/video-queue'
import { withPipelineLease, pipelineLog } from '@/lib/pipeline-state'
import { executeProductionStep, persistProductionResult, type ProductionJobInput } from '@/lib/production-pipeline'
import { executeCreateJob, type CreateJobInput } from '@/lib/video-pipeline'
import { executeAutoJob, buildAutoProviders, type AutoJobInput } from '@/lib/auto-pipeline'
import { executeExportJob, persistExportResult, type ExportJobInput } from '@/lib/export-pipeline'
import { type AssembleClip } from '@/lib/shotstack'
import { withMediaOwner } from './private-media'

/** One executor for inline and recovery. Only single-key deltas reach the DB. */
export async function runVideoJob(job: VideoJob, worker: string): Promise<unknown> {
  if (job.status !== 'processing' || job.locked_by !== worker) throw new Error('SUTRA_JOB_LEASE_LOST')
  const input = job.payload.input as ProductionJobInput | CreateJobInput | AutoJobInput | ExportJobInput | undefined
  if (!input || input.userId !== job.user_id) throw new Error('SUTRA_INVALID_JOB_OWNER')
  if (!['production', 'create', 'export', 'auto'].includes(job.kind)) throw new Error('SUTRA_INVALID_JOB_KIND')
  if ((job.kind === 'create' || job.kind === 'export') && (input as CreateJobInput).videoId !== job.video_id) {
    throw new Error('SUTRA_INVALID_JOB_VIDEO')
  }
  // AUTO intentionally has video_id=null; its canonical binding is in payload.
  if (job.kind === 'auto' && !(input as AutoJobInput).videoRowId) {
    throw new Error('SUTRA_INVALID_JOB_VIDEO')
  }
  const steps = { ...((job.progress.steps ?? {}) as Record<string, unknown>) }
  const hooks = {
    heartbeat: () => heartbeat(job.id, worker),
    onStepResolved: (key: string, value: unknown) => checkpoint(job.id, worker, { steps: { [key]: value } }),
  }
  return withMediaOwner(job.user_id, () => withPipelineLease(job.id, worker, async () => {
    await hooks.heartbeat()
    // Written only after the pipeline and all authoritative persistence succeed.
    // The process can stop between this checkpoint and finish_job; reuse it under
    // the new lease instead of replaying providers, publication or business writes.
    if (Object.hasOwn(job.progress, 'result') && job.progress.result !== undefined) return job.progress.result
    const service = createServiceClient()
    let result: unknown
    if (job.kind === 'production') {
      const params = input as ProductionJobInput
      result = await executeProductionStep(params, { steps }, hooks)
      result = await persistProductionResult(job.id, params.step, result, steps, params, service)
      await pipelineLog(job.user_id, 'multi', `production-${params.step}`, 'success')
    } else if (job.kind === 'create') {
      const params = input as CreateJobInput
      result = await executeCreateJob(params, {
        steps, scenes: (job.progress.scenes ?? {}) as Record<string, AssembleClip>,
      }, { ...hooks, onSceneResolved: (index, clip) => checkpoint(job.id, worker, { scenes: { [index]: clip } }) })
    } else if (job.kind === 'export') {
      const params = input as ExportJobInput
      result = await executeExportJob(params, { steps }, hooks, {
        assemble: assembleFinalVideo, persist: (params, update) => persistExportResult(params, update, service),
      })
    } else if (job.kind === 'auto') {
      const params = input as AutoJobInput
      result = await executeAutoJob(params, { steps }, hooks,
        buildAutoProviders(job.user_id, params.videoRowId, params.config, params.userEmail, params.planTier, service))
    } else throw new Error('SUTRA_INVALID_JOB_KIND')
    await checkpoint(job.id, worker, { result })
    return result
  }))
}
