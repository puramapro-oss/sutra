// Dedicated external PostgreSQL persistence for the authenticated owner-only worker.
// No environment reads, connection creation, migration, credentials or GPU side effects.
import { jobSchema, sha256, SaladError, type DurableJournal, type Job } from './salad/contracts'
import type { ArtifactStore } from './salad/worker'

export interface SaladDatabase {
  query(sql: string, params: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>
}
const validId = (id: string): void => {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new SaladError('SALAD_INVALID_IDENTITY')
}

/** Configure a dedicated DB login granted ONLY the five salad_worker functions.
 * PostgreSQL is external to the interruptible container. Application credentials
 * and the Supabase service role must never be mounted in that container.
 * This journal shares one permanent slot across every replica using this DB.
 * Other engines must not be hosted on the same GPU outside this worker.
 */
export function createSaladPersistence(database: SaladDatabase): { journal: DurableJournal & { readActive(): Promise<Job | null> }; artifacts: ArtifactStore } {
  async function call(name: string, params: unknown[]): Promise<unknown> {
    try {
      const placeholders = params.map((_, i) => `$${i + 1}`).join(',')
      const result = await database.query(`SELECT salad_worker.${name}(${placeholders}) AS value`, params)
      if (result.rows.length !== 1 || !Object.hasOwn(result.rows[0], 'value')) throw new Error('missing receipt')
      return result.rows[0].value
    } catch { throw new SaladError('SALAD_PERSISTENCE_UNCERTAIN') }
  }
  const journal: DurableJournal & { readActive(): Promise<Job | null> } = {
    kind: 'exclusive-execution',
    async readActive() {
      const row = await call('load_job', [null])
      if (row === null) return null
      const result = jobSchema.safeParse(row)
      if (!result.success || !['running', 'unknown'].includes(result.data.status)) throw new SaladError('SALAD_INVALID_CHECKPOINT')
      return result.data
    },
    async load(id) {
      validId(id)
      const row = await call('load_job', [id])
      if (row === null) return null
      const result = jobSchema.safeParse(row)
      if (!result.success || result.data.id !== id) throw new SaladError('SALAD_INVALID_CHECKPOINT')
      return result.data
    },
    async reserve(value) {
      const job = jobSchema.parse(value)
      if (job.status !== 'running' || job.revision !== 0) throw new SaladError('SALAD_INVALID_CHECKPOINT')
      const result = await call('reserve_job', [JSON.stringify(job)])
      if (!['created', 'existing', 'busy'].includes(String(result))) throw new SaladError('SALAD_PERSISTENCE_UNCERTAIN')
      return result as 'created' | 'existing' | 'busy'
    },
    async compareAndSet(previous: Job, next: Job) {
      const before = jobSchema.parse(previous), after = jobSchema.parse(next)
      if (before.id !== after.id || after.revision !== before.revision + 1) throw new SaladError('SALAD_INVALID_CHECKPOINT')
      const result = await call('compare_job', [JSON.stringify(before), JSON.stringify(after)])
      if (typeof result !== 'boolean') throw new SaladError('SALAD_PERSISTENCE_UNCERTAIN')
      return result
    },
  }
  const artifacts: ArtifactStore = {
    async put(id, bytes, digest) {
      validId(id)
      if (!bytes.length || bytes.length > 64 * 1024 * 1024 || sha256(bytes) !== digest) throw new SaladError('SALAD_INVALID_ARTIFACT')
      if (await call('put_artifact', [id, Buffer.from(bytes), digest]) !== true) throw new SaladError('SALAD_PERSISTENCE_UNCERTAIN')
    },
    async get(id) {
      validId(id)
      const result = await call('get_artifact', [id])
      if (result === null) return null
      if (!(result instanceof Uint8Array) || !result.length || result.length > 64 * 1024 * 1024) throw new SaladError('SALAD_INVALID_ARTIFACT')
      return result
    },
  }
  return { journal, artifacts }
}
