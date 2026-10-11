// Network-free regression tests for timezone-aware autonomous scheduling.
// Requires Node 24. Run: node scripts/test-auto-schedule.mjs
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'

let source = readFileSync(new URL('../src/lib/sutra-auto-utils.ts', import.meta.url), 'utf8')
source = stripTypeScriptTypes(source)
const { computeNextRun } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

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
console.log('PASS: timezone, DST, weekly, monthly and invalid schedule cases')
