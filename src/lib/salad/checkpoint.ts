import type { LtxJobPersistence } from '../ltx-workflow'
import { SaladError, jobSchema, type DurableJournal, type Job } from './contracts'

const pending = new WeakMap<object, Promise<unknown>>()

/** Application submission intent in the existing lease-fenced video checkpoint.
 * This is NOT the remote/global engine execution claim. No memory persistence.
 * The promise map serializes wrappers in one worker; the existing RPC fences leases.
 */
export function saladCheckpoint(checkpoint: LtxJobPersistence): DurableJournal {
  const scope = checkpoint.serializationKey ?? checkpoint
  function current(id: string): Job | null {
    const state = checkpoint.current
    if (!state) return null
    if (!state.salad || state.v2 || state.endpoint !== '/salad/jobs' || state.id !== id
      || state.fingerprint !== state.salad.fingerprint) throw new SaladError('SALAD_CHECKPOINT_PROVIDER_CONFLICT')
    const job = jobSchema.safeParse(state.salad)
    if (!job.success || job.data.id !== id) throw new SaladError('SALAD_INVALID_CHECKPOINT')
    return job.data
  }
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const task = (pending.get(scope) ?? Promise.resolve()).then(operation)
    pending.set(scope, task.catch(() => {}))
    return task
  }
  async function persist(job: Job) {
    const state = { endpoint: '/salad/jobs', started: true as const, id: job.id,
      fingerprint: job.fingerprint, salad: jobSchema.parse(job) }
    // Await durable acknowledgment before setting in-process state or submitting.
    await checkpoint.save(state)
    checkpoint.current = state
  }
  return {
    kind: 'submission-intent',
    async load(id) { return current(id) },
    reserve(job) {
      return serialize(async () => {
        if (current(job.id)) return 'existing' as const
        await persist(job)
        return 'created' as const
      })
    },
    compareAndSet(previous, next) {
      return serialize(async () => {
        const stored = current(previous.id)
        if (!stored || stored.revision !== previous.revision || stored.fingerprint !== previous.fingerprint
          || next.id !== previous.id || next.scope !== previous.scope || next.fingerprint !== previous.fingerprint
          || next.revision !== previous.revision + 1) return false
        await persist(next)
        return true
      })
    },
  }
}
