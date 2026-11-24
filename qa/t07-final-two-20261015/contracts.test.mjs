import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
const load = async path => import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(await readFile(path, 'utf8'))).toString('base64'))
const { scheduleValidation, schedulesFromResponse, reconcileScheduleChange } = await load('src/lib/auto-schedule-client.ts')
const { computeNextRun, autoOccurrences } = await load('src/lib/sutra-auto-utils.ts')
const base = { id: 'schedule-1', name: 'Fixture', is_active: true, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris', theme_ids: ['preserve'] }
test('valid IANA zones, strict time and nonempty selected weekdays', () => {
  for (const timezone of ['Europe/Paris', 'America/New_York', 'Asia/Kolkata', 'Australia/Lord_Howe', 'UTC']) assert.equal(scheduleValidation({ ...base, timezone }), null)
  for (const invalid of [{ timezone: 'Paris' }, { timezone: '+02:00' }, { timezone: 'Mars/Test' }, { time: '24:00' }, { time: '8:2' }, { days: [] }, { days: ['XX'] }, { frequency: 'other' }, { name: ' ' }]) assert.ok(scheduleValidation({ ...base, ...invalid }))
  assert.equal(scheduleValidation({ ...base, frequency: 'daily', days: [] }), null)
})
test('malformed or duplicate remote schedule must not become empty or editable', () => {
  for (const body of [{}, { config: {} }, { config: { schedules: [null] } }, { config: { schedules: [base, base] } }, { config: { schedules: [{ ...base, is_active: 'false' }] } }, { config: { schedules: [{ ...base, timezone: 'bad' }] } }]) assert.throws(() => schedulesFromResponse(body))
  assert.deepEqual(schedulesFromResponse({ config: { schedules: [] } }), [])
})
test('lost acknowledgement reconciles create, pause and delete without replay', () => {
  for (const change of [{ before: null, after: base }, { before: base, after: { ...base, is_active: false } }, { before: base, after: null }]) {
    const current = change.after ? [change.after] : []
    assert.equal(reconcileScheduleChange(current, change).applied, true)
  }
})
test('fresh changes preserve unrelated schedules and opaque theme fields', () => {
  const other = { ...base, id: 'remote-new', name: 'Added elsewhere' }
  const next = reconcileScheduleChange([base, other], { before: base, after: { ...base, timezone: 'Asia/Kolkata' } })
  assert.equal(next.applied, false)
  assert.deepEqual(next.schedules[0].theme_ids, ['preserve'])
  assert.deepEqual(next.schedules[1], other)
})
test('same identity modified remotely fails closed, missing existing item is not recreated', () => {
  assert.throws(() => reconcileScheduleChange([{ ...base, time: '11:00' }], { before: base, after: { ...base, time: '12:00' } }), /schedule_conflict/)
  assert.throws(() => reconcileScheduleChange([], { before: base, after: { ...base, time: '12:00' } }), /schedule_conflict/)
})
test('four UI frequencies retain canonical motor semantics across restart', () => {
  const from = new Date('2026-10-06T12:00:00Z')
  for (const [frequency, expected] of [['daily', '2026-10-07T08:00:00.000Z'], ['weekly', '2026-10-12T08:00:00.000Z'], ['biweekly', '2026-10-12T08:00:00.000Z'], ['monthly', '2026-11-02T09:00:00.000Z']]) {
    const schedule = { ...base, frequency }
    assert.equal(computeNextRun(schedule, from).toISOString(), expected)
    assert.equal(computeNextRun(JSON.parse(JSON.stringify(schedule)), from).toISOString(), expected)
  }
})
test('UI timezone round trip preserves spring gap, fall fold and unique occurrences', () => {
  const s = { ...base, frequency: 'daily', time: '02:30' }
  for (const [from, through, expected] of [['2027-03-28T00:00:00Z', '2027-03-28T04:00:00Z', '2027-03-28T01:00:00.000Z'], ['2026-10-25T00:00:00Z', '2026-10-25T04:00:00Z', '2026-10-25T01:30:00.000Z']]) {
    const restored = schedulesFromResponse({ config: { schedules: [JSON.parse(JSON.stringify(s))] } })
    const occurrences = autoOccurrences([...restored, ...restored], new Date(from), new Date(through))
    assert.deepEqual(occurrences.map(o => o.at.toISOString()), [expected])
  }
})
test('pause preserves definition and suppresses next uncreated occurrences only', () => {
  const paused = reconcileScheduleChange([base], { before: base, after: { ...base, is_active: false } }).schedules
  assert.deepEqual(autoOccurrences(paused, new Date('2026-10-12T00:00:00Z'), new Date('2026-10-12T23:00:00Z')), [])
  assert.deepEqual(paused[0].theme_ids, base.theme_ids)
})
