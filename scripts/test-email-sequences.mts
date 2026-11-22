import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Exercise the real cron handler. Only database and provider boundaries are synthetic.
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
type Row = Record<string, unknown>
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number | null }
const userId = '11111111-1111-4111-8111-111111111111'
const reservationId = '22222222-2222-4222-8222-222222222222'
let profiles: Row[], journal: Row[], sends: Row[], operations: string[]
let provider: 'ok' | 'error' | 'missing' | 'throw' | 'hold', failure: string, revokeOnClaim: boolean
let releaseProvider: (() => void) | undefined
let userReads: number, revokeAfterList: boolean
let reservationCount: number, historyReads: number
let historyBudget: { limit: number; controller: AbortController } | undefined
let malformedCandidates: boolean
const sequencePreferences: Record<string, string> = {
  welcome: 'welcome', tip_day1: 'tips', reminder_day3: 'inactivity', tips_day7: 'tips',
  upgrade_day14: 'tips', testimonial_day21: 'tips', winback_day30: 'inactivity',
}

class Query implements PromiseLike<Result> {
  filters: Array<[string, string, unknown]> = []
  action = 'select'; payload: Row = {}; one = false; max = Infinity
  head = false; countRequested = false; signal?: AbortSignal; orderBy?: string
  constructor(private table: string) {}
  select(_columns?: string, options?: { head?: boolean; count?: string }) {
    this.head = options?.head === true; this.countRequested = options?.count === 'exact'; return this
  }
  insert(row: Row) { this.action = 'insert'; this.payload = row; return this }
  update(row: Row) { this.action = 'update'; this.payload = row; return this }
  eq(key: string, value: unknown) { this.filters.push(['eq', key, value]); return this }
  is(key: string, value: unknown) { this.filters.push(['eq', key, value]); return this }
  gt(key: string, value: unknown) { this.filters.push(['gt', key, value]); return this }
  gte(key: string, value: unknown) { this.filters.push(['gte', key, value]); return this }
  lt(key: string, value: unknown) { this.filters.push(['lt', key, value]); return this }
  in(key: string, value: unknown[]) { this.filters.push(['in', key, value]); return this }
  order(column: string) { this.orderBy = column; return this }
  limit(value: number) { this.max = value; return this }
  single() { this.one = true; return this }
  maybeSingle() { this.one = true; return this }
  abortSignal(signal: AbortSignal) { this.signal = signal; return this }
  result(): Result {
    const operation = `${this.table}:${this.action}${this.one ? ':one' : this.head ? ':count' : ''}`
    operations.push(operation)
    if (this.signal?.aborted) return { data: null, error: { message: 'aborted' } }
    if (failure === operation) return { data: null, error: { message: 'private database diagnostic' } }
    let rows = this.table === 'profiles' ? profiles : journal
    if (this.table === 'profiles') {
      userReads++
      if (this.one && revokeAfterList) profiles[0].email_preferences = { welcome: false }
    }
    const matched = rows.filter(row => this.filters.every(([op, key, value]) => {
      if (op === 'eq') return row[key] === value
      if (op === 'gt') return String(row[key]) > String(value)
      if (op === 'gte') return String(row[key]) >= String(value)
      if (op === 'in') return (value as unknown[]).includes(row[key])
      return String(row[key]) < String(value)
    }))
    if (this.orderBy) matched.sort((a, b) => String(a[this.orderBy!]).localeCompare(String(b[this.orderBy!])))
    if (this.table === 'email_sequences' && this.action === 'select' && this.one) {
      historyReads++
      if (historyBudget && historyReads >= historyBudget.limit) historyBudget.controller.abort()
    }
    if (this.action === 'insert') {
      if (journal.some(row => row.user_id === this.payload.user_id && row.email_type === this.payload.email_type)) {
        return { data: null, error: { code: '23505', message: 'unique sequence constraint' } }
      }
      const id = reservationCount++ === 0 ? reservationId : `22222222-2222-4222-8222-${String(reservationCount).padStart(12, '0')}`
      const row = { id, sent_at: new Date().toISOString(), ...this.payload }
      journal.push(row); rows = [row]
      if (revokeOnClaim) profiles[0].email_preferences = { welcome: false }
    } else if (this.action === 'update') {
      for (const row of matched) Object.assign(row, this.payload)
      rows = matched
    } else rows = matched.slice(0, this.max)
    return { data: this.head ? null : this.one ? rows[0] ?? null : structuredClone(rows), error: null,
      ...(this.countRequested ? { count: matched.length } : {}) }
  }
  then<T = Result, E = never>(resolve?: ((value: Result) => T | PromiseLike<T>) | null, reject?: ((reason: unknown) => E | PromiseLike<E>) | null): Promise<T | E> {
    return Promise.resolve(this.result()).then(resolve, reject)
  }
}

