import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { startWire } from '../t07-final-wire-20261016/wire.mjs'
const wire = await startWire({ id: '7a300000-0000-4000-8000-000000000020', email: 't03@fixture.invalid' })
try {
  await wire.sql(`UPDATE sutra_auto_config SET is_active=true, auto_publish=false,
    schedules='[{"id":"gap","is_active":true,"frequency":"daily","time":"12:00","timezone":"UTC","days":[]}]'`)
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T00:00:00Z') })
  assert.equal((await (await wire.tick()).json()).status, 'ok')
  mock.timers.setTime(new Date('2026-11-06T20:00:00Z').getTime())
  assert.equal((await (await wire.tick()).json()).status, 'ok')
  assert.equal((await wire.sql('SELECT count(*)::int AS n FROM video_jobs')).rows[0].n, 1,
    'R107: noon occurrence must survive a 20-hour scheduler interruption')
} finally { mock.timers.reset(); await wire.close(process.env.T03_PROOF_DIR) }
