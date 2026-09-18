// Script de test : sortie console lisible voulue.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// Tests de la migration v10 sur une base locale JETABLE (aucune production) :
//   DATABASE_URL_LOCAL=postgres://… node scripts/test-migration-local.mjs
// Prouve : réservation de quota ATOMIQUE (course réelle), claim exclusif
// (SKIP LOCKED), reprise après expiration de bail, checkpoint, idempotence.
// -----------------------------------------------------------------------------
import pg from 'pg'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const url = process.env.DATABASE_URL_LOCAL
if (!url) {
  console.error('DATABASE_URL_LOCAL requis (base jetable uniquement)')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: url, max: 4 })

const q = (text, params) => pool.query(text, params)

// --- 1. Réservation atomique : course réelle, limite 1, 2 concurrents -------
{
  const user = randomUUID()
  const results = await Promise.all([
    q('select reserve_video_quota($1, 1) as ok', [user]),
    q('select reserve_video_quota($1, 1) as ok', [user]),
  ])
  // L'ordre d'attribution est non déterministe : ce qui DOIT tenir, c'est
  // EXACTEMENT UNE réservation accordée et une refusée (pas de dépassement).
  const granted = results.filter((r) => r.rows[0].ok === true).length
  const denied = results.filter((r) => r.rows[0].ok === false).length
  assert.equal(granted, 1, `exactement 1 réservation (obtenu ${granted})`)
  assert.equal(denied, 1, 'exactement 1 refus')
  const c = await q('select reserved from video_quota_counters where user_id=$1', [user])
  assert.equal(c.rows[0].reserved, 1)
  console.log('✓ quota atomique : course limite 1 → exactement 1 réservée, 1 refusée')
}

// --- 2. Limite mensuelle respectée + settlement ------------------------------
{
  const user = randomUUID()
  const r1 = await q('select reserve_video_quota($1, 2) as ok', [user])
  const r2 = await q('select reserve_video_quota($1, 2) as ok', [user])
  const r3 = await q('select reserve_video_quota($1, 2) as ok', [user])
  assert.ok(r1.rows[0].ok && r2.rows[0].ok && !r3.rows[0].ok, 'limite 2 : 2 ok, 3e refusée')
  await q('select complete_video_quota($1)', [user])
  await q('select release_video_quota($1)', [user])
  const s = await q('select reserved, completed, released from video_quota_counters where user_id=$1', [user])
  assert.deepEqual(
    { reserved: s.rows[0].reserved, completed: s.rows[0].completed, released: s.rows[0].released },
    { reserved: 0, completed: 1, released: 1 },
    'settlement : completed consommé, échec libéré'
  )
  console.log('✓ settlement : complete consomme la place, release la libère')
}

// --- 3. Illimité (admin, limite <= 0) ----------------------------------------
{
  const user = randomUUID()
  for (let i = 0; i < 5; i++) {
    const r = await q('select reserve_video_quota($1, 0) as ok', [user])
    assert.equal(r.rows[0].ok, true)
  }
  const s = await q('select reserved from video_quota_counters where user_id=$1', [user])
  assert.equal(s.rows[0].reserved, 5)
  console.log('✓ illimité (limite 0) : traçable sans blocage')
}

// --- 4. Claim exclusif : 2 workers concurrents, jamais la même tâche --------
{
  const [j1, j2] = await Promise.all([
    q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id", [randomUUID(), randomUUID()]),
    q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id", [randomUUID(), randomUUID()]),
  ])
  const clientA = await pool.connect()
  const clientB = await pool.connect()
  const claim = (c, w) =>
    c.query('begin').then(() =>
      c.query('select id, locked_by from claim_video_jobs($1, 1, 60)', [w])
    )
  const [ca, cb] = await Promise.all([claim(clientA, 'worker-A'), claim(clientB, 'worker-B')])
  const idsA = ca.rows.map((r) => r.id)
  const idsB = cb.rows.map((r) => r.id)
  assert.equal(idsA.length, 1)
  assert.equal(idsB.length, 1)
  assert.notEqual(idsA[0], idsB[0], 'SKIP LOCKED : jamais la même tâche pour 2 workers')
  await clientA.query('commit')
  await clientB.query('commit')
  clientA.release()
  clientB.release()
  console.log('✓ claim exclusif : 2 workers → 2 tâches distinctes')
}

