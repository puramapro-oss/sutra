import type { SunoJobPort, SunoJobState } from '@/lib/suno'
import type { PipelineHooks, pipelineSteps } from '@/lib/pipeline-state'

/** Only a durably acknowledged task identity permits polling an uncertain song.
 * The adapter owns HTTP; this binding owns intent, immutable ID and result. */
export function musicCheckpointed<T>(
  done: Record<string, unknown>, hooks: PipelineHooks, step: ReturnType<typeof pipelineSteps>,
  key: 'music' | 'asset:music', generate: (job: SunoJobPort) => Promise<T>,
): Promise<T> {
  const identityKey = `${key}:suno`
  const value = done[identityKey]
  const valid = (candidate: unknown): candidate is SunoJobState => Boolean(candidate && typeof candidate === 'object'
    && 'taskId' in candidate && typeof candidate.taskId === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(candidate.taskId))
  if (value !== undefined && !valid(value)) return Promise.reject(new Error(`SUTRA_RECONCILIATION_REQUIRED: ${identityKey}`))
  let binding = value === undefined ? null : { taskId: (value as SunoJobState).taskId }
  let acknowledgement: Promise<void> | undefined
  const job: SunoJobPort = {
    current: binding && { ...binding },
    onSubmitted: (state) => {
      if (!valid(state) || (binding && state.taskId !== binding.taskId)) {
        return Promise.reject(new Error(`SUTRA_RECONCILIATION_REQUIRED: ${identityKey} identity changed`))
      }
      if (acknowledgement) return acknowledgement
      // Bind synchronously so concurrent callbacks cannot overwrite each other.
      binding = { taskId: state.taskId }
      const receipt = { ...binding }
      acknowledgement = (async () => {
        await hooks.onStepResolved?.(identityKey, receipt)
        done[identityKey] = receipt
      })()
      return acknowledgement
    },
  }
  return step(key, () => generate(job), true, Boolean(job.current))
}
