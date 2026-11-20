BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
SELECT pg_advisory_xact_lock(hashtext('sutra-t01-release-9b0c2c9'));
-- v10_durable_jobs_quota.sql a112552d0479dc7e54c50231fddb43c8675da639ebaeecc786b3382cad00a73d
-- =============================================================================
-- v10 — File de tâches durable + réservation de quota ATOMIQUE
-- Audit SUTRA #8/#9/#10/#14 :
--   * video_jobs : persistance des générations, claim atomique par bail
--     (FOR UPDATE SKIP LOCKED), reprise sans double génération (checkpoint
--     par scène + provider_job_ids + idempotency_key UNIQUE).
--   * video_quota_counters + reserve_video_quota() : réservation atomique en
--     UNE instruction SQL (plus de lecture-puis-action concurrence).
--   * release_video_quota() / complete_video_quota() : libération contrôlée.
--   * Backfill du mois courant : les consommations DÉJÀ enregistrées dans
--     `videos` sont importées comme `completed` — la mise en production ne
--     remet PAS les compteurs à zéro, et rejouer la migration ne double
--     JAMAIS le comptage (ON CONFLICT DO NOTHING).
--
-- NB : user_id est un uuid nu (pas de FK vers auth.users) pour rester
-- applicable/testable sur une base isolée ; l'application garantit la
-- provenance (auth.getUser() côté routes).
-- =============================================================================

-- Schéma applicatif (convention migrations sutra) — créé s'il n'existe pas
-- (base de test locale isolée).
create schema if not exists sutra;
SET search_path TO sutra, public;

-- -----------------------------------------------------------------------------
-- 1. Compteurs de quota mensuels (réservation + settlement)
-- -----------------------------------------------------------------------------
create table if not exists video_quota_counters (
  user_id       uuid        not null,
  period_start  date        not null,
  reserved      int         not null default 0,
  completed     int         not null default 0,
  failed        int         not null default 0,
  released      int         not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, period_start)
);

comment on table video_quota_counters is 'Réservation atomique du quota vidéo mensuel : reserved = en cours, completed/failed/released = settlement';

