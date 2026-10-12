import { assembleFinalVideo } from './final-composition'
import { createServiceClient } from '@/lib/supabase'
import { checkpoint, heartbeat, type VideoJob } from '@/lib/video-queue'
import { withPipelineLease, pipelineLog } from '@/lib/pipeline-state'
import { executeProductionStep, persistProductionResult, type ProductionJobInput } from '@/lib/production-pipeline'
import { executeCreateJob, type CreateJobInput } from '@/lib/video-pipeline'
import { executeAutoJob, buildAutoProviders, type AutoJobInput } from '@/lib/auto-pipeline'
import { executeExportJob, persistExportResult, type ExportJobInput } from '@/lib/export-pipeline'
import { type AssembleClip } from '@/lib/shotstack'

/** One executor for inline and recovery. Only single-key deltas reach the DB. */
export async function runVideoJob(job: VideoJob, worker: string): Promise<unknown> {
  if (job.status !== 'processing' || job.locked_by !== worker) throw new Error('SUTRA_JOB_LEASE_LOST')
  const input = job.payload.input as ProductionJobInput | CreateJobInput | AutoJobInput | ExportJobInput | undefined
  if (!input || input.userId !== job.user_id) throw new Error('SUTRA_INVALID_JOB_OWNER')
  const steps = { ...((job.progress.steps ?? {}) as Record<string, unknown>) }
  const hooks = {
    heartbeat: () => heartbeat(job.id, worker),
    onStepResolved: (key: string, value: unknown) => checkpoint(job.id, worker, { steps: { [key]: value } }),
  }
  return withPipelineLease(job.id, worker, async () => {
    await hooks.heartbeat()
    const service = createServiceClient()
    let result: unknown
    if (job.kind === 'production') {
      const params = input as ProductionJobInput
      result = await executeProductionStep(params, { steps }, hooks)
      result = await persistProductionResult(job.id, params.step, result, steps, params, service)
      await pipelineLog(job.user_id, 'multi', `production-${params.step}`, 'success')
    } else if (job.kind === 'create') {
      const params = input as CreateJobInput
      if (params.videoId !== job.video_id) throw new Error('SUTRA_INVALID_JOB_VIDEO')
      result = await executeCreateJob(params, {
        steps, scenes: (job.progress.scenes ?? {}) as Record<string, AssembleClip>,
      }, { ...hooks, onSceneResolved: (index, clip) => checkpoint(job.id, worker, { scenes: { [index]: clip } }) })
    } else if (job.kind === 'export') {
      const params = input as ExportJobInput
      if (params.videoId !== job.video_id) throw new Error('SUTRA_INVALID_JOB_VIDEO')
      result = await executeExportJob(params, { steps }, hooks, {
        assemble: assembleFinalVideo, persist: (params, update) => persistExportResult(params, update, service),
      })
    } else if (job.kind === 'auto') {
      const params = input as AutoJobInput
      if (!params.videoRowId) throw new Error('SUTRA_INVALID_JOB_VIDEO')
      result = await executeAutoJob(params, { steps }, hooks,
        buildAutoProviders(job.user_id, params.videoRowId, params.config, params.userEmail, params.planTier, service))
    } else throw new Error('SUTRA_INVALID_JOB_KIND')
    await checkpoint(job.id, worker, { result })
    return result
  })
}
