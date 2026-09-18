// Script de test : sortie console lisible voulue.
/* eslint-disable no-console */
// -----------------------------------------------------------------------------
// Tests de la migration v10 sur une base locale JETABLE (aucune production).
// Cycle complet : reset → création d'un stub `sutra.videos` SEEDÉ (mois
// courant + mois passé + failed) → application du fichier de migration →
// vérifications.
//
// Prouve :
//   0. la migration s'applique (search_path sutra, backfill exécuté)
//   8. BACKFILL du mois courant : consommations videos importées, mois passé
//      ignoré, failed ignoré — et le quota en tient compte immédiatement
//   9. REJOUABILITÉ : ré-appliquer la migration ne double JAMAIS le comptage
//      et ne touche pas aux réservations en cours
//   1. réservation de quota ATOMIQUE (course réelle limite 1)
//   2. limite mensuelle + settlement complete/release
//   3. illimité (admin, limite 0) traçable
//   4. claim exclusif multi-workers (SKIP LOCKED)
//   5. reprise après bail expiré
//   6. claim par clé : ciblé, exclusif, borné par tentatives
//   7. checkpoint + heartbeat + idempotence UNIQUE
//  10. ANNULATION : queued → cancelled + place libérée ATOMIQUEMENT, plus
//      jamais claimable, re-cancel no-op
//  11. ANNULATION EN VOL : processing sain → libérée, jamais reprise worker
//
//   DATABASE_URL_LOCAL=postgres://… node scripts/test-migration-local.mjs
// -----------------------------------------------------------------------------
import pg from 'pg'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const url = process.env.DATABASE_URL_LOCAL
if (!url) {
  console.error('DATABASE_URL_LOCAL requis (base jetable uniquement)')
  process.exit(1)
}

const migrationSql = readFileSync(
  resolve(import.meta.dirname, '../migrations/v10_durable_jobs_quota.sql'),
  'utf8'
)

// ---------------------------------------------------------------------------
// Phase A — reset + stub sutra.videos seedé AVANT la migration (client dédié,
// fermé avant le pool : le search_path base s'applique aux nouvelles connexions)
// ---------------------------------------------------------------------------
const setup = new pg.Client({ connectionString: url })
await setup.connect()
const sq = (text, params) => setup.query(text, params)
await sq('drop schema if exists sutra cascade')
await sq('drop table if exists public.video_jobs, public.video_quota_counters cascade')
await sq(`drop function if exists public.reserve_video_quota(uuid,int), public.complete_video_quota(uuid),
  public.release_video_quota(uuid), public.claim_video_jobs(text,int,int),
  public.claim_video_job_by_key(text,text,int), public.heartbeat_video_job(uuid,text,int),
  public.checkpoint_video_job(uuid,text,jsonb,jsonb)`)

await sq('create schema sutra')
// search_path au niveau de la BASE jetable : toutes les connexions du pool
// voient sutra en premier, comme en production.
await sq(`alter database ${setup.database} set search_path to sutra, public`)

const pool = new pg.Pool({ connectionString: url, max: 4 })
const q = (text, params) => pool.query(text, params)
await q(`
  create table sutra.videos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    status text,
    created_at timestamptz not null default now()
  )
`)

const SEED_USERS = { a: randomUUID(), b: randomUUID() }
// User A : 3 vidéos ce mois (dont 1 failed → ne compte pas) + 2 vidéos le mois
// passé (ignorées : la limite est mensuelle). User B : 1 vidéo ce mois.
await q(`insert into sutra.videos (user_id, status, created_at) values
  ($1, 'ready', now()),
  ($1, 'ready', now() - interval '2 days'),
  ($1, 'failed', now() - interval '1 day'),
  ($1, 'ready', now() - interval '40 days'),
  ($1, 'ready', now() - interval '50 days'),
  ($2, 'ready', now() - interval '3 days')`, [SEED_USERS.a, SEED_USERS.b])
await setup.end()

// ---------------------------------------------------------------------------
// Phase B — application de la migration (fichier réel, inchangé)
// ---------------------------------------------------------------------------
await q(migrationSql)
console.log('✓ migration v10 appliquée (search_path sutra, backfill exécuté)')

// --- 8. Backfill : reprise du mois courant, pas de double comptage ----------
{
  const a = await q('select completed, reserved from video_quota_counters where user_id = $1', [SEED_USERS.a])
  const b = await q('select completed from video_quota_counters where user_id = $1', [SEED_USERS.b])
  assert.equal(a.rows[0].completed, 2, 'user A : 2 prêtes ce mois (failed exclue, mois passé ignoré)')
  assert.equal(b.rows[0].completed, 1, 'user B : 1 ce mois')

  // Le quota en tient compte IMMÉDIATEMENT : limite 3, 2 déjà consommées →
  // exactement 1 nouvelle réservation possible.
  const r1 = await q('select reserve_video_quota($1, 3) as ok', [SEED_USERS.a])
  const r2 = await q('select reserve_video_quota($1, 3) as ok', [SEED_USERS.a])
  assert.equal(r1.rows[0].ok, true, '3e place (2 consommées + 1 réservée) accordée')
  assert.equal(r2.rows[0].ok, false, '4e place refusée : le mois commencé compte')
  await q('select release_video_quota($1)', [SEED_USERS.a])
  console.log('✓ backfill : consommations du mois reprises, quota immédiatement borné')
}

