/** Additional cross-user checks on the disposable canonical T03 migration fixture.
 * The auth.uid claim function and owner policy are fixture adapters, not live RLS proof.
 */
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
const pool = new pg.Pool({
  host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture',
  database: 't03_scheduler', options: '-c search_path=sutra,public',
})
const users = [randomUUID(), randomUUID()]
const sql = (text: string, args: unknown[] = []) => pool.query(text, args)
const asRole = async (role: 'authenticated' | 'anon' | 'service_role', user: string | null,
  check: (client: pg.PoolClient) => Promise<void>) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user ?? ''])
    await check(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}
before(async () => {
  for (const user of users) {
    await sql('INSERT INTO auth.users VALUES($1);', [user])
    await sql('INSERT INTO profiles VALUES($1)', [user])
    await sql('INSERT INTO sutra_auto_config(user_id,is_active,schedules) VALUES($1,true,$2)', [
      user, JSON.stringify([{ id: 'noon', is_active: true, name: 'fixture', frequency: 'daily',
        time: '12:00', timezone: 'UTC', days: [] }]),
    ])
    await sql("UPDATE sutra_auto_config SET scheduler_cursor='2026-11-06T00:00:00Z' WHERE user_id=$1", [user])
  }
})
after(async () => {
  assert.equal((await sql('SELECT count(*)::int n FROM video_jobs WHERE user_id=ANY($1::uuid[])', [users])).rows[0].n, 0)
  assert.equal((await sql('SELECT coalesce(sum(reserved),0)::int n FROM video_quota_counters WHERE user_id=ANY($1::uuid[])', [users])).rows[0].n, 0)
  await pool.end()
})

test('both authenticated users can read/update their own schedule but cannot see or update each other', async () => {
  for (const user of users) await asRole('authenticated', user, async client => {
    const rows = (await client.query('SELECT user_id FROM sutra_auto_config')).rows
    assert.deepEqual(rows.map(row => row.user_id), [user])
    assert.equal((await client.query('UPDATE sutra_auto_config SET auto_publish=false WHERE user_id=$1', [user])).rowCount, 1)
    const other = users.find(id => id !== user)
    assert.equal((await client.query('UPDATE sutra_auto_config SET auto_publish=true WHERE user_id=$1', [other])).rowCount, 0)
    assert.equal((await client.query('DELETE FROM sutra_auto_config WHERE user_id=$1', [other])).rowCount, 0)
  })
})

test('an empty session claim cannot read, update or delete either schedule', async () => {
  await asRole('authenticated', null, async client => {
    assert.equal((await client.query('SELECT * FROM sutra_auto_config')).rowCount, 0)
    assert.equal((await client.query('UPDATE sutra_auto_config SET auto_publish=true')).rowCount, 0)
    assert.equal((await client.query('DELETE FROM sutra_auto_config')).rowCount, 0)
  })
})

for (const role of ['anon', 'authenticated'] as const) {
  test(`${role} cannot bypass the server by invoking the scheduler RPC directly`, async () => {
    await asRole(role, users[0], async client => {
      await assert.rejects(client.query("SELECT schedule_auto_video_jobs($1,now(),now()+interval '1 hour',now(),'[]',0)", [users[1]]),
        (error: unknown) => (error as { code?: string }).code === '42501')
    })
  })
}

test('the owner cannot change the cursor directly even with a valid session', async () => {
  await asRole('authenticated', users[0], async client => {
    await assert.rejects(client.query("UPDATE sutra_auto_config SET scheduler_cursor='2000-01-01' WHERE user_id=$1", [users[0]]),
      /SUTRA_SCHEDULER_CURSOR_FORBIDDEN/)
  })
})

test('ownership cannot be reassigned to another user by an authenticated update', async () => {
  await asRole('authenticated', users[0], async client => {
    await assert.rejects(client.query('UPDATE sutra_auto_config SET user_id=$1 WHERE user_id=$2', [randomUUID(), users[0]]),
      (error: unknown) => (error as { code?: string }).code === '42501')
  })
})

test('a privileged server RPC with a forged input owner fails before job, cursor or quota changes', async () => {
  const before = (await sql('SELECT to_jsonb(t) row FROM sutra_auto_config t WHERE user_id=$1', [users[0]])).rows[0].row
  // The fixture admin supplies the privileged server connection. The authenticated
  // and anonymous role tests above remain subject to RLS and unchanged ACLs.
  const jobs = [{
    key: 't02-cross-user-fixture', fingerprint: 'fixture', input: { userId: users[1], scheduleId: 'noon' },
    initial: { schedule_id: 'noon', scheduled_for: '2026-11-06T12:00:00Z' },
  }]
  await assert.rejects(sql('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,10)', [
    users[0], before.scheduler_cursor, '2026-11-07T00:00:00Z', before.updated_at, JSON.stringify(jobs),
  ]), /SUTRA_INVALID_SCHEDULE_OCCURRENCE/)
  assert.deepEqual((await sql('SELECT to_jsonb(t) row FROM sutra_auto_config t WHERE user_id=$1', [users[0]])).rows[0].row, before)
})