-- -----------------------------------------------------------------------------
-- 2. Réservation atomique : UNE instruction, aucune fenêtre de course.
--    Retourne true si la place est réservée, false si le plan est épuisé.
--    p_limit <= 0 (illimité/admin) réserve sans compter.
-- -----------------------------------------------------------------------------
create or replace function reserve_video_quota(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_ok boolean;
begin
  if p_limit is null or p_limit <= 0 then
    -- illimité (admin) : on trace quand même une ligne
    insert into video_quota_counters (user_id, period_start, reserved)
    values (p_user_id, v_period, 1)
    on conflict (user_id, period_start)
    do update set reserved = video_quota_counters.reserved + 1, updated_at = now();
    return true;
  end if;

  insert into video_quota_counters (user_id, period_start, reserved)
  values (p_user_id, v_period, 1)
  on conflict (user_id, period_start)
  do update set reserved = video_quota_counters.reserved + 1
  where video_quota_counters.reserved + video_quota_counters.completed < p_limit
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Settlement : la génération a abouti (la place devient définitivement consommée).
create or replace function complete_video_quota(p_user_id uuid)
returns void
language sql
as $$
  update video_quota_counters
     set reserved = reserved - 1,
         completed = completed + 1,
         updated_at = now()
   where user_id = p_user_id
     and period_start = date_trunc('month', now())::date
     and reserved > 0;
$$;

-- Settlement : échec → la place est LIBÉRÉE (jamais facturée à l'utilisateur).
create or replace function release_video_quota(p_user_id uuid)
returns void
language sql
as $$
  update video_quota_counters
     set reserved = reserved - 1,
         released = released + 1,
         updated_at = now()
   where user_id = p_user_id
     and period_start = date_trunc('month', now())::date
     and reserved > 0;
$$;

-- -----------------------------------------------------------------------------
-- REPRISE DU MOIS COURANT sans double comptage :
--   * les vidéos de ce mois déjà enregistrées (statut <> failed) deviennent
--     `completed` — le quota du mois en cours est donc déjà partiellement
--     consommé au moment du déploiement, comme avant la migration ;
--   * ON CONFLICT DO NOTHING : rejouer la migration n'ajoute rien (idempotent)
--     et ne touche NI aux réservations en cours NI aux compteurs vivants ;
--   * les mois passés ne sont PAS importés : la limite est mensuelle.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('sutra.videos') is not null then
    insert into video_quota_counters (user_id, period_start, completed, updated_at)
    select v.user_id,
           date_trunc('month', v.created_at)::date,
           count(*)::int,
           now()
      from sutra.videos v
     where v.created_at >= date_trunc('month', now())
       and coalesce(v.status, 'ready') <> 'failed'
     group by v.user_id, date_trunc('month', v.created_at)::date
    on conflict (user_id, period_start) do nothing;
    raise notice 'backfill mois courant : consommations videos importees (sans double comptage)';
  else
    raise notice 'table sutra.videos absente (base de test) — backfill mensuel omis';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. File de tâches durable
-- -----------------------------------------------------------------------------
create table if not exists video_jobs (
  id                uuid        primary key default gen_random_uuid(),
  video_id          uuid,               -- videos.id (nullable : exports etc.)
  user_id           uuid        not null,
  kind              text        not null check (kind in ('create', 'production', 'auto', 'export')),
  payload           jsonb       not null default '{}',
  -- checkpoint de reprise : résultats déjà obtenus (par scène) pour ne JAMAIS
  -- régénérer ce qui est fait (audit #10/#14).
  progress          jsonb       not null default '{}',
  provider_job_ids  jsonb       not null default '{}',
  status            text        not null default 'queued'
                    check (status in ('queued', 'processing', 'done', 'failed', 'cancelled')),
  attempts          int         not null default 0,
  max_attempts      int         not null default 3,
  locked_by         text,
  locked_at         timestamptz,
  lease_until       timestamptz,
  last_error        text,
  idempotency_key   text        unique not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists video_jobs_status_ready
  on video_jobs (status, created_at)
  where status in ('queued', 'processing');

create index if not exists video_jobs_user
  on video_jobs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. Claim atomique d'un lot de tâches (worker). FOR UPDATE SKIP LOCKED :
--    deux workers concurrents ne prennent JAMAIS la même tâche. Une tâche
--    « processing » dont le bail a expiré (worker mort) est reprise.
-- -----------------------------------------------------------------------------
create or replace function claim_video_jobs(p_worker text, p_limit int, p_lease_seconds int)
returns setof video_jobs
language plpgsql
as $$
declare
  v_row record;
  v_job video_jobs;
begin
  for v_row in
    select id from video_jobs
     where status = 'queued'
        or (status = 'processing' and lease_until < now())
     order by created_at
     limit greatest(1, coalesce(p_limit, 1))
     for update skip locked
  loop
    update video_jobs
       set status = 'processing',
           attempts = attempts + 1,
           locked_by = p_worker,
           locked_at = now(),
           lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
           updated_at = now()
     where id = v_row.id
     returning * into v_job;
    return next v_job;
  end loop;
  return;
end;
$$;

-- Claim ciblé par clé d'idempotence (exécution inline côté route : la route
-- ne doit jamais voler la tâche d'un autre). UNE instruction atomique.
-- setof : 0 ligne quand le claim est refusé (jamais de ligne de NULLs).
create or replace function claim_video_job_by_key(p_key text, p_worker text, p_lease_seconds int)
returns setof video_jobs
language plpgsql
as $$
declare
  v_job video_jobs;
begin
  update video_jobs
     set status = 'processing',
         attempts = attempts + 1,
         locked_by = p_worker,
         locked_at = now(),
         lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
         updated_at = now()
   where idempotency_key = p_key
     and (status = 'queued' or (status = 'processing' and lease_until < now()))
     and attempts < max_attempts
  returning * into v_job;
  if v_job.id is not null then
    return next v_job;
  end if;
  return;
end;
$$;

-- Annulation utilisateur : la tâche (queued ou processing) passe à
-- 'cancelled' — plus JAMAIS claimable — et sa place de quota réservée est
-- libérée dans la MÊME transaction (aucune place réservée orpheline).
-- Retourne false si la tâche n'existe pas / est déjà terminée.
create or replace function cancel_video_job(p_key text)
returns boolean
language plpgsql
as $$
declare
  v_job video_jobs;
begin
  select * into v_job
    from video_jobs
   where idempotency_key = p_key
     and status in ('queued', 'processing')
   for update;

  if v_job.id is null then
    return false;
  end if;

  update video_jobs
     set status = 'cancelled',
         lease_until = null,
         updated_at = now()
   where id = v_job.id;

  perform release_video_quota(v_job.user_id);
  return true;
end;
$$;

-- Renouvellement du bail (heartbeat d'un worker vivant sur une tâche longue).
create or replace function heartbeat_video_job(p_job_id uuid, p_worker text, p_lease_seconds int)
returns void
language sql
as $$
  update video_jobs
     set lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker
     and status = 'processing';
$$;

-- Checkpoint de progression (reprise sans double génération).
-- MERGE jsonb (||) et non remplacement : permet de checkpointer de GROSSES
-- charges par morceaux (ex. voix >20 Mo découpée en clés voice_b64:N, chaque
-- appel RPC restant sous la limite de payload) sans écraser l'acquis précédent.
-- Les appelants qui envoient l'objet complet restent corrects (merge idempotent).
create or replace function checkpoint_video_job(p_job_id uuid, p_worker text, p_progress jsonb, p_provider_job_ids jsonb)
returns void
language sql
as $$
  update video_jobs
     set progress = progress || coalesce(p_progress, '{}'::jsonb),
         provider_job_ids = provider_job_ids || coalesce(p_provider_job_ids, '{}'::jsonb),
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker
     and status = 'processing';
$$;

-- =============================================================================
-- RLS : seul le service role (serveur) touche à ces tables.
-- Sur une base de test locale (sans rôle service_role), les policies sont
-- omises avec un NOTICE — le reste de la migration s'applique intégralement.
-- =============================================================================
alter table video_quota_counters enable row level security;
alter table video_jobs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'drop policy if exists "service role only on video_quota_counters" on video_quota_counters';
    execute 'create policy "service role only on video_quota_counters" on video_quota_counters for all to service_role using (true) with check (true)';
    execute 'drop policy if exists "service role only on video_jobs" on video_jobs';
    execute 'create policy "service role only on video_jobs" on video_jobs for all to service_role using (true) with check (true)';
  else
    raise notice 'rôle service_role absent (base de test) — policies RLS omises';
  end if;
end;
$$;

-- v11_pipeline_checkpoints.sql 704bcad695215f7892aea0cc3ae34591864a17353100417ae2a8f9ff42e9b6fc
-- T03: apply after v10. No provider call or remote migration is made by this file.
SET LOCAL search_path TO sutra, public;
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_check
 CHECK (status IN ('queued','processing','done','failed','cancelled','reconciliation_required'));

CREATE OR REPLACE FUNCTION heartbeat_video_job_v2(p_job_id uuid, p_worker text, p_lease_seconds int)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 UPDATE video_jobs SET lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))), updated_at=clock_timestamp()
 WHERE id=p_job_id AND locked_by=p_worker AND status='processing' AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION checkpoint_video_job_v2(p_job_id uuid,p_worker text,p_progress jsonb,p_provider_job_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 IF p_progress IS NULL OR jsonb_typeof(p_progress)<>'object' OR (p_progress ? 'steps' AND jsonb_typeof(p_progress->'steps')<>'object')
 OR (p_progress ? 'scenes' AND jsonb_typeof(p_progress->'scenes')<>'object') THEN
  RAISE EXCEPTION 'SUTRA_INVALID_CHECKPOINT';
 END IF;
 -- Merge sibling checkpoints atomically; concurrent voice/music/scene writes cannot erase each other.
 UPDATE video_jobs SET progress=progress || p_progress || jsonb_build_object(
   'steps',coalesce(progress->'steps','{}') || coalesce(p_progress->'steps','{}'),
   'scenes',coalesce(progress->'scenes','{}') || coalesce(p_progress->'scenes','{}')),
   provider_job_ids=provider_job_ids || coalesce(p_provider_job_ids,'{}'), updated_at=clock_timestamp()
 WHERE id=p_job_id AND locked_by=p_worker AND status='processing' AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION finish_video_job(p_job_id uuid,p_worker text,p_status text,p_error text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; target text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
  OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST';
 END IF;
 IF p_status NOT IN ('done','failed','queued','reconciliation_required') THEN RAISE EXCEPTION 'SUTRA_INVALID_JOB_TRANSITION'; END IF;
 IF p_status='done' AND NOT (j.progress ? 'result') THEN RAISE EXCEPTION 'SUTRA_RESULT_CHECKPOINT_REQUIRED'; END IF;
 target:=p_status;
 IF p_status='queued' AND (p_error LIKE '%SUTRA_RECONCILIATION_REQUIRED%' OR j.attempts>=j.max_attempts) THEN target:='reconciliation_required'; END IF;
 UPDATE video_jobs SET status=target,last_error=p_error,locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 -- Exactly one settlement, in the job transaction and in its original reservation month.
 IF target IN ('done','failed') THEN
  UPDATE video_quota_counters SET reserved=reserved-1,
   completed=completed+CASE WHEN target='done' THEN 1 ELSE 0 END,
   released=released+CASE WHEN target='failed' THEN 1 ELSE 0 END, updated_at=clock_timestamp()
   WHERE user_id=j.user_id AND period_start=date_trunc('month',j.created_at)::date AND reserved>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_QUOTA_RECONCILIATION_REQUIRED'; END IF;
 END IF;
 RETURN target;
END $$;

CREATE OR REPLACE FUNCTION claim_video_jobs(p_worker text,p_limit int,p_lease_seconds int)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 -- Exhausted interrupted work is retained for reconciliation; no unbounded paid retries.
 UPDATE video_jobs SET status='reconciliation_required',last_error='SUTRA_RECONCILIATION_REQUIRED: attempts exhausted',locked_by=NULL,lease_until=NULL
 WHERE attempts>=max_attempts AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()));
 RETURN QUERY WITH candidates AS (
  SELECT id FROM video_jobs WHERE attempts<max_attempts AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()))
  ORDER BY created_at LIMIT greatest(1,least(10,coalesce(p_limit,1))) FOR UPDATE SKIP LOCKED
 ) UPDATE video_jobs j SET status='processing',attempts=j.attempts+1,locked_by=p_worker,
 locked_at=clock_timestamp(),lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))),updated_at=clock_timestamp()
 FROM candidates c WHERE j.id=c.id RETURNING j.*;