// --- 9. Rejouabilité : ré-appliquer ne double pas, ne touche pas au vivant --
{
  // Une réservation EN COURS doit survivre au re-run.
  await q('select reserve_video_quota($1, 10)', [SEED_USERS.b])
  await q(migrationSql) // ré-application complète
  const a = await q('select completed, reserved from video_quota_counters where user_id = $1', [SEED_USERS.a])
  assert.equal(a.rows[0].completed, 2, 're-run : completed INCHANGÉ (pas de double comptage)')
  assert.equal(a.rows[0].reserved, 0)
  const b = await q('select completed, reserved from video_quota_counters where user_id = $1', [SEED_USERS.b])
  assert.equal(b.rows[0].completed, 1, 're-run : completed de B inchangé')
  assert.equal(b.rows[0].reserved, 1, 're-run : la réservation en cours est préservée')
  await q('select release_video_quota($1)', [SEED_USERS.b])
  console.log('✓ rejouabilité : re-run sans double comptage, réservations vivantes intactes')
}

// --- 1. Réservation atomique : course réelle, limite 1, 2 concurrents -------
{
  const user = randomUUID()
  const results = await Promise.all([
    q('select reserve_video_quota($1, 1) as ok', [user]),
    q('select reserve_video_quota($1, 1) as ok', [user]),
  ])
  const granted = results.filter((r) => r.rows[0].ok === true).length
  const denied = results.filter((r) => r.rows[0].ok === false).length
  assert.equal(granted, 1, `exactement 1 réservation (obtenu ${granted})`)
  assert.equal(denied, 1, 'exactement 1 refus')
  const c = await q('select reserved from video_quota_counters where user_id=$1', [user])
  assert.equal(c.rows[0].reserved, 1)
  console.log('✓ quota atomique : course limite 1 → exactement 1 réservée, 1 refusée')
}

// --- 2. Limite mensuelle + settlement ----------------------------------------
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

// --- 3. Illimité (admin, limite <= 0) -----------------------------------------
{
  const user = randomUUID()
  for (let i = 0; i < 5; i++) {
    const r = await q('select reserve_video_quota($1, 0) as ok', [user])
    assert.equal(r.rows[0].ok, true)
  }
  console.log('✓ illimité (limite 0) : traçable sans blocage')
}

// --- 4. Claim exclusif : 2 workers concurrents --------------------------------
{
  const [j1, j2] = await Promise.all([
    q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id", [randomUUID(), randomUUID()]),
    q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id", [randomUUID(), randomUUID()]),
  ])
  const clientA = await pool.connect()
  const clientB = await pool.connect()
  const claim = (c, w) =>
    c.query('begin').then(() => c.query('select id, locked_by from claim_video_jobs($1, 1, 60)', [w]))
  const [ca, cb] = await Promise.all([claim(clientA, 'worker-A'), claim(clientB, 'worker-B')])
  assert.equal(ca.rows.length, 1)
  assert.equal(cb.rows.length, 1)
  assert.notEqual(ca.rows[0].id, cb.rows[0].id, 'SKIP LOCKED : jamais la même tâche pour 2 workers')
  assert.ok(j1.rows[0].id && j2.rows[0].id)
  await clientA.query('commit')
  await clientB.query('commit')
  clientA.release()
  clientB.release()
  console.log('✓ claim exclusif : 2 workers → 2 tâches distinctes')
}

// --- 5. Reprise après bail expiré ---------------------------------------------
{
  const user = randomUUID()
  const job = await q(
    "insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2) returning id",
    [user, randomUUID()]
  )
  await q("update video_jobs set status='processing', locked_by='dead-worker', lease_until = now() - interval '1 min' where id=$1", [job.rows[0].id])
  const reclaimed = await q('select id, attempts, locked_by from claim_video_jobs($1, 5, 600)', ['worker-B'])
  const mine = reclaimed.rows.find((r) => r.id === job.rows[0].id)
  assert.ok(mine, 'la tâche au bail expiré est reprise')
  assert.equal(mine.locked_by, 'worker-B')
  console.log('✓ reprise : bail expiré → repris par un autre worker, tentative tracée')
}