class Candidates implements PromiseLike<Result> {
  signal?: AbortSignal
  constructor(private args: Row) {}
  abortSignal(signal: AbortSignal) { this.signal = signal; return this }
  then<T = Result, E = never>(resolve?: ((value: Result) => T | PromiseLike<T>) | null, reject?: ((reason: unknown) => E | PromiseLike<E>) | null): Promise<T | E> {
    const operation = 'rpc:email_sequence_candidates'
    operations.push(operation); userReads++
    let result: Result
    if (this.signal?.aborted || failure === operation) result = { data: null, error: { message: 'private database diagnostic' } }
    else {
      const { p_email_type: type, p_start: start, p_end: end, p_after: after, p_limit: limit } = this.args
      const preference = sequencePreferences[String(type)]
      const candidates = profiles.filter(row => String(row.created_at) >= String(start) && String(row.created_at) < String(end)
        && (!after || String(row.id) > String(after)) && !row.access_revoked_at && row.subscription_status !== 'banned'
        && (row.email_preferences as Row | undefined)?.[preference] === true
        && typeof row.email === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.email) && row.email.length <= 320
        && !journal.some(item => item.user_id === row.id && item.email_type === type))
        .sort((a, b) => String(a.id).localeCompare(String(b.id))).slice(0, Number(limit))
      result = { data: malformedCandidates ? [...candidates, ...candidates] : structuredClone(candidates), error: null }
    }
    return Promise.resolve(result).then(resolve, reject)
  }
}

mock.module('../src/lib/supabase.ts', { namedExports: {
  createServiceClient: () => ({ from: (table: string) => new Query(table), rpc: (name: string, args: Row) => {
    assert.equal(name, 'email_sequence_candidates'); return new Candidates(args)
  } }),
} })
mock.module('resend', { namedExports: { Resend: class {
  emails = { send: async (payload: Row, options?: Row) => {
    sends.push({ ...payload, options });
    if (provider === 'hold') await new Promise<void>(resolve => { releaseProvider = resolve })
    if (provider === 'throw') throw new Error('private provider diagnostic')
    if (provider === 'error') return { data: null, error: { name: 'rate_limit_exceeded', message: 'private provider diagnostic' } }
    if (provider === 'missing') return { data: {}, error: null }
    return { data: { id: '33333333-3333-4333-8333-333333333333' }, error: null }
  } }
} } })
const { GET } = await import('../src/app/api/cron/email-sequences/route.ts')
const request = () => new Request('https://sutra.example.invalid/api/cron/email-sequences', {
  headers: { authorization: 'Bearer synthetic-sequence-test-secret' },
})
beforeEach(() => {
  process.env.CRON_SECRET = 'synthetic-sequence-test-secret'
  process.env.RESEND_API_KEY = 're_synthetic_not_a_real_key'
  profiles = [{ id: userId, email: 'fixture@example.invalid', name: 'Createur', created_at: new Date().toISOString(),
    email_preferences: { welcome: true, tips: true, inactivity: true }, subscription_status: 'active', access_revoked_at: null }]
  journal = []; sends = []; operations = []; provider = 'ok'; failure = ''; revokeOnClaim = false; userReads = 0; revokeAfterList = false; releaseProvider = undefined
  reservationCount = 0; historyReads = 0; historyBudget = undefined; malformedCandidates = false
})

