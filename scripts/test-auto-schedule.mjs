// Network-free regression tests for timezone-aware autonomous scheduling.
// Requires Node 24. Run: node scripts/test-auto-schedule.mjs
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

let source = readFileSync(new URL('../src/lib/sutra-auto-utils.ts', import.meta.url), 'utf8')
source = stripTypeScriptTypes(source)
const { computeNextRun, autoOccurrences } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

const base = {
  id: 'schedule',
  name: 'Schedule',
  is_active: true,
  frequency: 'daily',
  days: ['MO'],
  time: '10:00',
  timezone: 'Europe/Paris',
}

const cases = [
  ['summer offset', base, '2026-10-06T00:00:00Z', '2026-10-06T08:00:00.000Z'],
  ['winter offset', base, '2026-11-02T00:00:00Z', '2026-11-02T09:00:00.000Z'],
  ['weekly selected day', { ...base, frequency: 'weekly', days: ['WE'] }, '2026-10-06T12:00:00Z', '2026-10-07T08:00:00.000Z'],
  ['biweekly stable cadence', { ...base, frequency: 'biweekly' }, '2026-10-06T12:00:00Z', '2026-10-12T08:00:00.000Z'],
  ['monthly first selected weekday', { ...base, frequency: 'monthly' }, '2026-10-06T12:00:00Z', '2026-11-02T09:00:00.000Z'],
  ['DST spring gap advances', { ...base, time: '02:30' }, '2027-03-27T23:00:00Z', '2027-03-28T01:00:00.000Z'],
]

for (const [name, schedule, from, expected] of cases) {
  assert.equal(computeNextRun(schedule, new Date(from))?.toISOString(), expected, name)
}
assert.equal(computeNextRun({ ...base, timezone: 'Invalid/Zone' }, new Date()), null)
assert.equal(computeNextRun({ ...base, time: '25:00' }, new Date()), null)
assert.equal(computeNextRun({ ...base, is_active: false }, new Date()), null)
console.error('PASS: timezone, DST, weekly, monthly and invalid schedule cases')

for (const time of ['9:00', '10:00:59', '10:00junk', '', null, 1000]) {
  assert.equal(computeNextRun({ ...base, time }, new Date('2026-10-06T00:00:00Z')), null)
}
const fold = { ...base, time: '02:30' }
const fall = autoOccurrences([fold, { ...fold }], new Date('2026-10-24T23:00:00Z'), new Date('2026-10-25T04:00:00Z'))
assert.deepEqual(fall.map(o => o.at.toISOString()), ['2026-10-25T01:30:00.000Z'], 'PR2 fold policy and identity dedup')
assert.equal(computeNextRun({ ...base, timezone: 'Australia/Lord_Howe', time: '02:15' }, new Date('2026-10-03T12:00:00Z'))?.toISOString(), '2026-10-03T15:30:00.000Z', 'half hour DST gap')
assert.equal(computeNextRun({ ...base, timezone: 'Pacific/Kiritimati', time: '00:15' }, new Date('2026-12-31T10:20:00Z'))?.toISOString(), '2027-01-01T10:15:00.000Z', 'IANA date line and new year')
const boundary = new Date('2026-10-06T08:00:00Z')
assert.equal(autoOccurrences([base], new Date(boundary.getTime() - 1), boundary).length, 1)
assert.equal(autoOccurrences([base], boundary, new Date(boundary.getTime() + 1000)).length, 0, 'exclusive start, inclusive end')
const independent = autoOccurrences([base, { ...base, id: 'second' }], new Date(boundary.getTime() - 1), boundary)
assert.equal(independent.length, 2, 'same timestamp is distinct for different schedules')
assert.throws(() => autoOccurrences([base, { ...base, time: '11:00' }], boundary, boundary), /Conflicting schedule/)
assert.throws(() => autoOccurrences([{ ...base, id: '' }], boundary, boundary), /Missing schedule/)
assert.throws(() => autoOccurrences([base], boundary, new Date(boundary.getTime() + 86400001)), /window too large/)
assert.throws(() => autoOccurrences([base], new Date('invalid'), boundary), /Invalid scheduling/)
console.error('PASS: T06 folds, half-hour gap, date line, strict input, occurrence boundaries and conflicting identities')