END $$;

-- Fenced business writes: table, columns, user and job/video binding are all checked.
CREATE OR REPLACE FUNCTION persist_video_job_video(p_job_id uuid,p_worker text,p_table text,p_id uuid,p_values jsonb,p_insert boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; cols text; sets text; vals text; changed uuid; old_url text; old_user uuid; old_status text; media jsonb; proof jsonb; final_url text; required_voice boolean; required_music boolean; stage text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
  OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF p_table NOT IN ('videos','sutra_auto_videos') OR p_values IS NULL OR jsonb_typeof(p_values)<>'object' OR p_values='{}'::jsonb
 OR (p_values ? 'user_id' AND p_values->>'user_id'<>j.user_id::text) OR p_values ? 'id' THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_WRITE'; END IF;
 IF (j.kind='production' AND (p_table<>'videos' OR p_id<>j.id))
 OR (j.kind='auto' AND (p_table<>'sutra_auto_videos' OR p_id::text IS DISTINCT FROM j.payload->'input'->>'videoRowId'))
 OR (j.kind IN ('create','export') AND (p_table<>'videos' OR p_id IS DISTINCT FROM j.video_id)) THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN (
 'user_id','title','description','tags','script_data','voice_url','music_url','video_url','thumbnail_url','shotstack_json','duration','status','quality','cost_estimate','format',
 'script','theme_id','prompt_used','music_prompt','ai_reasoning','ai_confidence','video_raw_url','video_final_url','audio_music_url','audio_voice_url','error_message','generation_completed_at','generation_duration_seconds','hashtags')) THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_COLUMN'; END IF;
 -- Ready requires the durable measured final export and every requested track.
 IF p_values->>'status' IN ('ready','pending_approval') THEN
  media:=j.progress->'steps'->'stage:export'->'value'; proof:=media->'verification';
  final_url:=coalesce(p_values->>'video_url',p_values->>'video_final_url');
  IF NOT coalesce(final_url ~ '[^[:space:]]',false) OR media->'outputVerified' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(media->'url') IS DISTINCT FROM 'string' OR jsonb_typeof(proof->'url') IS DISTINCT FROM 'string'
   OR proof->>'url' IS DISTINCT FROM final_url OR media->>'url' IS DISTINCT FROM final_url
   OR coalesce(proof->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(media->'duration') IS DISTINCT FROM 'number'
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['width','height']) field
    WHERE jsonb_typeof(media->'outputSize'->field) IS DISTINCT FROM 'number')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['duration','fps','width','height']) field
    WHERE jsonb_typeof(proof->field) IS DISTINCT FROM 'number')
   OR NOT coalesce((media->>'duration')::numeric>0 AND (proof->>'duration')::numeric>0 AND (proof->>'fps')::numeric>0
    AND (proof->>'width')::int>0 AND (proof->>'height')::int>0
    AND (proof->>'width')::int=(media->'outputSize'->>'width')::int
    AND (proof->>'height')::int=(media->'outputSize'->>'height')::int
    AND abs((proof->>'duration')::numeric-(media->>'duration')::numeric)<=0.1,false)
   THEN RAISE EXCEPTION 'SUTRA_FINAL_MEDIA_PROOF_REQUIRED'; END IF;
  FOREACH stage IN ARRAY ARRAY['script','scenes','images','voice','music','subtitles','composition','export'] LOOP
   IF NOT coalesce(j.progress->'steps'->('stage:'||stage)->>'status' IN ('complete','skipped'),false)
    OR (stage IN ('scenes','composition','export') AND j.progress->'steps'->('stage:'||stage)->>'status'<>'complete')
    THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: %',stage; END IF;
  END LOOP;
  IF jsonb_typeof(j.progress->'steps'->'stage:scenes'->'value') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF jsonb_array_length(j.progress->'steps'->'stage:scenes'->'value')=0
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j.progress->'steps'->'stage:scenes'->'value') clip
   WHERE coalesce(clip->>'url',clip#>>'{}')=final_url) OR p_values->>'video_raw_url'=final_url
   THEN RAISE EXCEPTION 'SUTRA_RAW_MEDIA_FORBIDDEN'; END IF;
  required_voice:=CASE WHEN j.kind='auto' THEN coalesce((j.payload->'input'->'config'->>'default_voice_enabled')::boolean,false)
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'voice')::boolean,true)
   ELSE coalesce(j.progress->'steps'->'stage:script'->'value'->>'narration','')<>'' END;
  required_music:=CASE WHEN j.kind='auto' THEN coalesce(j.payload->'input'->'config'->>'default_music_genre','none') NOT IN ('','none')
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'music')::boolean,true)
   WHEN j.kind='create' THEN coalesce(j.progress->'steps'->'stage:script'->'value'->>'music_style','none') NOT IN ('','none')
   ELSE coalesce(j.payload->'input'->>'musicStyle','cinematic')<>'none' END;
  IF required_voice AND (j.progress->'steps'->'stage:voice'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:voice'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:voice'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:voice'->>'value' ~ '[^[:space:]]',false))
   OR required_music AND (j.progress->'steps'->'stage:music'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:music'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:music'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:music'->>'value' ~ '[^[:space:]]',false))
   OR (required_voice OR required_music) AND proof->'hasAudio' IS DISTINCT FROM 'true'::jsonb
   THEN RAISE EXCEPTION 'SUTRA_REQUIRED_TRACK_MISSING'; END IF;
 END IF;
 -- Publication owns these states: replay may acknowledge the same final file only.
 EXECUTE format('SELECT %I,user_id,status FROM sutra.%I WHERE id=$1 FOR UPDATE',
   CASE WHEN p_table='videos' THEN 'video_url' ELSE 'video_final_url' END,p_table)
   INTO old_url,old_user,old_status USING p_id;
 IF old_user IS NOT NULL AND old_user<>j.user_id THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF old_status IN ('publishing','published','scheduled','partially_published','reconciliation_required','cancelled') THEN
  IF final_url=old_url AND old_status<>'cancelled' THEN RETURN true; END IF;
  RAISE EXCEPTION 'SUTRA_PUBLISHED_VIDEO_IMMUTABLE';
 END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('%I=r.%I',k,k),','),string_agg(format('r.%I',k),',') INTO cols,sets,vals FROM jsonb_object_keys(p_values) k;
 IF p_insert THEN
  EXECUTE format('INSERT INTO sutra.%I(id,%s) SELECT $1,%s FROM jsonb_populate_record(NULL::sutra.%I,$2) r ON CONFLICT(id) DO NOTHING RETURNING id',p_table,cols,vals,p_table) INTO changed USING p_id,p_values;
  IF changed IS NULL AND (old_user IS DISTINCT FROM j.user_id OR old_url IS DISTINCT FROM p_values->>'video_url') THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: conflicting video'; END IF;
 ELSE
  EXECUTE format('UPDATE sutra.%I v SET %s FROM jsonb_populate_record(NULL::sutra.%I,$2) r WHERE v.id=$1 AND v.user_id=$3 RETURNING v.id',p_table,sets,p_table) INTO changed USING p_id,p_values,j.user_id;
  IF changed IS NULL THEN RAISE EXCEPTION 'SUTRA_VIDEO_PERSISTENCE_FAILED'; END IF;
 END IF;
 -- Preserve AUTO memory/theme side effects exactly once in the same transaction.
 IF j.kind='auto' AND p_values->>'status' IN ('ready','pending_approval') AND NOT coalesce((j.progress->>'auto_effects_saved')::boolean,false) THEN
  INSERT INTO sutra_auto_memory(user_id,memory_type,content,importance,related_video_id)
   VALUES(j.user_id,'preference',format('Video generee: "%s" — theme: %s, raison: %s',p_values->>'title',coalesce(p_values->>'theme_id','libre'),p_values->>'ai_reasoning'),0.5,p_id);
  IF p_values->>'theme_id' IS NOT NULL THEN
   UPDATE sutra_auto_themes SET times_used=coalesce(times_used,0)+1,last_used_at=clock_timestamp()
    WHERE id=(p_values->>'theme_id')::uuid AND user_id=j.user_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_THEME_OWNER_MISMATCH'; END IF;
  END IF;
  UPDATE video_jobs SET progress=progress||'{"auto_effects_saved":true}'::jsonb WHERE id=j.id;
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION record_video_job_event(p_job_id uuid,p_worker text,p_table text,p_key text,p_values jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; cols text; vals text; receipt uuid;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
  OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF p_table NOT IN ('api_logs','activity_logs','user_notifications') OR p_key IS NULL OR p_values IS NULL
  OR jsonb_typeof(p_values)<>'object' OR p_values->>'user_id' IS DISTINCT FROM j.user_id::text
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN ('user_id','service','endpoint','status','response_time_ms','error_message','type','title','message','description','metadata'))
  THEN RAISE EXCEPTION 'SUTRA_INVALID_EVENT'; END IF;
 IF coalesce(j.progress->'effects','{}') ? (p_table||':'||p_key) THEN RETURN true; END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') INTO cols,vals FROM jsonb_object_keys(p_values) k;
 EXECUTE format('INSERT INTO sutra.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::sutra.%I,$1) r RETURNING id',p_table,cols,vals,p_table) INTO receipt USING p_values;
 IF receipt IS NULL THEN RAISE EXCEPTION 'SUTRA_EVENT_PERSISTENCE_FAILED'; END IF;
 UPDATE video_jobs SET progress=jsonb_set(progress,'{effects}',coalesce(progress->'effects','{}')||jsonb_build_object(p_table||':'||p_key,receipt)) WHERE id=j.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION record_video_job_event(uuid,text,text,text,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION record_video_job_event(uuid,text,text,text,jsonb) TO service_role;
 END IF;
END $$;

REVOKE ALL ON FUNCTION heartbeat_video_job_v2(uuid,text,int),checkpoint_video_job_v2(uuid,text,jsonb,jsonb),finish_video_job(uuid,text,text,text),persist_video_job_video(uuid,text,text,uuid,jsonb,boolean) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION heartbeat_video_job_v2(uuid,text,int),checkpoint_video_job_v2(uuid,text,jsonb,jsonb),finish_video_job(uuid,text,text,text),persist_video_job_video(uuid,text,text,uuid,jsonb,boolean) TO service_role;
 END IF;
END $$;
-- Old RPC names retain their return type but cannot bypass the new fence.
CREATE OR REPLACE FUNCTION heartbeat_video_job(p_job_id uuid,p_worker text,p_lease_seconds int)
RETURNS void LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN PERFORM heartbeat_video_job_v2(p_job_id,p_worker,p_lease_seconds); END $$;
CREATE OR REPLACE FUNCTION checkpoint_video_job(p_job_id uuid,p_worker text,p_progress jsonb,p_provider_job_ids jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN PERFORM checkpoint_video_job_v2(p_job_id,p_worker,p_progress,p_provider_job_ids); END $$;

CREATE OR REPLACE FUNCTION cancel_video_job(p_key text)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE idempotency_key=p_key AND status IN ('queued','processing','reconciliation_required') FOR UPDATE;
 IF j.id IS NULL THEN RETURN false; END IF;
 UPDATE video_quota_counters SET reserved=reserved-1,released=released+1,updated_at=clock_timestamp()
  WHERE user_id=j.user_id AND period_start=date_trunc('month',j.created_at)::date AND reserved>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_QUOTA_RECONCILIATION_REQUIRED'; END IF;
 UPDATE video_jobs SET status='cancelled',locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN true;
END $$;
-- Serialize same-intent submissions before quota, video and queue writes.
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS request_hash text;
CREATE OR REPLACE FUNCTION submit_video_job(p_user_id uuid,p_kind text,p_video_id uuid,p_payload jsonb,p_key text,p_request_hash text,p_limit int,p_initial jsonb)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; target_id uuid; target_table text; initial jsonb; cols text; vals text; receipt uuid;
BEGIN
 IF p_user_id IS NULL OR p_kind NOT IN ('create','production','auto','export') OR p_key IS NULL OR length(p_key)>512
  OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' OR p_limit IS NULL
  OR p_payload->'input'->>'userId' IS DISTINCT FROM p_user_id::text THEN RAISE EXCEPTION 'SUTRA_INVALID_SUBMISSION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key,0));
 SELECT * INTO j FROM video_jobs WHERE idempotency_key=p_key;
 IF j.id IS NOT NULL THEN
  IF j.user_id<>p_user_id OR j.kind<>p_kind OR j.request_hash IS DISTINCT FROM p_request_hash THEN
   RAISE EXCEPTION 'SUTRA_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN NEXT j; RETURN;
 END IF;
 IF p_kind IN ('create','export') AND (p_video_id IS NULL OR p_payload->'input'->>'videoId' IS DISTINCT FROM p_video_id::text)
  OR p_kind IN ('auto','production') AND p_video_id IS NOT NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_BINDING'; END IF;
 IF p_kind='export' AND NOT EXISTS(SELECT 1 FROM videos WHERE id=p_video_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF NOT reserve_video_quota(p_user_id,p_limit) THEN RAISE EXCEPTION 'SUTRA_QUOTA_EXHAUSTED'; END IF;
 IF p_kind IN ('create','auto') THEN
  IF p_initial IS NULL OR jsonb_typeof(p_initial)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_initial) k
    WHERE k NOT IN ('format','quality','tags','media_mode','stock_sources','schedule_id','scheduled_for','generation_started_at')) THEN RAISE EXCEPTION 'SUTRA_INVALID_INITIAL_VIDEO'; END IF;
  target_id:=CASE WHEN p_kind='create' THEN p_video_id ELSE (p_payload->'input'->>'videoRowId')::uuid END;
  IF target_id IS NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_BINDING'; END IF;
  target_table:=CASE WHEN p_kind='create' THEN 'videos' ELSE 'sutra_auto_videos' END;
  initial:=p_initial||jsonb_build_object('id',target_id,'user_id',p_user_id,'status',CASE WHEN p_kind='create' THEN 'generating' ELSE 'planning' END);
  SELECT string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') INTO cols,vals FROM jsonb_object_keys(initial) k;
  EXECUTE format('INSERT INTO sutra.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::sutra.%I,$1) r RETURNING id',target_table,cols,vals,target_table) INTO receipt USING initial;
  IF receipt IS DISTINCT FROM target_id THEN RAISE EXCEPTION 'SUTRA_VIDEO_PERSISTENCE_FAILED'; END IF;
 ELSIF p_initial IS NOT NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_INITIAL_VIDEO'; END IF;
 INSERT INTO video_jobs(user_id,kind,video_id,payload,idempotency_key,request_hash)
  VALUES(p_user_id,p_kind,p_video_id,p_payload,p_key,p_request_hash) RETURNING * INTO j;
 RETURN NEXT j;
END $$;
REVOKE ALL ON FUNCTION submit_video_job(uuid,text,uuid,jsonb,text,text,int,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION submit_video_job(uuid,text,uuid,jsonb,text,text,int,jsonb) TO service_role;
 END IF;
END $$;

-- 20261012_social_publication_journals.sql 33b755a9ca964dfdc04dbe31feb884f16922c9347a7fd1ccf027bd2fdce5fb1e
-- T06: service-owned evidence, independent of mutable/deleted production/history rows.
-- Apply only through the reviewed deployment migration process. No remote execution here.
CREATE TABLE IF NOT EXISTS sutra.social_publication_journals (
  production_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('video','auto')),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  operations jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(operations) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, production_id)
);
ALTER TABLE sutra.social_publication_journals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sutra.social_publication_journals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON sutra.social_publication_journals TO service_role;
COMMENT ON TABLE sutra.social_publication_journals IS
  'SUTRA durable publication evidence. Never delete to retry a production; server role only.';

-- 20261012_private_media.sql 98769829e0de73382b9ed28af591c1dcf34fc4c44920e9ac7bc10ac1bfc77ae7
-- Legacy object authority is populated by the reviewed cutover inventory.
-- Do not switch the Storage bucket here: that belongs to the final cutover
-- after the compatible application and legacy reference migration are ready.
CREATE TABLE IF NOT EXISTS sutra.media_ownership (
  object_path text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(object_path) BETWEEN 1 AND 1024)
);
ALTER TABLE sutra.media_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sutra.media_ownership FROM PUBLIC, anon, authenticated;
GRANT ALL ON sutra.media_ownership TO service_role;

