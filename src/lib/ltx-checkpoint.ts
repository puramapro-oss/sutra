import type { LtxExecution } from './ltx-v2'
import type { LtxJobPersistence } from './ltx-workflow'
export type { LtxJobPersistence } from './ltx-workflow'
export { resumeLegacyLtx } from './ltx-workflow'

const executions = new WeakMap<LtxJobPersistence, LtxExecution>()

/** T03 persists each CAS through its lease-fenced checkpoint RPC before any POST.
 * A slot belongs to exactly one scene; the workflow lease excludes other workers.
 * Serialization also excludes overlapping calls within the same worker. */
export function executionForCheckpoint(journal: LtxJobPersistence): LtxExecution {
  const existing = executions.get(journal)
  if (existing) return existing
  let pending: Promise<unknown> = Promise.resolve()
  const execution: LtxExecution = {
    operationKey: 'scene-ltx-v2',
    store: {
      load: async () => journal.current?.v2 ?? null,
      compareAndSet(key, revision, next) {
        const operation = pending.then(async () => {
          const previous = journal.current?.v2
          if (journal.current && !previous) return false
          if (revision === null ? Boolean(previous) : previous?.revision !== revision) return false
          if (next.key !== key) return false
          const state = { endpoint: `/${next.endpoint}`, fingerprint: next.fingerprint,
            started: true as const, id: next.id ?? undefined, v2: next,
            status: ['pending', 'processing', 'completed', 'failed'].includes(next.remoteStatus)
              ? next.remoteStatus as 'pending' | 'processing' | 'completed' | 'failed' : undefined }
          await journal.save(state)
          journal.current = state
          return true
        })
        pending = operation.catch(() => {})
        return operation
      },
    },
  }
  executions.set(journal, execution)
  return execution
}