test('unauthenticated cron cannot inspect recipients or send', async () => {
  const response = await GET(new Request('https://sutra.example.invalid/api/cron/email-sequences'))
  assert.equal(response.status, 401); assert.equal(operations.length, 0); assert.equal(sends.length, 0)
})

test('a disabled preference is respected before any provider call', async () => {
  profiles[0].email_preferences = { welcome: false }
  const response = await GET(request())
  assert.equal(response.status, 200); assert.equal(sends.length, 0); assert.equal(journal.length, 0)
})

test('unknown preferences do not authorize a sequence', async () => {
  delete profiles[0].email_preferences
  await GET(request()); assert.equal(sends.length, 0)
})

for (const mode of ['error', 'missing', 'throw'] as const) {
  test(`provider ${mode} never becomes a confirmed email or a retryable fresh intent`, async () => {
    provider = mode
    const response = await GET(request()); const body = await response.json()
    assert.equal(body.emailsSent, 0); assert.equal(response.status, 503)
    assert.equal(journal.length, 1); assert.equal(journal[0].sent_at, null)
    provider = 'ok'; await GET(request()); assert.equal(sends.length, 1, 'uncertain transport must not be resubmitted')
    assert.doesNotMatch(JSON.stringify(body), /private .* diagnostic/)
  })
}

test('missing transport configuration is reported without consuming the reservation', async () => {
  delete process.env.RESEND_API_KEY
  assert.equal((await GET(request())).status, 503); assert.equal(journal.length, 0); assert.equal(sends.length, 0)
})

test('concurrent cron invocations submit one provider request per unique sequence', async () => {
  await Promise.all([GET(request()), GET(request()), GET(request())])
  assert.equal(sends.length, 1); assert.equal(journal.length, 1)
  assert.ok(typeof journal[0].sent_at === 'string')
  assert.deepEqual(sends[0].options, { idempotencyKey: `sutra-sequence/${reservationId}` })
})

test('the preference is refreshed after candidate selection', async () => {
  revokeAfterList = true
  await GET(request()); assert.equal(sends.length, 0); assert.ok(userReads > 1)
})

test('revocation while reserving stops transport and conserves the unresolved reservation', async () => {
  revokeOnClaim = true
  await GET(request()); assert.equal(sends.length, 0); assert.equal(journal.length, 1); assert.equal(journal[0].sent_at, null)
})

test('an existing historical receipt is conserved without resending', async () => {
  const sent = new Date(Date.now() - 5000).toISOString()
  journal = [{ id: reservationId, user_id: userId, email_type: 'welcome', sent_at: sent }]
  const response = await GET(request()); assert.equal(response.status, 200)
  assert.equal(sends.length, 0); assert.equal(journal[0].sent_at, sent)
})

test('an unresolved reservation remains visible and cannot expire into a duplicate send', async () => {
  journal = [{ id: reservationId, user_id: userId, email_type: 'welcome', sent_at: null }]
  const response = await GET(request()); const body = await response.json()
  assert.equal(response.status, 503); assert.equal(body.needsReconciliation, 1); assert.equal(sends.length, 0)
})

for (const operation of ['rpc:email_sequence_candidates', 'email_sequences:select:count', 'profiles:select:one', 'email_sequences:select:one', 'email_sequences:insert:one', 'email_sequences:update:one']) {
  test(`${operation} failure is explicit and cannot manufacture a receipt`, async () => {
    failure = operation
    const response = await GET(request()); const body = await response.json()
    assert.equal(response.status, 503); assert.equal(body.emailsSent ?? 0, 0)
    assert.equal(sends.length, operation === 'email_sequences:update:one' ? 1 : 0)
    assert.doesNotMatch(JSON.stringify(body), /private database diagnostic/)
  })
}

test('banned and revoked accounts cannot enter a sequence', async () => {
  profiles[0].subscription_status = 'banned'; await GET(request()); assert.equal(sends.length, 0)
  profiles[0].subscription_status = 'active'; profiles[0].access_revoked_at = new Date().toISOString()
  await GET(request()); assert.equal(sends.length, 0)
})