-- 20261012_t02_account_permissions.sql b1c26b76c4f3d979d9e23122f9ce4750945c5a1e0f2773b8a10b367a31e2e5e5
-- SUTRA only. Apply with the migration owner (BYPASSRLS); never with a browser role.
-- Does not change public.social_accounts or any storage bucket shared with another app.

-- Billing updates subscription_status; they must not silently undo an administrative ban.
ALTER TABLE sutra.profiles ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;
UPDATE sutra.profiles SET access_revoked_at = now()
  WHERE subscription_status = 'banned' AND access_revoked_at IS NULL;

-- Owner RLS alone does not protect privileged columns on the owner's own profile.
REVOKE ALL ON TABLE sutra.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col record;
BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'sutra.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON sutra.profiles FROM PUBLIC, anon, authenticated', col.attname);
    IF col.attname = ANY (ARRAY['name', 'avatar_url', 'preferred_niche', 'preferred_voice_style',
        'preferred_quality', 'brand_kit', 'theme_mode', 'email_preferences',
        'onboarding_completed', 'tutorial_completed']) THEN
      EXECUTE format('GRANT UPDATE (%I) ON sutra.profiles TO authenticated', col.attname);
    END IF;
  END LOOP;
END $$;
GRANT SELECT ON sutra.profiles TO authenticated;
GRANT ALL ON sutra.profiles TO service_role;
ALTER TABLE sutra.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS t02_profile_owner ON sutra.profiles;
CREATE POLICY t02_profile_owner ON sutra.profiles AS RESTRICTIVE
  FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS t02_profile_read ON sutra.profiles;