// --- 5. Reprise après bail expiré : même tâche, attempts +1, pas de perte --
{
  const user = randomUUID()
  const job = await q(
    "insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id",
    [user, randomUUID()]
  )
  // Worker mort : bail expiré
  await q("update video_jobs set status='processing', locked_by='dead-worker', lease_until = now() - interval '1 min' where id=$1", [job.rows[0].id])
  const reclaimed = await q('select id, attempts, locked_by from claim_video_jobs($1, 5, 600)', ['worker-B'])
  const mine = reclaimed.rows.find((r) => r.id === job.rows[0].id)
  assert.ok(mine, 'la tâche au bail expiré est reprise')
  assert.equal(mine.locked_by, 'worker-B')
  const after = await q('select attempts from video_jobs where id=$1', [job.rows[0].id])
  assert.equal(after.rows[0].attempts, 1, 'reprise = nouvelle tentative tracée')
  console.log('✓ reprise : bail expiré → repris par un autre worker, tentative tracée')
}

// --- 6. Claim par clé : jamais la tâche d'un autre, jamais deux exécutants -
{
  const user = randomUUID()
  const other = randomUUID()
  // Clés uniques par exécution : le test reste rejouable sur la même base.
  const mineKey = `${'claim'}-${randomUUID()}`
  const otherKey = `${'claim'}-${randomUUID()}`
  await q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2)", [user, mineKey])
  await q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2)", [other, otherKey])

  // La clé ciblée ne réclame QUE sa tâche — jamais celle d'un autre.
  const c1 = await q("select id, idempotency_key from claim_video_job_by_key($1,'route-inline',600)", [mineKey])
  assert.equal(c1.rows.length, 1)
  assert.equal(c1.rows[0].idempotency_key, mineKey)

  // Tâche saine en cours → claim refusé : pas de second exécutant.
  const c2 = await q("select id from claim_video_job_by_key($1,'second-executor',600)", [mineKey])
  assert.equal(c2.rows.length, 0, 'une tâche au bail valide ne peut pas avoir 2 exécutants')

  // Tentatives épuisées → plus de claim (échec final, pas de boucle infinie).
  await q('update video_jobs set attempts = max_attempts where idempotency_key = $1', [otherKey])
  const c3 = await q("select id from claim_video_job_by_key($1,'w',600)", [otherKey])
  assert.equal(c3.rows.length, 0, 'attempts épuisés → claim refusé')
  console.log('✓ claim par clé : ciblé, exclusif, borné par tentatives')
}

// --- 7. Checkpoint + heartbeat + idempotence --------------------------------
{
  const user = randomUUID()
  const usedKey = `${randomUUID()}-used`
  const job = await q(
    'insert into video_jobs (user_id, kind, idempotency_key) values ($1,\'create\',$2) returning id',
    [user, usedKey]
  )
  await q("update video_jobs set status='processing', locked_by='w1', lease_until=now()+interval '10 min' where id=$1", [job.rows[0].id])
  await q("select checkpoint_video_job($1,'w1',$2,$3)", [
    job.rows[0].id,
    JSON.stringify({ scenes_done: [1, 2] }),
    JSON.stringify({ runpod: 'job-abc' }),
  ])
  const cp = await q('select progress, provider_job_ids from video_jobs where id=$1', [job.rows[0].id])
  assert.equal(cp.rows[0].progress.scenes_done.length, 2)
  assert.equal(cp.rows[0].provider_job_ids.runpod, 'job-abc')
  await q('select heartbeat_video_job($1,$2,300)', [job.rows[0].id, 'w1'])
  // Idempotence : même clé → violation unique (jamais deux jobs pour un rendu)
  await assert.rejects(
    q('insert into video_jobs (user_id, kind, idempotency_key) values ($1,\'create\',$2)', [user, usedKey]),
    /duplicate key|unique/,
    'idempotency_key UNIQUE refuse le doublon'
  )
  console.log('✓ checkpoint (reprise sans régénérer) + heartbeat + idempotence UNIQUE')
}

await pool.end()
console.log('MIGRATION v10 : tous les tests passent')