test('a displayed name is escaped and successful receipt is written only after provider acceptance', async () => {
  profiles[0].name = '<img src=x onerror=alert(1)> & "friend"'
  const response = await GET(request()); const body = await response.json()
  assert.equal(response.status, 200); assert.equal(body.emailsSent, 1)
  assert.match(String(sends[0].html), /&lt;img/); assert.doesNotMatch(String(sends[0].html), /<img/)
  assert.match(String(sends[0].html), /settings\/notifications/)
  assert.equal(journal.length, 1); assert.ok(typeof journal[0].sent_at === 'string')
})

test('interrupted provider observation settles and a late response never releases the uncertain intent', async () => {
  provider = 'hold'
  const controller = new AbortController()
  const response = GET(new Request(request(), { signal: controller.signal }))
  while (!releaseProvider) await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  const received = await response; const body = await received.json()
  assert.equal(received.status, 503); assert.equal(body.emailsSent, 0); assert.equal(body.needsReconciliation, 1)
  assert.equal(body.incomplete, true); assert.equal(journal[0].sent_at, null)
  releaseProvider(); await new Promise(resolve => setImmediate(resolve))
  assert.equal(journal[0].sent_at, null)
  provider = 'ok'; await GET(request()); assert.equal(sends.length, 1)
})

test('a historical prefix cannot consume every retry before fresh recipients are reached', async () => {
  const template = profiles[0]
  profiles = Array.from({ length: 201 }, (_, index) => ({ ...template,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    email: `fixture-${index + 1}@example.invalid`,
  }))
  journal = profiles.slice(0, 100).map((row, index) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`,
    user_id: row.id, email_type: 'welcome', sent_at: new Date().toISOString(),
  }))
  const originals = structuredClone(journal)
  const outcomes: Row[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController(); historyReads = 0
    historyBudget = { limit: 80, controller }
    const response = await GET(new Request(request(), { signal: controller.signal }))
    outcomes.push(await response.json())
  }
  assert.equal(outcomes[0].incomplete, true, 'the first attempt really exhausts its synthetic budget')
  assert.equal(outcomes[1].incomplete, false, 'the next attempt advances past completed recipients')
  assert.equal(sends.length, 101)
  assert.equal(new Set(sends.map(row => row.to)).size, 101)
  assert.equal(new Set(sends.map(row => (row.options as Row).idempotencyKey)).size, 101)
  assert.equal(journal.length, 201)
  assert.deepEqual(journal.slice(0, 100), originals, 'accepted history is untouched')
})

test('keyset pagination covers more than one full candidate page without repeating admissions', async () => {
  const template = profiles[0]
  profiles = Array.from({ length: 205 }, (_, index) => ({ ...template,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    email: `fixture-${index + 1}@example.invalid`,
  })).reverse()
  const response = await GET(request()); const body = await response.json()
  assert.equal(response.status, 200); assert.equal(body.emailsSent, 205)
  assert.equal(new Set(sends.map(row => row.to)).size, 205)
  assert.equal(journal.length, 205)
})

test('pending intents remain counted outside the current campaign window and after opt-out', async () => {
  profiles[0].created_at = '2020-01-01T00:00:00.000Z'
  profiles[0].email_preferences = { welcome: false }
  profiles[0].access_revoked_at = new Date().toISOString()
  journal = [{ id: reservationId, user_id: userId, email_type: 'welcome', sent_at: null }]
  const response = await GET(request()); const body = await response.json()
  assert.equal(response.status, 503); assert.equal(body.needsReconciliation, 1)
  assert.equal(body.reconciliationComplete, true); assert.equal(sends.length, 0)
})

test('an untrusted duplicate candidate page is rejected before admitting any recipient', async () => {
  malformedCandidates = true
  const response = await GET(request()); const body = await response.json()
  assert.equal(response.status, 503); assert.ok(body.errors > 0)
  assert.equal(sends.length, 0); assert.equal(journal.length, 0)
})