CREATE POLICY t02_profile_read ON sutra.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS t02_profile_preferences ON sutra.profiles;
CREATE POLICY t02_profile_preferences ON sutra.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Tokens and connected-account authority belong to the server, even for the owner.
DO $$
DECLARE col record;
BEGIN
  IF to_regclass('sutra.social_accounts') IS NOT NULL THEN
    REVOKE ALL ON sutra.social_accounts FROM PUBLIC, anon, authenticated;
    FOR col IN SELECT attname FROM pg_attribute
      WHERE attrelid = 'sutra.social_accounts'::regclass AND attnum > 0 AND NOT attisdropped
    LOOP
      EXECUTE format('REVOKE ALL (%I) ON sutra.social_accounts FROM PUBLIC, anon, authenticated', col.attname);
      IF col.attname = ANY (ARRAY['id', 'user_id', 'platform', 'account_id', 'account_name',
          'external_id', 'username', 'display_name', 'avatar_url', 'is_active', 'status',
          'created_at', 'updated_at', 'connected_at']) THEN
        EXECUTE format('GRANT SELECT (%I) ON sutra.social_accounts TO authenticated', col.attname);
      END IF;
    END LOOP;
    GRANT ALL ON sutra.social_accounts TO service_role;
    ALTER TABLE sutra.social_accounts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS t02_social_owner ON sutra.social_accounts;
    CREATE POLICY t02_social_owner ON sutra.social_accounts AS RESTRICTIVE FOR ALL TO authenticated
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    DROP POLICY IF EXISTS t02_social_read ON sutra.social_accounts;
    CREATE POLICY t02_social_read ON sutra.social_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- The V7 award helper bypasses RLS and accepts a free beneficiary and amount.