// --- 6. Claim par clé ----------------------------------------------------------
{
  const user = randomUUID()
  const other = randomUUID()
  const mineKey = `${'claim'}-${randomUUID()}`
  const otherKey = `${'claim'}-${randomUUID()}`
  await q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2)", [user, mineKey])
  await q("insert into video_jobs (user_id, kind, idempotency_key) values ($1,'create',$2)", [other, otherKey])

  const c1 = await q("select id, idempotency_key from claim_video_job_by_key($1,'route-inline',600)", [mineKey])
  assert.equal(c1.rows.length, 1)
  assert.equal(c1.rows[0].idempotency_key, mineKey)

  const c2 = await q("select id from claim_video_job_by_key($1,'second-executor',600)", [mineKey])
  assert.equal(c2.rows.length, 0, 'une tâche au bail valide ne peut pas avoir 2 exécutants')

  await q('update video_jobs set attempts = max_attempts where idempotency_key = $1', [otherKey])
  const c3 = await q("select id from claim_video_job_by_key($1,'w',600)", [otherKey])
  assert.equal(c3.rows.length, 0, 'attempts épuisés → claim refusé')
  console.log('✓ claim par clé : ciblé, exclusif, borné par tentatives')
}

// --- 7. Checkpoint + heartbeat + idempotence ----------------------------------
{
  const user = randomUUID()
  const usedKey = `${randomUUID()}-used`
  const job = await q(
    'insert into video_jobs (user_id, kind, idempotency_key) values ($1,\'create\',$2) returning id',
    [user, usedKey]
  )
  await q("update video_jobs set status='processing', locked_by='w1', lease_until=now()+interval '10 min' where id=$1", [job.rows[0].id])
  await q('select checkpoint_video_job($1,\'w1\',$2,$3)', [
    job.rows[0].id,
    JSON.stringify({ scenes_done: [1, 2] }),
    JSON.stringify({ runpod: 'job-abc' }),
  ])
  const cp = await q('select progress, provider_job_ids from video_jobs where id=$1', [job.rows[0].id])
  assert.equal(cp.rows[0].progress.scenes_done.length, 2)
  assert.equal(cp.rows[0].provider_job_ids.runpod, 'job-abc')
  await q('select heartbeat_video_job($1,$2,300)', [job.rows[0].id, 'w1'])
  await assert.rejects(
    q('insert into video_jobs (user_id, kind, idempotency_key) values ($1,\'create\',$2)', [user, usedKey]),
    /duplicate key|unique/,
    'idempotency_key UNIQUE refuse le doublon'
  )
  console.log('✓ checkpoint (reprise sans régénérer) + heartbeat + idempotence UNIQUE')
}

// --- 10. Annulation (queued) : jamais re-claimable + place libérée -------------
{
  const user = randomUUID()
  await q('select reserve_video_quota($1, 5)', [user])
  const key = `cancel-${randomUUID()}`
  const job = await q(
    "insert into video_jobs (user_id, kind, idempotency_key) values ($1,'production',$2) returning id",
    [user, key]
  )
  const c1 = await q('select cancel_video_job($1) as ok', [key])
  assert.equal(c1.rows[0].ok, true, 'annulation d\'une tâche queued')
  const st = await q('select status from video_jobs where id=$1', [job.rows[0].id])
  assert.equal(st.rows[0].status, 'cancelled')
  const counter = await q('select reserved, released from video_quota_counters where user_id=$1', [user])
  assert.equal(counter.rows[0].reserved, 0, 'place réservée libérée dans la MÊME transaction')
  assert.equal(counter.rows[0].released, 1)
  const c2 = await q("select id from claim_video_job_by_key($1,'w',600)", [key])
  assert.equal(c2.rows.length, 0, 'une tâche annulée n\'est JAMAIS claimable')
  const reclaim = await q('select id from claim_video_jobs($1, 10, 600)', ['worker-late'])
  assert.equal(reclaim.rows.find((r) => r.id === job.rows[0].id), undefined, 'le worker non plus')
  const c3 = await q('select cancel_video_job($1) as ok', [key])
  assert.equal(c3.rows[0].ok, false, 're-cancel = no-op')
  console.log('✓ annulation (queued) : cancelled + place libérée atomiquement, jamais re-claimable')
}

// --- 11. Annulation en vol (processing sain) -----------------------------------
{
  const user = randomUUID()
  await q('select reserve_video_quota($1, 5)', [user])
  const key = `cancel-${randomUUID()}`
  const job = await q(
    "insert into video_jobs (user_id, kind, idempotency_key) values ($1,'production',$2) returning id",
    [user, key]
  )
  await q("update video_jobs set status='processing', locked_by='inline', lease_until=now()+interval '5 min' where id=$1", [job.rows[0].id])
  const c = await q('select cancel_video_job($1) as ok', [key])
  assert.equal(c.rows[0].ok, true, 'une tâche processing saine peut être annulée')
  const counter = await q('select reserved, released from video_quota_counters where user_id=$1', [user])
  assert.equal(counter.rows[0].reserved, 0, 'place libérée')
  const reclaim = await q('select id from claim_video_jobs($1, 10, 600)', ['worker-late'])
  assert.equal(reclaim.rows.find((r) => r.id === job.rows[0].id), undefined, 'jamais reprise par le worker')
  console.log('✓ annulation en vol : place libérée, tâche jamais reprise')
}

await pool.end()
console.log('MIGRATION v10 : tous les tests passent')