-- Default PUBLIC EXECUTE must not turn it into a browser-accessible credit endpoint.
DO $$
BEGIN
  IF to_regprocedure('sutra.karma_award_seeds(uuid,integer,text,uuid,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) TO service_role;
    ALTER FUNCTION sutra.karma_award_seeds(uuid,integer,text,uuid,text) SET search_path = '';
  END IF;
END $$;

-- Recheck application revocation in the database too: an existing JWT is insufficient.
-- SECURITY DEFINER prevents recursion when evaluating the profiles policy itself.
CREATE OR REPLACE FUNCTION sutra.account_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (
  SELECT 1 FROM sutra.profiles WHERE id = auth.uid()
    AND access_revoked_at IS NULL AND subscription_status IS DISTINCT FROM 'banned'
) $$;
REVOKE ALL ON FUNCTION sutra.account_is_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sutra.account_is_active() TO authenticated, service_role;

DO $$
DECLARE tbl record;
BEGIN
  -- Restrictive policies intersect existing ownership/publication rules, never widen them.
  -- Future RLS tables must receive the same policy in their own migrations.
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sutra' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS t02_active_account ON sutra.%I', tbl.relname);
    EXECUTE format('CREATE POLICY t02_active_account ON sutra.%I AS RESTRICTIVE FOR ALL TO authenticated USING (sutra.account_is_active()) WITH CHECK (sutra.account_is_active())', tbl.relname);
  END LOOP;
END $$;

-- 20261012_t02_final_permissions.sql 5c4cb0d80bc2937d6a3bbde1fe2afa0fc47e0ba332f0618042c9feb8e1d14790
-- Apply after the integrated migrations and 20261012_t02_account_permissions.sql.
-- Permission-only hardening: no balances, tokens, publication payloads or business rules change.

-- TRUNCATE is not checked by RLS. GRANT ALL in sutra_auto.sql exposed every user's rows.
-- Browser roles need row operations only, never table-level integrity/DDL privileges.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA sutra FROM PUBLIC, anon, authenticated;

-- Rewards and their accounting records are written by authenticated server routes.
-- An owner policy must not allow a browser to mint its own balance or reward receipt.
DO $$
DECLARE tbl text; col record;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['purama_points', 'point_transactions', 'point_purchases',
      'point_milestones', 'daily_gifts', 'user_achievements', 'lottery_tickets']
  LOOP
    IF to_regclass(format('sutra.%I', tbl)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('REVOKE ALL ON TABLE sutra.%I FROM PUBLIC, anon, authenticated', tbl);
    FOR col IN SELECT attname FROM pg_attribute
      WHERE attrelid = to_regclass(format('sutra.%I', tbl)) AND attnum > 0 AND NOT attisdropped
    LOOP
      -- Table REVOKE does not revoke separately granted column privileges.
      EXECUTE format('REVOKE ALL (%I) ON sutra.%I FROM PUBLIC, anon, authenticated', col.attname, tbl);
    END LOOP;
    EXECUTE format('GRANT SELECT ON sutra.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON sutra.%I TO service_role', tbl);
    EXECUTE format('ALTER TABLE sutra.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS t02_reward_owner ON sutra.%I', tbl);
    EXECUTE format('CREATE POLICY t02_reward_owner ON sutra.%I AS RESTRICTIVE FOR ALL TO authenticated USING (user_id = auth.uid() AND sutra.account_is_active()) WITH CHECK (user_id = auth.uid() AND sutra.account_is_active())', tbl);
    EXECUTE format('DROP POLICY IF EXISTS t02_reward_read ON sutra.%I', tbl);
    EXECUTE format('CREATE POLICY t02_reward_read ON sutra.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', tbl);
  END LOOP;
END $$;

-- The OAuth callback and T06 use the SUTRA schema from sql/social-autopilot.sql,
-- installed in public, not the older sutra.social_accounts table. Refuse an unknown
-- public table rather than silently changing another application's schema.
DO $$
DECLARE col record;
BEGIN
  IF to_regclass('public.social_accounts') IS NULL THEN RETURN; END IF;
  IF obj_description('public.social_accounts'::regclass, 'pg_class') IS DISTINCT FROM
      'OAuth-connected social media accounts via Zernio' THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = 'public.social_accounts'::regclass
      AND attnum > 0 AND NOT attisdropped
      AND attname IN ('user_id','platform','external_id','status','access_token','refresh_token','metadata')) <> 7 THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED';
  END IF;
  REVOKE ALL ON public.social_accounts FROM PUBLIC, anon, authenticated;
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.social_accounts'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE ALL (%I) ON public.social_accounts FROM PUBLIC, anon, authenticated', col.attname);
    IF col.attname = ANY (ARRAY['id','user_id','platform','external_id','username','display_name',
        'avatar_url','status','connected_at','updated_at','token_expires_at']) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.social_accounts TO authenticated', col.attname);
    END IF;
  END LOOP;
  GRANT ALL ON public.social_accounts TO service_role;
  ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS t02_public_social_owner ON public.social_accounts;
  CREATE POLICY t02_public_social_owner ON public.social_accounts AS RESTRICTIVE FOR ALL TO authenticated
    USING (user_id = auth.uid() AND sutra.account_is_active())
    WITH CHECK (user_id = auth.uid() AND sutra.account_is_active());
  DROP POLICY IF EXISTS t02_public_social_read ON public.social_accounts;
  CREATE POLICY t02_public_social_read ON public.social_accounts FOR SELECT TO authenticated
    USING (user_id = auth.uid());
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
